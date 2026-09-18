import { describe, expect, it } from 'vitest'
import * as api from '../src/index.js'

/*
 * The barrel is the seam a dictionary repository imports through, so a rename that forgets to
 * update it is a broken consumer rather than a broken build here. Cheap to assert, and it is
 * the only thing that notices.
 */
describe('the public interface', () => {
  it('exports everything a dictionary repository builds against', () => {
    expect(Object.keys(api).sort()).toEqual([
      'MINIMUM_SOURCES',
      'SAMPLES_PER_SOURCE',
      'SOURCES',
      'build',
      'byRate',
      'conform',
      'digestOf',
      'expandLocator',
      'fileDocuments',
      'formatEvidence',
      'gutenbergBody',
      'independence',
      'leipzigLocators',
      'leipzigSentences',
      'merge',
      'parseEvidence',
      'partition',
      'rateOf',
      'scan',
      'shippedWords',
      'sourceFor',
      'tatoebaDocuments',
      'tatoebaRows',
      'validateSourceId',
      'wikiDocuments',
      'wikiPages',
    ])
  })
})
