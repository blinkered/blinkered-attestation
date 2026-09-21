# Where the work is

Operational state. The **findings** live in [README.md](README.md) and the **numbers** in
[LANGUAGES.md](LANGUAGES.md); this is the bit that goes stale — what is running, what is queued,
and what to do next.

## Published

- `blinkered-attestation` — this repository.
- `blinkered-dictionary-de` — 35,725 words, 97.9% of its candidates, five families.
- `blinkered-dictionary-ko` — 17,465 words, 45.4%, twenty-three families.

All three are **private**. Going public is the stronger form of the claim and is the intent, but
it publishes the candidate lists too — the evidence records every candidate, including the ones
nothing attested, and those rows are somebody else's dictionary rather than our observation.
Worth a decision before the flip.

Everything else is built but unpublished, or not built. [LANGUAGES.md](LANGUAGES.md) has the
current table; [the push rule](README.md#pushing-a-language) has what a language must clear
first.

## Known gaps, by language

- **de** — the harvest (1,990 pages across ten German publishers) is collected and committed but
  **not yet in the evidence**: the build finished forty minutes before the harvest did. German is
  at 97.9% without it, so this is a gain of at most a few hundred words and ten families on the
  curve, and it waits for the disk. Rebuilding needs `dewiki` re-downloaded.
- **tl** — fails `conform`: its evidence still carries pre-migration source ids (`tlwiki`,
  `ebibletl`). Needs its sources re-fetched and a rebuild. **Must not be published until then.**
- **es**, **fr** — built at ~48% from five families, with harvests of 4,360 and 3,206 pages
  waiting to be folded in. Both need their wiki dumps back.
- **ja** — 6.0% from three families. Needs the FineWeb-2 `jpn_Jpan` shard (downloaded) and its
  eighteen-publisher harvest.
- **ru** — building; five collections scanned, FineWeb-2 to go.
- **en** — not started. `enwiki` (25.7GB) and `enwikisource` (3.4GB) are cached and verified.

## Per-repo commands

Every `blinkered-dictionary-*` has the same scripts, copied from `template/`:

```sh
node check-dumps.mjs     # sizes of cached dumps against the server. run before building
node build.mjs           # writes the evidence, words.txt, dropped.tsv
node harvest.mjs 250     # fetches publishers in DOMAINS, appends to searched.tsv
node saturation.mjs      # writes SATURATION.md from committed evidence
node verify.mjs --sample 10   # fetches cited pages and checks they hold the word
node conform.mjs         # words.txt says only what the evidence supports
```

And here, after any of those:

```sh
node scripts/languages.mjs   # regenerates LANGUAGES.md and curves.svg
```

Builds want `NODE_OPTIONS=--max-old-space-size=10240`. Dependencies are `link:` not `file:`, so
**rebuild this repository (`pnpm typecheck`) after changing it** or the dictionary repositories
read a stale `dist/`.

## The cache

`.cache/raw` here, symlinked as `.cache/raw` from every dictionary repository. Gitignored.
**Delete a language's dumps once its evidence is committed** — the disk filled once already and
cost several partial downloads. `.cache/sudachi-venv` holds SudachiPy and SudachiDict-small for
the Japanese readings pass (`resources/readings.py`).

Disk is the binding constraint, not time: the cache runs to 79GB and the volume has under 20GB
free, which is why the German rebuild waits behind the Spanish and French ones.

## What to do next, in order

1. **Spanish and French**, once their wiki dumps finish: rebuild with their harvests, regenerate
   curves, roll up, push. Both sit at 48% with five families; Korean's harvest took it from 6.8%
   to 45.4%.
2. **Japanese**: rebuild with FineWeb-2 and the harvest.
3. **Russian**: finish the build, measure, push.
4. **Tagalog**: re-fetch, rebuild, fix the stale ids, push.
5. **German**: rebuild with its harvest once there is disk for `dewiki`.
6. **English**: not started, dumps ready.
7. **Re-measure the common-tier cut** before any of this reaches the game — `sources.mjs` carries
   Blinkered's old calibration, and `blinkered/data/README.md` is explicit that skipping it is a
   silent fault rather than a loud one.
