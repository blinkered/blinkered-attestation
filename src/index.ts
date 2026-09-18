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
export type { Partition, SourceTotals } from './attest.js'
