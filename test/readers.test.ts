import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { parquetWriteFile } from 'hyparquet-writer'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  crawlRows,
  fileDocuments,
  fineweb2Documents,
  gutenbergBody,
  harvestDocuments,
  harvestedPages,
  leipzigLocators,
  leipzigSentences,
  tatoebaDocuments,
  tatoebaRows,
  verseDocuments,
  versesByChapter,
  wikiDocuments,
  wikiPages,
} from '../src/readers.js'
import type { Document } from '../src/scan.js'

async function collect(documents: AsyncGenerator<Document>): Promise<Document[]> {
  const found: Document[] = []
  for await (const document of documents) found.push(document)
  return found
}

describe('the Tatoeba reader', () => {
  it('takes the id as the locator and the third column as the text', async () => {
    const rows = ['230\tdeu\tEs ist schade.', '77\tdeu\tLass uns etwas versuchen!']
    expect(await collect(tatoebaRows(rows))).toEqual([
      { locator: '230', text: 'Es ist schade.' },
      { locator: '77', text: 'Lass uns etwas versuchen!' },
    ])
  })

  it('skips a blank line', async () => {
    expect(await collect(tatoebaRows(['', '1\tdeu\tHallo', '']))).toHaveLength(1)
  })

  it('skips a short row rather than reading it as an empty sentence', async () => {
    // A truncated download understating a collection silently is the failure worth avoiding.
    expect(await collect(tatoebaRows(['1\tdeu']))).toEqual([])
  })

  it('keeps a tab inside the sentence out of the locator', async () => {
    const [first] = await collect(tatoebaRows(['5\tdeu\tzwei\tteile']))
    expect(first).toEqual({ locator: '5', text: 'zwei' })
  })
})

describe('the wiki reader', () => {
  const page = (id: string, ns: string, text: string): string[] => [
    '  <page>',
    `    <title>Test ${id}</title>`,
    `    <ns>${ns}</ns>`,
    `    <id>${id}</id>`,
    '    <revision>',
    '      <id>99999</id>',
    `      <text bytes="10" xml:space="preserve">${text}</text>`,
    '    </revision>',
    '  </page>',
  ]

  it('takes the page id rather than the revision id', async () => {
    const found = await collect(wikiPages(page('1304', '0', 'schade nur')))
    expect(found).toEqual([{ locator: '1304', text: 'schade nur' }])
  })

  it('reads only articles, skipping talk and project namespaces', async () => {
    const lines = [...page('1', '0', 'artikel'), ...page('2', '1', 'diskussion')]
    expect(await collect(wikiPages(lines))).toEqual([{ locator: '1', text: 'artikel' }])
  })

  it('reads a page whose text runs over many lines', async () => {
    const lines = [
      '  <page>',
      '    <ns>0</ns>',
      '    <id>7</id>',
      '    <text xml:space="preserve">erste Zeile',
      'zweite Zeile',
      'dritte Zeile</text>',
      '  </page>',
    ]
    const [first] = await collect(wikiPages(lines))
    expect(first?.text).toBe('erste Zeile\nzweite Zeile\ndritte Zeile')
  })

  it('drops a page that never closes its text rather than emitting a partial one', async () => {
    const lines = ['  <page>', '    <ns>0</ns>', '    <id>7</id>', '    <text>abgeschnitten']
    expect(await collect(wikiPages(lines))).toEqual([])
  })

  it('resets between pages, so one page cannot inherit another’s id', async () => {
    const lines = [...page('1', '0', 'eins'), '  <page>', '    <ns>0</ns>', '    <text>zwei</text>']
    // The second page never declares an id, so it is not emitted rather than being filed under 1.
    expect(await collect(wikiPages(lines))).toEqual([{ locator: '1', text: 'eins' }])
  })

  it('ignores a line with nothing it is looking for', async () => {
    expect(await collect(wikiPages(['  <siteinfo>', '  </siteinfo>']))).toEqual([])
  })
})

describe('stripping wikitext', () => {
  const textOf = async (wikitext: string): Promise<string> => {
    const [first] = await collect(
      wikiPages(['<page>', '<ns>0</ns>', '<id>1</id>', `<text>${wikitext}</text>`, '</page>']),
    )
    return first?.text ?? ''
  }

  it('removes templates, which would otherwise be attested thousands of times', async () => {
    expect(await textOf('Ein {{Infobox|x=1}} Haus')).toBe('Ein   Haus')
  })

  it('removes tables', async () => {
    expect(await textOf('vor {|class="wikitable"\n|Zelle\n|} nach')).toBe('vor   nach')
  })

  it('removes references and any other tag', async () => {
    expect(await textOf('Haus<ref>Quelle</ref> <b>fett</b>')).toBe('Haus   fett ')
  })

  it('shows the visible side of a link rather than its target', async () => {
    expect(await textOf('[[Berlin|die Hauptstadt]] und [[Haus]]')).toBe('die Hauptstadt und Haus')
  })

  it('removes headings, which repeat on every article', async () => {
    expect(await textOf('Text\n== Weblinks ==\nmehr')).toBe('Text\n \nmehr')
  })

  it('removes entities and bare URLs', async () => {
    expect(await textOf('a &nbsp; b https://example.de/x c')).toBe('a   b   c')
  })
})

describe('the file reader', () => {
  it('pairs each locator with what its file holds', async () => {
    const files = [
      { locator: '2054', path: '/books/2054.txt' },
      { locator: '2146', path: '/books/2146.txt' },
    ]
    const read = async (path: string): Promise<string> => `inhalt von ${path}`
    expect(await collect(fileDocuments(files, read))).toEqual([
      { locator: '2054', text: 'inhalt von /books/2054.txt' },
      { locator: '2146', text: 'inhalt von /books/2146.txt' },
    ])
  })

  it('reads nothing from no files', async () => {
    expect(await collect(fileDocuments([], async () => ''))).toEqual([])
  })
})

describe('reading from disk', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'blinkered-attestation-'))

  it('reads a Tatoeba export off the filesystem', async () => {
    const path = join(tmp, 'deu_sentences.tsv')
    writeFileSync(path, '230\tdeu\tEs ist schade.\n77\tdeu\tHallo!\n')
    expect(await collect(tatoebaDocuments(path))).toEqual([
      { locator: '230', text: 'Es ist schade.' },
      { locator: '77', text: 'Hallo!' },
    ])
  })

  it('streams a bz2 wiki dump through the decompressor', async () => {
    const xml = ['<page>', '<ns>0</ns>', '<id>1304</id>', '<text>schade nur</text>', '</page>']
    const path = join(tmp, 'dump.xml.bz2')
    writeFileSync(path, execFileSync('bzip2', ['-zc'], { input: xml.join('\n') }))
    expect(await collect(wikiDocuments(path))).toEqual([{ locator: '1304', text: 'schade nur' }])
  })

  it('fails loudly when the dump is not a dump, rather than reading it as empty', async () => {
    // A half-finished download decompresses to nothing, and nothing looks exactly like a
    // collection that simply did not attest the word.
    const path = join(tmp, 'truncated.xml.bz2')
    writeFileSync(path, 'not bzip2 at all')
    await expect(collect(wikiDocuments(path))).rejects.toThrow('bzip2 exited')
  })
})

describe('the Gutenberg body', () => {
  const wrap = (body: string): string =>
    [
      'The Project Gutenberg eBook of Test',
      'no restrictions whatsoever.',
      '*** START OF THE PROJECT GUTENBERG EBOOK TEST ***',
      body,
      '*** END OF THE PROJECT GUTENBERG EBOOK TEST ***',
      'Updated editions will replace',
    ].join('\n')

  it('keeps the book and drops the licence around it', () => {
    expect(gutenbergBody(wrap('Ein Haus am Meer.')).trim()).toBe('Ein Haus am Meer.')
  })

  it('leaves out the English boilerplate that repeats in every single file', () => {
    // Left in, a German collection would rank RESTRICTIONS and WHATSOEVER as common German.
    const body = gutenbergBody(wrap('Ein Haus.'))
    expect(body).not.toContain('restrictions')
    expect(body).not.toContain('Updated editions')
  })

  it('accepts the older THIS spelling of the marker', () => {
    const text = '*** START OF THIS PROJECT GUTENBERG EBOOK X ***\nHaus\n'
    expect(gutenbergBody(text).trim()).toBe('Haus')
  })

  it('takes the rest of the file when the end marker is missing', () => {
    const text = '*** START OF THE PROJECT GUTENBERG EBOOK X ***\nHaus am Meer'
    expect(gutenbergBody(text).trim()).toBe('Haus am Meer')
  })

  it('ignores an end marker sitting before the start one', () => {
    const text =
      '*** END OF THE PROJECT GUTENBERG EBOOK X ***\n*** START OF THE PROJECT GUTENBERG EBOOK X ***\nHaus'
    expect(gutenbergBody(text).trim()).toBe('Haus')
  })

  it('skips a file with no start marker rather than using it whole', () => {
    // All 2,382 German books carry one, so a file without one is misunderstood, not older.
    expect(gutenbergBody('Irgendein Text ohne Markierung')).toBe('')
  })
})

describe('the Leipzig reader', () => {
  const locators = leipzigLocators(
    ['10\t1', '11\t2', '12\t999'].join('\n'),
    ['1\thttps://kleinezeitung.at/a\t2024-01-05', '2\thttps://heise.de/b\t2024-12-02'].join('\n'),
  )

  it('resolves a sentence through both index files to the page it came from', () => {
    expect(locators.get('10')).toBe('https://kleinezeitung.at/a')
    expect(locators.get('11')).toBe('https://heise.de/b')
  })

  it('leaves out a sentence whose source id is not in sources.txt', () => {
    expect(locators.has('12')).toBe(false)
  })

  it('stores the URL whole, so the evidence is checkable without the package', async () => {
    const rows = ['10\tDer Fernseher ist kaputt.', '11\tPizza schmeckt gut.']
    expect(await collect(leipzigSentences(rows, locators))).toEqual([
      { locator: 'https://kleinezeitung.at/a', text: 'Der Fernseher ist kaputt.' },
      { locator: 'https://heise.de/b', text: 'Pizza schmeckt gut.' },
    ])
  })

  it('skips a sentence it could never cite rather than counting it', async () => {
    // Only 45% of deu_news_2024_1M resolves. A count the locator column cannot support is the
    // one kind of dishonesty this format exists to prevent.
    expect(await collect(leipzigSentences(['12\tNicht zitierbar.'], locators))).toEqual([])
  })

  it('skips a line with no tab at all', async () => {
    expect(await collect(leipzigSentences(['kaputt'], locators))).toEqual([])
  })

  it('ignores a malformed row in either index file', () => {
    expect(leipzigLocators('10', '1\thttps://x/a').size).toBe(0)
  })
})

describe('the crawl reader', () => {
  it('cites each document by the page it was crawled from', () => {
    const rows = [
      { url: 'https://abante.com.ph/a', text: 'Magandang umaga.' },
      { url: 'https://bomba.ph/b', text: 'Kumusta ka?' },
    ]
    expect([...crawlRows(rows)]).toEqual([
      { locator: 'https://abante.com.ph/a', text: 'Magandang umaga.' },
      { locator: 'https://bomba.ph/b', text: 'Kumusta ka?' },
    ])
  })

  it('skips a row with no URL, because it could never be cited', () => {
    expect([...crawlRows([{ text: 'walang URL' }])]).toEqual([])
    expect([...crawlRows([{ url: '', text: 'walang URL' }])]).toEqual([])
  })

  it('skips a row with no text', () => {
    expect([...crawlRows([{ url: 'https://x/a' }])]).toEqual([])
    expect([...crawlRows([{ url: 'https://x/a', text: '' }])]).toEqual([])
  })
})

describe('reading a FineWeb-2 shard', () => {
  it('streams every row, batching through the file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'blinkered-parquet-'))
    const path = join(dir, 'fil.parquet')
    parquetWriteFile({
      filename: path,
      columnData: [
        {
          name: 'url',
          data: ['https://abante.com.ph/a', 'https://bomba.ph/b', '', 'https://x.ph/d'],
        },
        { name: 'text', data: ['Magandang umaga.', 'Kumusta ka?', 'walang url', ''] },
      ],
    })
    // A batch size below the row count, so the paging loop runs more than once and its exit
    // condition is exercised rather than assumed.
    const found = await collect(fineweb2Documents(path, 2))
    expect(found).toEqual([
      { locator: 'https://abante.com.ph/a', text: 'Magandang umaga.' },
      { locator: 'https://bomba.ph/b', text: 'Kumusta ka?' },
    ])
  })
})

describe('the scripture reader', () => {
  const lines = [
    'GEN 1:1 Noong simula nilikha ng Diyos ang langit.',
    'GEN 1:2 Ang lupa ay walang anyo.',
    'GEN 2:1 Natapos ang langit at ang lupa.',
    'EXO 12:14 Ang araw na ito ay magiging alaala.',
  ]

  it('gathers verses into the chapter a locator can open', async () => {
    expect(await collect(versesByChapter(lines))).toEqual([
      {
        locator: 'GEN01',
        text: 'Noong simula nilikha ng Diyos ang langit. Ang lupa ay walang anyo.',
      },
      { locator: 'GEN02', text: 'Natapos ang langit at ang lupa.' },
      { locator: 'EXO12', text: 'Ang araw na ito ay magiging alaala.' },
    ])
  })

  it('pads the chapter, because the pages are named GEN01 rather than GEN1', async () => {
    const [first] = await collect(versesByChapter(['GEN 9:1 Pinagpala ng Diyos.']))
    expect(first?.locator).toBe('GEN09')
  })

  it('ignores a line that is not a verse', async () => {
    expect(await collect(versesByChapter(['', 'not a verse', 'GEN 1:1 Tunay.']))).toHaveLength(1)
  })

  it('emits the last chapter, which has no following verse to close it', async () => {
    const found = await collect(versesByChapter(['REV 22:21 Ang biyaya.']))
    expect(found).toEqual([{ locator: 'REV22', text: 'Ang biyaya.' }])
  })

  it('reads nothing from nothing', async () => {
    expect(await collect(versesByChapter([]))).toEqual([])
  })

  it('reads a verse-per-line file off the filesystem', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'blinkered-vpl-'))
    const path = join(dir, 'tglulb_vpl.txt')
    writeFileSync(path, `${lines.join('\n')}\n`)
    const found = await collect(verseDocuments(path))
    expect(found.map((document) => document.locator)).toEqual(['GEN01', 'GEN02', 'EXO12'])
  })
})

describe('the harvest reader', () => {
  it('cites a harvested page by its own URL', async () => {
    const rows = [
      'https://www.kn-online.de/a\tSie entschuldigst dich nicht.',
      'https://taz.de/b\tEr bedrohst niemanden.',
    ]
    expect(await collect(harvestedPages(rows))).toEqual([
      { locator: 'https://www.kn-online.de/a', text: 'Sie entschuldigst dich nicht.' },
      { locator: 'https://taz.de/b', text: 'Er bedrohst niemanden.' },
    ])
  })

  it('skips a row with no text, since a search hit is not a sighting', async () => {
    // A search engine saying a page holds a word is not the page holding it. Only fetched text
    // counts, so a row that fetched nothing attests nothing.
    expect(await collect(harvestedPages(['https://x/a\t', 'https://x/b']))).toEqual([])
  })

  it('reads a harvest file off the filesystem', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'blinkered-harvest-'))
    const path = join(dir, 'searched.tsv')
    writeFileSync(path, 'https://x/a\tEin ordentliches Wort.\n')
    expect(await collect(harvestDocuments(path))).toEqual([
      { locator: 'https://x/a', text: 'Ein ordentliches Wort.' },
    ])
  })
})
