export { SOURCES, expandLocator, sourceFor, validateSourceId } from './registry.js'
export type { LocatorKind, SourceSpec } from './registry.js'

export {
  SAMPLES_PER_SOURCE,
  digestOf,
  formatEvidence,
  independence,
  parseEvidence,
} from './evidence.js'
export type { Attestation, EvidenceFile, WordEvidence } from './evidence.js'

export { MINIMUM_SOURCES, byRate, partition, rateOf } from './attest.js'
export { merge, scan } from './scan.js'
export type { Document, Hit, ScanResult } from './scan.js'
export {
  fileDocuments,
  gutenbergBody,
  tatoebaDocuments,
  tatoebaRows,
  wikiDocuments,
  wikiPages,
} from './readers.js'
export type { Partition, SourceTotals } from './attest.js'
