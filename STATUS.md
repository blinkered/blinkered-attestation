# Where the work is

Operational state. The **findings** live in [README.md](README.md) and the **numbers** in
[LANGUAGES.md](LANGUAGES.md); this is the bit that goes stale.

## All eight are published and conforming

|      |   words | coverage | families | checkable |
| ---- | ------: | -------: | -------: | --------: |
| `de` |  35,895 |    98.4% |       20 |        19 |
| `ru` | 344,401 |    81.2% |       10 |         8 |
| `fr` |  96,387 |    66.9% |       17 |        16 |
| `es` | 128,809 |    63.9% |       25 |        24 |
| `ko` |  23,707 |    61.6% |       24 |        23 |
| `tl` |   9,716 |    41.7% |       11 |        10 |
| `en` |  70,673 |    40.5% |       14 |        13 |
| `ja` |  34,636 |    18.1% |       13 |        12 |

**`conforms` means the paperwork matches the goods** — the evidence parses, every source is
registered, every shipped word has evidence from three independent families, and every attestation
says where to look. It says nothing about whether a list _plays_. Nothing has tested that yet.

## What this does not mean, and must happen before the game

**The common-tier cut in every `sources.mjs` is Blinkered's old calibration**, against lists that
were a different size. `blinkered/data/README.md` is explicit that skipping recalibration is a
silent fault rather than a loud one: the word floor ends up above what any board can reach, every
draw is rejected, and the generator plays its best failed attempt while reporting failure. Some of
these lists moved thirty points today, so this is not optional.

```
pnpm dictionary weights   # paste into packages/engine/src/languages.ts
pnpm dictionary floor     # paste MEDIAN_WORDS, SHARE_BY_MINIMUM, DENSITY_SCALE
                          # into packages/engine/src/difficulty.ts
```

Then `packages/words/test/everyLanguagePlays.test.ts` is the guard that matters — three seeds per
language, each needing an accepted board with a six-tile word.

## Running in the background — all of this is in /tmp and will not survive a reboot

```
bash /tmp/watchdog.sh     every 60s: restarts a dead downloader with the right collection,
                          marks an exhausted one done, warns under 5GB disk
/tmp/refold.sh            refolds books into ru, ko, en and pushes; en in progress
/tmp/ia-<lang>.log        eight book downloaders
/tmp/names-<lang>.log     backfilling Archive text filenames
```

Rebuild them from this file if they are gone. Nothing is lost if they die — every language is
already published and conforming; the downloads only make the next refold better.

## The last mile per language

1. **More books.** Every language gains from them and none has finished downloading. A refold is
   seconds, because the evidence records what every other collection held.
2. **French** lost its shelf to a bug and is at ~90 books of 300. It will recover on its own.
3. **Japanese** is the thinnest at 18.1% and the most expensive to rebuild — every collection goes
   through Sudachi. Its books are worth the most per unit of work.
4. **Recalibrate**, then take the lists to `blinkered`.

## The cache

`../blinkered-cache/raw`, outside every repository. `node scripts/cache.mjs` says which language
each part belongs to; `node scripts/retire.mjs <lang>` deletes what a language no longer needs and
refuses unless its evidence records every collection's total. **Books are exempt from retirement**
while they are still being gathered.

`node weed.mjs` in a language repository removes books that are not in that language, by the same
legibility test the build applies. It refuses a language that reads through an analyser.
