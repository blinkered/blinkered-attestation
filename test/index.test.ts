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
      'DISCOVERY_PATHS',
      'EVIDENCE_DIR',
      'EVIDENCE_FILE',
      'MAX_PAGES_PER_HOST',
      'MINIMUM_SOURCES',
      'POLITE_DELAY_MS',
      'SAMPLES_PER_SOURCE',
      'SHARD_BYTES',
      'SOURCES',
      'USER_AGENT',
      'allowed',
      'archiveUrl',
      'build',
      'byRate',
      'conform',
      'crawlRows',
      'digestOf',
      'disallowedPaths',
      'discover',
      'domainOf',
      'evidencePaths',
      'expandLocator',
      'feedLinks',
      'fileDocuments',
      'fineweb2Documents',
      'formatEvidence',
      'gutenbergBody',
      'harvestDocuments',
      'harvestSites',
      'harvestedPages',
      'httpGet',
      'independence',
      'isSitemapIndex',
      'leipzigLocators',
      'leipzigSentences',
      'merge',
      'pageHolds',
      'parseEvidence',
      'partition',
      'prove',
      'rateOf',
      'readEvidence',
      'readableText',
      'saturation',
      'scan',
      'scanByDomain',
      'shippedWords',
      'sitePages',
      'sitemapLinks',
      'sourceFor',
      'take',
      'tatoebaDocuments',
      'tatoebaRows',
      'validateSourceId',
      'verseDocuments',
      'versesByChapter',
      'wikiDocuments',
      'wikiPages',
      'withReadings',
      'writeEvidence',
    ])
  })
})
