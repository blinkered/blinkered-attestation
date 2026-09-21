# Where the work is

Operational state, as of 2026-09-21. The *findings* live in README.md; this is the bit that goes
stale — what is built, what is running, and what to do next.

## Languages

| | candidates | kept | | committed | conforms |
| --- | --- | --- | --- | --- | --- |
| de | 36,493 | 35,725 | **97.9%** | yes | yes |
| ko | 38,467 | 17,465 | **45.4%** | yes | yes |
| es | 201,655 | 96,350 | 47.8% | **no** | yes |
| fr | 144,105 | 69,104 | 48.0% | **no** | yes |
| tl | 23,306 | 9,247 | 39.7% | yes | **NO — stale ids** |
| ja | 191,188 | 11,448 | 6.0% | no | needs fw2 + harvest |
| ru | 424,352 | — | — | no | building |
| en | 174,456 | — | — | no | not started |

## Nothing is pushed to github.com/blinkered yet

The org exists (`blinkered/blinkered` is public, `gh` is authed as nickmarden). Push was gated on
three things; two are done:

- **Harvest republication — FIXED.** `searched.tsv` used to store fetched page text, which would
  have republished newspapers. It now stores `url<TAB>WORD:count …`. Korean's was converted in
  place; German, French and Spanish harvests were written by the new script already. **Check any
  harvest file before pushing**: `awk -F'\t' '$2 !~ /:[0-9]+( |$)/' searched.tsv` must be empty.
- **Evidence sharding — BUILT** (`src/store.ts`), not yet applied. German's `ATTESTATIONS.tsv` is
  ~52MB, over GitHub's 50MB warning. `writeEvidence` shards automatically; `build.mjs` still
  writes a single file and should be switched to it.
- **Stale ids — tl OUTSTANDING.** Tagalog's evidence still uses pre-migration ids (`tlwiki`,
  `ebibletl`) and fails `conform`. Needs its sources re-fetched and a rebuild.

## Per-repo commands

Every `blinkered-dictionary-*` has the same scripts, copied from `template/`:

```sh
node check-dumps.mjs     # sizes of cached dumps against the server. run before building
node build.mjs           # writes ATTESTATIONS.tsv, words.txt, dropped.tsv
node harvest.mjs 250     # fetches publishers in DOMAINS, appends to searched.tsv
node saturation.mjs      # writes SATURATION.md from committed evidence
node verify.mjs --sample 10   # fetches cited pages and checks they hold the word
node conform.mjs         # words.txt says only what the evidence supports
```

Builds want `NODE_OPTIONS=--max-old-space-size=10240`. Dependencies are `link:` not `file:`, so
**rebuild `blinkered-attestation` (`pnpm typecheck`) after changing it** or the dictionary repos
read a stale `dist/`.

## The cache

`blinkered-attestation/.cache/raw`, symlinked as `.cache/raw` from every dictionary repo.
Gitignored. **Delete a language's dumps once its evidence is committed** — the disk filled once
already and cost several partial downloads.

`.cache/sudachi-venv` holds SudachiPy + SudachiDict-small for the Japanese readings pass
(`resources/readings.py`).

## Jobs that were running at compaction

Logs in `/tmp`; the task ids are gone, so check the logs and `ps`.

```
/tmp/ru-build.log      Russian build (424,352 candidates, slow)
/tmp/ja-harvest.log    Japanese harvest, 18 publishers
/tmp/fw2jpn.log        FineWeb-2 jpn_Jpan shard, 4.5GB
/tmp/fres.log          frwiki + eswiki re-download, for harvest rebuilds
/tmp/gut-more.log      remaining French Gutenberg + 9,000 English books
/tmp/{de,es,fr}-harvest.log
```

## What to do next, in order

1. **Rebuild fr and es with their harvests** once the dumps land. Both sat at 48% with five
   families; Korean's harvest took it from 6.8% to 45.4%, and fr/es harvests are already 3,000+
   and 4,300+ pages.
2. **Japanese**: rebuild once FineWeb-2 and the harvest are in. At 6.0% with three families it is
   where Korean was.
3. **English**: dumps are present and verified (enwiki 25.7GB, enwikisource 3.4GB). Not started.
4. **Tagalog**: re-fetch sources, rebuild, fix the stale ids.
5. **Switch `build.mjs` to `writeEvidence`** so German shards, then push everything.
6. Re-measure the common-tier cut before any of this reaches the game — `sources.mjs` carries
   Blinkered's old calibration, and `data/README.md` is explicit that skipping it is a silent
   fault rather than a loud one.
