/** Checks that what this repository ships is what its evidence supports. */
import { readFileSync } from 'node:fs'
import { conform } from '@blinkered/attestation'

const failures = conform(
  readFileSync('words.txt', 'utf8'),
  readFileSync('ATTESTATIONS.tsv', 'utf8'),
)
if (failures.length === 0) {
  process.stderr.write('conforms\n')
} else {
  for (const failure of failures) process.stderr.write(`FAIL ${failure.check}: ${failure.detail}\n`)
  process.exitCode = 1
}
