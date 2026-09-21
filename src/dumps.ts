/**
 * Whether a cached dump is all there, before a build spends two hours trusting it.
 *
 * A truncated `.bz2` decompresses happily until it reaches the end of what arrived and then
 * fails as a CRC error indistinguishable from real corruption — deep inside a decompressor, with
 * nothing naming which file it was. That has cost three builds: a partial download during a full
 * disk, a build started while a download was still running, and a dump nobody checked because a
 * different one had already passed.
 *
 * A size check is a second of HTTP and catches all three. It lives here rather than only in the
 * script so that the build can make the same check about its own sources, and refuse. A script
 * that checks everything in a shared cache is the wrong guard for one language: German has no
 * reason to stop because a Japanese dump is half-downloaded.
 */

/** Wikimedia names its dumps predictably, which is what makes this checkable at all. */
export function dumpUrl(name: string): string | null {
  const wiki = /^([a-z-]+)(wikisource|wiki)\.xml\.bz2$/u.exec(name)
  if (wiki === null) return null
  const [, language, kind] = wiki
  return (
    `https://dumps.wikimedia.org/${language as string}${kind as string}/latest/` +
    `${language as string}${kind as string}-latest-pages-articles.xml.bz2`
  )
}

/** How many bytes the server says a dump has, or null if it will not say. */
export type SizeOf = (url: string) => Promise<number | null>

export type Verdict = 'ok' | 'truncated' | 'unknown' | 'not a dump'

export interface Checked {
  readonly name: string
  readonly have: number
  readonly expect: number | null
  readonly verdict: Verdict
}

/**
 * Compares one cached file against what its server reports.
 *
 * A server that will not answer leaves the verdict `unknown` rather than counting against the
 * file: not being able to ask is not evidence of a problem, and refusing to build on it would
 * make every build depend on Wikimedia being up.
 */
export async function checkDump(name: string, have: number, sizeOf: SizeOf): Promise<Checked> {
  const url = dumpUrl(name)
  if (url === null) return { name, have, expect: null, verdict: 'not a dump' }
  const expect = await sizeOf(url)
  if (expect === null) return { name, have, expect: null, verdict: 'unknown' }
  return { name, have, expect, verdict: have === expect ? 'ok' : 'truncated' }
}

/** Reads a `content-length` without downloading the body. */
export const headSize: SizeOf = async (url) => {
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    const header = response.headers.get('content-length')
    return header === null ? null : Number(header)
  } catch {
    return null
  }
}
