import { describe, expect, it } from 'vitest'
import { saturation } from '../src/saturation.js'
import type { WordEvidence } from '../src/evidence.js'

const own = (source: string): string => source

const word = (name: string, sources: string[]): WordEvidence => ({
  word: name,
  attestations: sources.map((source) => ({ source, count: 1, locators: ['1'] })),
})

describe('the saturation curve', () => {
  it('keeps nothing until the third family, which is the shape of the rule', () => {
    const words = [word('A', ['x', 'y', 'z']), word('B', ['x', 'y', 'z'])]
    const steps = saturation(words, own, 2)
    expect(steps.map((step) => step.kept)).toEqual([0, 0, 2])
  })

  it('adds the family that rescues the most, not the first it is offered', () => {
    // `big` sees both words, `small` sees one. A greedy walk must take `big` third.
    const words = [word('A', ['x', 'y', 'big']), word('B', ['x', 'y', 'big', 'small'])]
    const steps = saturation(words, own, 2)
    expect(steps[2]?.added).toBe('big')
    expect(steps[2]?.kept).toBe(2)
  })

  it('reports what each family added over the ones before it', () => {
    const words = [word('A', ['x', 'y', 'z']), word('B', ['x', 'y', 'w'])]
    const steps = saturation(words, own, 2)
    expect(steps.map((step) => step.gained)).toEqual([0, 0, 1, 1])
  })

  it('reports the share of the candidate list, which is the number that is read', () => {
    const words = [word('A', ['x', 'y', 'z'])]
    // One word kept out of a starter list of four.
    expect(saturation(words, own, 4)[2]?.share).toBeCloseTo(0.25)
  })

  it('flattens once the families left add nothing', () => {
    const words = [word('A', ['x', 'y', 'z', 'spare'])]
    const steps = saturation(words, own, 1)
    expect(steps.at(-1)?.gained).toBe(0)
  })

  it('walks every family, so the tail of the curve is visible too', () => {
    const words = [word('A', ['x', 'y', 'z', 'w', 'v'])]
    expect(saturation(words, own, 1)).toHaveLength(5)
  })

  it('counts an unregistered source as its own family rather than throwing', () => {
    const throwing = (): string => {
      throw new RangeError('no registered source')
    }
    expect(saturation([word('A', ['x', 'y', 'z'])], throwing, 1)[2]?.kept).toBe(1)
  })

  it('takes a minimum other than three, for measuring what the rule costs', () => {
    const words = [word('A', ['x', 'y'])]
    expect(saturation(words, own, 1, 2)[1]?.kept).toBe(1)
  })

  it('has no curve for evidence with no attestations at all', () => {
    expect(saturation([{ word: 'A', attestations: [] }], own, 1)).toEqual([])
  })

  it('reports a share of zero rather than dividing by an empty starter list', () => {
    expect(saturation([word('A', ['x', 'y', 'z'])], own, 0)[2]?.share).toBe(0)
  })
})
