# Where the work is

Operational state. The **findings** live in [README.md](README.md) and the **numbers** in
[LANGUAGES.md](LANGUAGES.md); this is the bit that goes stale.

## Fifteen are published and conforming; fourteen ship

|             |   words | coverage | families | checkable | ships    |
| ----------- | ------: | -------: | -------: | --------: | -------- |
| `de`        |  36,346 |    99.6% |       21 |        20 | yes      |
| **`it`**    |  40,702 |    99.4% |        7 |         5 | yes      |
| **`uk`**    |  20,541 |    98.3% |        6 |         4 | yes      |
| **`fi`**    |  42,609 |    96.6% |        7 |         5 | yes      |
| `ru`        | 371,579 |    87.6% |       10 |         8 | yes      |
| **`id`**    |  33,725 |    82.0% |        6 |         4 | yes      |
| **`pt-BR`** | 153,146 |    76.5% |        7 |         5 | yes      |
| `es`        | 145,334 |    72.1% |       25 |        24 | yes      |
| `fr`        | 103,417 |    71.8% |       17 |        16 | yes      |
| `en`        | 112,115 |    64.3% |       15 |        14 | yes      |
| `ko`        |  24,395 |    63.4% |       24 |        23 | yes      |
| `tl`        |  12,579 |    54.0% |       12 |        11 | yes      |
| **`nl`**    | 159,228 |    49.4% |        7 |         5 | yes      |
| **`ar`**    | 313,501 |    47.7% |        6 |         4 | yes      |
| `ja`        |  40,571 |    21.2% |       13 |        12 | **held** |

**Languages in bold are the second batch**, built on 2026-09-21 evening and blessed the same
night after the operator verified the usability floor, the minimum-W tests and the boards each
one deals. Japanese is the only held language; its own `status.json` says why.

**`conforms` means the paperwork matches the goods** — the evidence parses, every source is
registered, every shipped word has evidence from three independent families, and every attestation
says where to look. It says nothing about whether a list _plays_. Nothing has tested that yet.

## Seven ship; Japanese does not, for now

Nick's call, 2026-09-21. The seven are `de` 99.6%, `ru` 85.4%, `es` 70.9%, `fr` 68.4%, `ko` 63.1%,
`en` 61.7%, `tl` 53.9%. Japanese is 20.4% and the only one below fifty, and the reason is not that
it needs more books.

**`blinkered-dictionary-ja` stays published, conforming and building.** It is held back from the
app, not abandoned. Its numbers stay in `LANGUAGES.md` and on the chart, which is the honest
presentation of a language we can build but would not ship.

Its reader cannot produce compound words at all: `SudachiDict-small` has no compound entries, so
mode C has nothing to join, and Japanese vocabulary is largely compounds. The fix is measured and
parked. Mark a boundary where the reader currently drops a particle silently — without it, two
nouns either side of a particle look adjacent — then rejoin only within a boundary. That found
about 400 words across four pages that cannot be matched otherwise, at roughly a 10% per-join
error rate against a shuffled control, which the three-family rule largely absorbs. It needs
Japanese re-downloaded and re-read end to end, every collection through Sudachi, so it is a
deliberate rebuild rather than a refold.

## What this does not mean

**`conforms` is not `plays`.** The two are separate questions and only one of them is answered
here. Nick has since tested all eight against the word floor in `blinkered` and they pass
comfortably, so the recalibration this file used to warn about is not blocking. The warning is
kept only as the reason to re-test after a list moves a long way, which several did today.

## Running overnight, 2026-09-21

```
seven book downloaders        it uk fi id pt-BR nl ar, toward 2,000 books each
final-refold.sh               fires when they stop, folds the books into all
                              seven, pushes each, regenerates the roll-up
watch.sh                      five-minute ticks: disk, live work, and anything
                              in a batch log that reads like a failure
```

All of it lives in a session scratchpad and none of it survives a reboot. **Nothing is lost if it
dies**: every language is published, conforming, licensed and blessed, and the books already
gathered are in the shared cache outside every repository. A downloader that dies mid-run can be
restarted with the query in that language's `COLLECTIONS.md`, and a refold by hand is

```
node build.mjs && node conform.mjs && node saturation.mjs && node collections.mjs
```

then push, then regenerate the roll-up — see [the rule](README.md#the-rule-for-changing-a-language).

**Run the roll-up with a token.** `GITHUB_TOKEN="$(gh auth token)" node scripts/languages.mjs
--remote`. Unauthenticated it gets a 403 listing the organisation and refuses rather than
guessing, which is right but stops the run. The scheduled workflow already passes one.

## The last mile per language

1. **More books.** Every language gains from them and none has finished downloading. A refold is
   now seconds for all eight: English was the last holding its downloads, and retiring them freed
   32GB and turned an hour-long rebuild into a short one. Retire a language the moment it is
   pushed, not eventually.
2. **Japanese is the thinnest at 20.4%, and books are not what is holding it back.**
   `SudachiDict-small` has no compound entries, so mode C has nothing to join: 太平洋 reads as
   タイヘイ ヨウ, 日本語 as ニッポン ゴ, 大西洋 as オオニシ ヒロシ — a person's name. Compound
   nouns are a large share of Japanese and none of them can be matched. Rejoining adjacent tokens
   finds 535 more of our words across three pages against 1,375 matched as written, a 39% gain.
   That is the lever. It also changes what attested means for Japanese, because a join can
   manufacture a compound nobody wrote, so it is measured and not shipped. **The dictionary stays
   small**: `core_lex.csv` carries NEologd, which draws on Hatena's keyword list.
3. **Recalibrate**, then take the lists to `blinkered`.

## Book citations name the text, not the catalogue page

`https://archive.org/details/<id>` is the catalogue page and holds no word of the book, so every
book attestation pointing there would have failed verification for a reason that has nothing to do
with whether the sighting was real. A locator is now `<id>/<filename>`, percent-encoded because two
thirds of Archive filenames contain spaces and the evidence format spends spaces as separators.

Refolding is how a language picks the fix up. `ru` and `ko` have it; the second pass covers the
rest. To check whether a language still has the defect:

```
grep -o 'ia:[^ \t]*' <evidence> | grep -vc /      # anything but zero is the old form
```

## The cache

`../blinkered-cache/raw`, outside every repository. `node scripts/cache.mjs` says which language
each part belongs to; `node scripts/retire.mjs <lang>` deletes what a language no longer needs and
refuses unless its evidence records every collection's total. **Books are exempt from retirement**
while they are still being gathered.

`node weed.mjs` in a language repository removes books that are not in that language, by the same
legibility test the build applies. It refuses a language that reads through an analyser.
