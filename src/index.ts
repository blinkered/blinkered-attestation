export { SOURCES, expandLocator, sourceFor, validateSourceId } from './registry.js'
export type { LocatorKind, SourceSpec } from './registry.js'

export { SAMPLES_PER_SOURCE, digestOf, formatEvidence, parseEvidence } from './evidence.js'
export type { Attestation, EvidenceFile, WordEvidence } from './evidence.js'

export { MINIMUM_SOURCES, byRate, independence, partition, rateOf } from './attest.js'
export { merge, scan } from './scan.js'
export type { Document, Hit, ScanResult } from './scan.js'
export {
  fileDocuments,
  crawlRows,
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
} from './readers.js'
export type { FamilyOf, Partition, SourceTotals } from './attest.js'

export { build } from './build.js'
export type { Built } from './build.js'

export { conform, shippedWords } from './conformance.js'
export type { Failure } from './conformance.js'
