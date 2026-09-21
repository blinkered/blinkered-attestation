/**
 * Every language's saturation curve on one pair of axes.
 *
 * Each `blinkered-dictionary-*` measures its own curve, because how much a family is worth is a
 * fact about that language and belongs beside its evidence. But the question that made us
 * measure at all — *where do the returns stop* — is only answerable by looking at all of them
 * together, and there is no single repository where that comparison naturally lives except this
 * one. So the statistics stay in the language repositories and this draws them.
 *
 * **An SVG rather than a table**, because the shape is the finding. Korean's curve climbs to
 * thirty-six percent on its third family and then crawls for twenty more; German's clears
 * ninety-eight on its fifth. A table of the same numbers makes a reader do that comparison in
 * their head, one row at a time.
 *
 * Drawn with no background and mid-tone axes so it reads on GitHub's light and dark themes
 * alike; a chart that needs the right theme is a chart half the readers cannot use.
 */

import type { Step } from './saturation.js'

/** One language's measured curve, as its own repository reported it. */
export interface Curve {
  readonly language: string
  readonly steps: readonly Step[]
}

/**
 * Where a curve stops paying: the first family past the minimum that adds less than a twentieth
 * of what the best single family added.
 *
 * A twentieth is a judgement, not a derivation, and it is here rather than in each language's
 * script so that fifty-one repositories cannot answer "where are the diminishing returns" with
 * fifty-one different thresholds.
 */
export function knee(steps: readonly Step[], fraction = 20): Step | undefined {
  if (steps.length === 0) return undefined
  const best = Math.max(...steps.map((step) => step.gained))
  return steps.find((step) => step.families > 3 && step.gained < best / fraction)
}

/** Enough hues to tell a dozen languages apart, and readable against white and near-black. */
const INK = [
  '#1f77b4',
  '#d62728',
  '#2ca02c',
  '#9467bd',
  '#ff7f0e',
  '#17becf',
  '#8c564b',
  '#e377c2',
  '#7f7f7f',
  '#bcbd22',
]

/** Enough room under a label for the next one, at twelve-point type. */
const LABEL_GAP = 15

const WIDTH = 720
const HEIGHT = 420
const PAD = { left: 52, right: 104, top: 20, bottom: 44 }

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * The chart, as a standalone SVG document.
 *
 * The x axis is families consulted and the y axis is share of the candidate list kept, so a
 * language with a huge candidate list and a language with a small one are compared on the thing
 * that matters — how much of its own dictionary it could prove.
 */
export function chart(curves: readonly Curve[]): string {
  const plotted = curves.filter((curve) => curve.steps.length > 0)
  const maxFamilies = Math.max(1, ...plotted.map((curve) => curve.steps.length))
  const plotWidth = WIDTH - PAD.left - PAD.right
  const plotHeight = HEIGHT - PAD.top - PAD.bottom

  const x = (families: number): number =>
    PAD.left + (maxFamilies === 1 ? 0 : ((families - 1) / (maxFamilies - 1)) * plotWidth)
  const y = (share: number): number => PAD.top + plotHeight - share * plotHeight

  const grid: string[] = []
  for (let percent = 0; percent <= 100; percent += 20) {
    const at = y(percent / 100).toFixed(1)
    grid.push(
      `<line x1="${String(PAD.left)}" y1="${at}" x2="${String(PAD.left + plotWidth)}" y2="${at}" ` +
        `stroke="#888" stroke-opacity="0.25" />`,
      `<text x="${String(PAD.left - 8)}" y="${at}" fill="#888" font-size="11" ` +
        `text-anchor="end" dominant-baseline="middle">${String(percent)}%</text>`,
    )
  }

  const ticks: string[] = []
  // At most eight labels, whatever the widest language reached, so they never collide.
  const every = Math.max(1, Math.ceil(maxFamilies / 8))
  for (let families = 1; families <= maxFamilies; families += every) {
    ticks.push(
      `<text x="${x(families).toFixed(1)}" y="${String(HEIGHT - PAD.bottom + 18)}" fill="#888" ` +
        `font-size="11" text-anchor="middle">${String(families)}</text>`,
    )
  }

  // Labels go where each curve ended, nudged apart where two languages finished within a few
  // points of each other. Spanish and French land half a point apart, and two labels printed on
  // top of each other name neither language.
  const ends = plotted
    .map((curve, at) => ({ at, y: y((curve.steps.at(-1) as Step).share) }))
    .sort((left, right) => left.y - right.y)
  const labelY = new Map<number, number>()
  let floor = PAD.top
  for (const end of ends) {
    const placed = Math.max(end.y, floor)
    labelY.set(end.at, placed)
    floor = placed + LABEL_GAP
  }

  const lines = plotted.map((curve, at) => {
    const ink = INK[at % INK.length] as string
    const points = curve.steps
      .map((step) => `${x(step.families).toFixed(1)},${y(step.share).toFixed(1)}`)
      .join(' ')
    const last = curve.steps.at(-1) as Step
    const end = y(last.share)
    const label = labelY.get(at) as number
    // A leader from where the curve actually stopped to its label in the right-hand column.
    // German runs out of families at five and Korean at twenty-three, so without one a reader
    // has to guess which line the label at the edge belongs to.
    const leader =
      `<line x1="${x(last.families).toFixed(1)}" y1="${end.toFixed(1)}" ` +
      `x2="${String(PAD.left + plotWidth + 5)}" y2="${label.toFixed(1)}" ` +
      `stroke="${ink}" stroke-opacity="0.35" stroke-dasharray="2 3" />`
    return (
      `<polyline points="${points}" fill="none" stroke="${ink}" stroke-width="2" ` +
      `stroke-linejoin="round" />` +
      leader +
      `<text x="${String(PAD.left + plotWidth + 8)}" y="${label.toFixed(1)}" ` +
      `fill="${ink}" font-size="12" dominant-baseline="middle">` +
      `${escape(curve.language)} ${(last.share * 100).toFixed(0)}%</text>`
    )
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(WIDTH)}" height="${String(HEIGHT)}" viewBox="0 0 ${String(WIDTH)} ${String(HEIGHT)}" font-family="system-ui, sans-serif">
${grid.join('\n')}
<line x1="${String(PAD.left)}" y1="${String(PAD.top)}" x2="${String(PAD.left)}" y2="${String(PAD.top + plotHeight)}" stroke="#888" />
<line x1="${String(PAD.left)}" y1="${String(PAD.top + plotHeight)}" x2="${String(PAD.left + plotWidth)}" y2="${String(PAD.top + plotHeight)}" stroke="#888" />
${ticks.join('\n')}
<text x="${String(PAD.left + plotWidth / 2)}" y="${String(HEIGHT - 8)}" fill="#888" font-size="12" text-anchor="middle">independent families consulted</text>
<text x="14" y="${String(PAD.top + plotHeight / 2)}" fill="#888" font-size="12" text-anchor="middle" transform="rotate(-90 14 ${String(PAD.top + plotHeight / 2)})">candidate list proved</text>
${lines.join('\n')}
</svg>
`
}
