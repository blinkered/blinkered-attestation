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

`.cache/raw` here, symlinked as `.cache/raw` from every dictionary repository. Gitignored.
**Delete a language's dumps once its evidence is committed** — the disk filled once already and
cost several partial downloads. `.cache/sudachi-venv` holds SudachiPy and SudachiDict-small for
the Japanese readings pass (`resources/readings.py`).

Disk is the binding constraint, not time: the cache runs to 79GB and the volume has under 20GB
free, which is why the German rebuild waits behind the Spanish and French ones.

## The build queue

Running unattended in `/tmp/run.sh`, ordered by what each build is worth. Each waits for its own
harvest to release `searched.tsv.harvesting`, and waits again if `build.mjs` refuses because a
dump is still downloading.

```
ko  16,800 words one family short — literary tier added, dumps re-downloading
ru  194,490 one family short, and only 2 of 4 families checkable
es  40,172 one family short
tl  also clears its stale source ids
ja  with FineWeb-2 and the Sudachi harvest
fr  de  en
```

Harvests run alongside, all with a literary tier: `/tmp/{de,en,es,fr,ja,ko,ru,tl}-harvest-v2.log`.

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
