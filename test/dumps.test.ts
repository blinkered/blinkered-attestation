import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkDump, dumpUrl, headSize } from '../src/dumps.js'
import type { SizeOf } from '../src/dumps.js'

const says =
  (bytes: number | null): SizeOf =>
  async () =>
    bytes

describe('where a dump came from', () => {
  it('rebuilds the URL a Wikimedia dump was downloaded from', () => {
    expect(dumpUrl('dewiki.xml.bz2')).toBe(
      'https://dumps.wikimedia.org/dewiki/latest/dewiki-latest-pages-articles.xml.bz2',
    )
    expect(dumpUrl('frwikisource.xml.bz2')).toBe(
      'https://dumps.wikimedia.org/frwikisource/latest/frwikisource-latest-pages-articles.xml.bz2',
    )
  })

  it('handles a language tag with a hyphen in it', () => {
    expect(dumpUrl('zh-yuewiki.xml.bz2')).toContain('/zh-yuewiki/latest/')
  })

  it('finds no extension in a name that has none', async () => {
    // A Leipzig package is a directory. It never reaches the size check, and if it did there
    // would be nothing to compare.
    const bare = await checkDump('deu_news_2024_1M', 1, says(2), 'https://x/deu_news_2024_1M')
    expect(bare.verdict).toBe('truncated')
  })

  it('says nothing about a file that is not a Wikimedia dump', () => {
    expect(dumpUrl('fineweb2-jpn.parquet')).toBeNull()
    expect(dumpUrl('deu_sentences.tsv')).toBeNull()
  })
})

describe('whether a dump is all there', () => {
  it('passes a file that matches what the server reports', async () => {
    const checked = await checkDump('dewiki.xml.bz2', 7_962_534_106, says(7_962_534_106))
    expect(checked.verdict).toBe('ok')
  })

  it('catches one that is still downloading', async () => {
    const checked = await checkDump('dewiki.xml.bz2', 7_361_523_712, says(7_962_534_106))
    expect(checked.verdict).toBe('truncated')
    expect(checked.expect).toBe(7_962_534_106)
  })

  it('does not count a silent server against the file', async () => {
    // Not being able to ask is not evidence of a problem, and refusing to build on it would make
    // every build depend on Wikimedia being up.
    const checked = await checkDump('dewiki.xml.bz2', 1, says(null))
    expect(checked.verdict).toBe('unknown')
  })

  it('checks a collection that says where it came from, whatever it is called', async () => {
    const checked = await checkDump(
      'fineweb2-kor.parquet',
      14_229_504,
      says(4_844_133_014),
      'https://huggingface.co/datasets/HuggingFaceFW/fineweb-2/resolve/main/x.parquet',
    )
    expect(checked.verdict).toBe('truncated')
  })

  it('leaves alone a file that was unpacked from its download', async () => {
    // Tatoeba's cached .tsv comes out of a .bz2 and an eBible .txt out of a .zip. Comparing the
    // unpacked size against the archive's reports every complete file as a partial one, which is
    // what it did to English, French, Spanish and Tagalog in one run.
    const unpacked = await checkDump(
      'engwebp_vpl.txt',
      4_327_897,
      says(4_281_537),
      'https://ebible.org/Scriptures/engwebp_vpl.zip',
    )
    expect(unpacked.verdict).toBe('not a dump')

    const sentences = await checkDump(
      'deu_sentences.tsv',
      47_560_809,
      says(12_044_731),
      'https://downloads.tatoeba.org/exports/per_language/deu/deu_sentences.tsv.bz2',
    )
    expect(sentences.verdict).toBe('not a dump')
  })

  it('still checks a file saved exactly as it was downloaded', async () => {
    // Wikimedia saves under a shorter name and FineWeb-2 under a different one, but both keep
    // the extension, which is what says the bytes are the same bytes.
    const wiki = await checkDump('dewiki.xml.bz2', 1, says(7_962_534_106))
    expect(wiki.verdict).toBe('truncated')
    const shard = await checkDump(
      'fineweb2-kor.parquet',
      14_229_504,
      says(4_844_133_014),
      'https://huggingface.co/datasets/HuggingFaceFW/fineweb-2/resolve/main/x/000_00000.parquet',
    )
    expect(shard.verdict).toBe('truncated')
  })

  it('leaves alone a file it has no way to check', async () => {
    const checked = await checkDump('gutenberg-de', 0, says(999))
    expect(checked.verdict).toBe('not a dump')
  })
})

describe('asking a server how big a file is', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads content-length without downloading the body', async () => {
    const fetched = vi.fn(
      async (_url: string, options?: RequestInit) =>
        new Response(null, { headers: { 'content-length': '42' } }),
    )
    vi.stubGlobal('fetch', fetched)
    expect(await headSize('https://dumps.wikimedia.org/x')).toBe(42)
    // HEAD, because the body is eight gigabytes and the number is in the headers.
    expect(fetched.mock.calls[0]?.[1]).toMatchObject({ method: 'HEAD' })
  })

  it('says nothing when the server omits the header', async () => {
    vi.stubGlobal('fetch', async () => new Response(null))
    expect(await headSize('https://dumps.wikimedia.org/x')).toBeNull()
  })

  it('says nothing when the request fails, rather than throwing into a build', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('offline')
    })
    expect(await headSize('https://dumps.wikimedia.org/x')).toBeNull()
  })
})
