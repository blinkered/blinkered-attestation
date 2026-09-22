import { describe, expect, it } from 'vitest'
import { chart, knee } from '../src/curves.js'
import type { Curve } from '../src/curves.js'
import type { Step } from '../src/saturation.js'

const step = (families: number, kept: number, share: number, gained: number): Step => ({
  families,
  added: `f${String(families)}`,
  kept,
  share,
  gained,
})

const GERMAN: Curve = {
  language: 'de',
  steps: [
    step(1, 0, 0, 0),
    step(2, 0, 0, 0),
    step(3, 30000, 0.82, 30000),
    step(4, 34000, 0.93, 4000),
    step(5, 35725, 0.979, 1200),
  ],
}

const KOREAN: Curve = {
  language: 'ko',
  steps: [
    step(1, 0, 0, 0),
    step(2, 0, 0, 0),
    step(3, 13904, 0.361, 13904),
    step(4, 14907, 0.388, 1003),
  ],
}

describe('where a curve stops paying', () => {
  it('names the first family past the minimum that adds under a twentieth of the best', () => {
    // The best gain is 30,000, so a twentieth is 1,500 and family 5 (+1,200) is the first below.
    expect(knee(GERMAN.steps)?.families).toBe(5)
  })

  it('says nothing when every family was still earning its place', () => {
    expect(knee(KOREAN.steps)).toBeUndefined()
  })

  it('says nothing about a language with no curve at all', () => {
    expect(knee([])).toBeUndefined()
  })

  it('takes the threshold as an argument, so the judgement can be argued with', () => {
    expect(knee(GERMAN.steps, 5)?.families).toBe(4)
  })
})

describe('the chart', () => {
  const svg = chart([GERMAN, KOREAN])

  it('is a standalone SVG document', () => {
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true)
  })

  it('draws one line per language and labels it with where it finished', () => {
    expect(svg.match(/<polyline /g)).toHaveLength(2)
    // Korean stops at four families and German at five, so Korean's leader starts short of the
    // right edge rather than at it.
    expect(svg).toContain('<line x1="475.0"')
    expect(svg).toContain('>de 98%</text>')
    expect(svg).toContain('>ko 39%</text>')
  })

  it('scales the x axis to the language that consulted the most families', () => {
    // German's fifth family is the rightmost point, so it sits on the right edge of the plot.
    expect(svg).toContain('616.0,')
  })

  it('leaves out a language that measured nothing rather than drawing a flat line for it', () => {
    const drawn = chart([GERMAN, { language: 'en', steps: [] }])
    expect(drawn.match(/<polyline /g)).toHaveLength(1)
    expect(drawn).not.toContain('>en ')
  })

  it('nudges labels apart when two languages finished at the same coverage, with a leader', () => {
    const twin = { ...KOREAN, language: 'tw' }
    const drawn = chart([KOREAN, twin])
    const placed = [...drawn.matchAll(/<text x="624" y="([\d.]+)"/g)].map((found) =>
      Number(found[1]),
    )
    expect(placed).toHaveLength(2)
    expect(Math.abs((placed[1] as number) - (placed[0] as number))).toBeGreaterThanOrEqual(15)
    // Each label is joined to where its curve actually ended. Counted by the leader's own dash
    // pattern rather than by any dash at all, because a curve that does not ship is dashed too
    // and so is the legend's sample of one.
    expect(drawn.match(/stroke-dasharray="2 3"/g)).toHaveLength(2)
  })

  it('draws a language that ships solid and one that does not dashed, and says which is which', () => {
    const drawn = chart([
      { ...GERMAN, ships: true },
      { ...KOREAN, language: 'ja', ships: false },
    ])
    const curves = drawn.match(/<polyline [^>]*>/g) as RegExpMatchArray
    expect(curves).toHaveLength(2)
    expect(curves[0]).not.toContain('stroke-dasharray')
    expect(curves[1]).toContain('stroke-dasharray="6 4"')
    // The one that does not ship is named in italics, and the legend explains the difference
    // rather than leaving a reader to infer it.
    expect(drawn).toMatch(/font-style="italic"[^>]*>ja /u)
    expect(drawn).toContain('>ships</text>')
    expect(drawn).toContain('>in progress</text>')
  })

  it('treats a curve that says nothing about shipping as not shipping', () => {
    // Absence means no, here as everywhere: a language nobody blessed is drawn as in progress.
    expect(chart([GERMAN]).match(/<polyline [^>]*>/g)?.[0]).toContain('stroke-dasharray="6 4"')
  })

  it('draws a pending language dashed, the same as a held one', () => {
    // Three states of blessing, two line styles. The picture answers "is this live", and pending
    // and held are both not; which of the two it is belongs in the table, not the stroke.
    const held = chart([{ ...GERMAN, ships: false }]).match(/<polyline [^>]*>/g)?.[0]
    const pending = chart([{ ...GERMAN, ships: 'pending' }]).match(/<polyline [^>]*>/g)?.[0]
    expect(held).toContain('stroke-dasharray="6 4"')
    expect(pending).toContain('stroke-dasharray="6 4"')
  })

  it('survives being asked to draw nothing', () => {
    const empty = chart([])
    expect(empty).toContain('</svg>')
    expect(empty).not.toContain('<polyline')
  })

  it('draws a single-family curve without dividing by zero', () => {
    const one = chart([{ language: 'xx', steps: [step(1, 5, 0.5, 5)] }])
    expect(one).toContain('<polyline points="52.0,')
    expect(one).not.toContain('NaN')
  })

  it('escapes a language tag rather than letting it write markup', () => {
    const risky = chart([{ language: 'a&b<c>', steps: [step(1, 1, 1, 1)] }])
    expect(risky).toContain('a&amp;b&lt;c&gt;')
  })
})
