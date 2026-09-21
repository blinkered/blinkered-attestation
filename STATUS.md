# Where the work is

Operational state. The **findings** live in [README.md](README.md) and the **numbers** in
[LANGUAGES.md](LANGUAGES.md); this is the bit that goes stale — what is running, what is queued,
and what to do next.

## Published

- `blinkered-attestation` — this repository.
- `blinkered-dictionary-de` — 35,725 words, 97.9% of its candidates, five families.
- `blinkered-dictionary-ko` — 17,465 words, 45.4%, twenty-three families.
- `blinkered-dictionary-ru` — 210,392 words, 49.6%, four families and still climbing.
- `blinkered-dictionary-fr` — 71,064 words, 49.3%, fourteen families, thirteen checkable.

All four are **public**, which is the stronger form of the claim: the evidence is there to be
argued with. The chart is served from this repository at
<https://blinkered.github.io/blinkered-attestation/> and redrawn every morning by
`.github/workflows/roll-up.yml`.

**Verified, not just conforming.** German proves 4 words of 4 with 35 pages held and nothing
contradicted; Korean 3 of 3 with 31 held. Both runs are reproducible with `pnpm verify --sample`.

Everything else is built but unpublished, or not built. [LANGUAGES.md](LANGUAGES.md) has the
current table; [the push rule](README.md#pushing-a-language) has what a language must clear
first.

## Known gaps, by language

- **de** — the harvest (1,990 pages across ten German publishers) is collected and committed but
  **not yet in the evidence**: the build finished forty minutes before the harvest did. German is
  at 97.9% without it, so this is a gain of at most a few hundred words and ten families on the
  curve, and it waits for the disk. Rebuilding needs `dewiki` re-downloaded.
- **tl** — fails `conform` on pre-migration source ids. `sources.mjs` is fixed (`wiki:tl`,
  `wikisource:tl`, `ebible:tglulb`) and it has 23 Filipino publishers harvesting now; needs a
  rebuild. Its FineWeb-2 shard is not downloaded, so it will rebuild one family short.
  **Must not be published until it conforms.**
- **fr** — its `searched.tsv` held **verbatim article text** for 1,744 of its 3,206 pages, written
  by the first version of the harvest. Converted in place to counts and checked: zero prose rows
  remain, all 3,206 pages kept. It was never pushed, so nothing was published. Rebuilding.
- **es** — building, with a clean 4,360-page harvest.
- **ja** — 6.0% from three families. Its first harvest read 1,324 pages and found 1,436 words,
  because the harvest matched text with a regular expression and the only thing that picks out of
  a Japanese page is the katakana in the navigation bar. It re-harvests through Sudachi now.
  FineWeb-2 `jpn_Jpan` is downloaded and waiting.
- **ru** — published at 49.6%, and its fourth family was still worth 36,739 words when it ran out.
  Twenty publishers harvesting now; a rebuild after that is the clearest remaining win.
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

`../blinkered-cache/raw`, **outside every repository** and symlinked in. It holds 87GB, which is
not something a source repository should appear to contain; `node scripts/cache.mjs` says which
language each part of it belongs to and what, if anything, is safe to delete.
**Delete a language's dumps once its evidence is committed** — the disk filled once already and
cost several partial downloads. `.cache/sudachi-venv` holds SudachiPy and SudachiDict-small for
the Japanese readings pass (`resources/readings.py`).

Disk is the binding constraint, not time: the cache runs to 79GB and the volume has under 20GB
free, which is why the German rebuild waits behind the Spanish and French ones.

## Recording totals, then deleting the collections

Every language's evidence is version 1 and records no token totals, so each needs **one more full
build** before its downloads can go. After that a build reuses the record and only scans what is
actually on disk.

Per language, in order:

```
node build.mjs        # full scan, writes #tokens
node conform.mjs
node saturation.mjs
node collections.mjs  # COLLECTIONS.md — the pointer back to every download
git commit && git push
                      # then, and only then, delete that language's files from ../blinkered-cache/raw
```

**Before deleting anything at scale, the round trip is proved on one language**: delete a single
collection, rebuild, and check the family and its attestations survive unchanged. The premise of
deleting ninety gigabytes is that the record is as good as the text; that is a claim to test, not
to assume.

Order: `de` (frees ~13GB) → `ru` (~12GB) → `fr` (~11GB) → `es` (~6GB) → `ko` (~6GB) → `tl`.
Japanese and English come last: Japanese because every collection goes through Sudachi, English
because its Wikipedia alone is 24GB and it has never been built at all.

## What to do next, in order

1. **Spanish**: building. Then French's rebuild, already queued behind it.
2. **Russian**: rebuild once its harvest finishes. Twenty publishers against four families.
3. **Tagalog**: rebuild once its harvest finishes, which also clears its stale ids.
4. **Japanese**: rebuild with FineWeb-2 and the Sudachi harvest.
5. **German**: rebuild with its harvest once there is disk for `dewiki`.
6. **English**: not started, dumps ready and verified.
7. **Re-measure the common-tier cut** before any of this reaches the game — `sources.mjs` carries
   Blinkered's old calibration, and `blinkered/data/README.md` is explicit that skipping it is a
   silent fault rather than a loud one.
