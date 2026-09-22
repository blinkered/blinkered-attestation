# Where the work is

Operational state. The **findings** live in [README.md](README.md) and the **numbers** in
[LANGUAGES.md](LANGUAGES.md); this is the bit that goes stale.

## Thirteen are published and conforming; seven ship

|         |   words | coverage | was   | families | checkable | ships  |
| ------- | ------: | -------: | ----- | -------: | --------: | ------ |
| `de`    |  36,346 |    99.6% | 98.4% |       21 |        20 | yes    |
| `it`    |  40,702 |    99.4% | new   |        7 |         5 | **no** |
| `uk`    |  20,541 |    98.3% | new   |        6 |         4 | **no** |
| `ru`    | 371,579 |    87.6% | 81.2% |       10 |         8 | yes    |
| `id`    |  33,725 |    82.0% | new   |        6 |         4 | **no** |
| `pt-BR` | 153,146 |    76.5% | new   |        7 |         5 | **no** |
| `es`    | 145,334 |    72.1% | 63.9% |       25 |        24 | yes    |
| `fr`    | 103,417 |    71.8% | 66.9% |       17 |        16 | yes    |
| `en`    | 112,115 |    64.3% | 40.5% |       15 |        14 | yes    |
| `ko`    |  24,395 |    63.4% | 61.6% |       24 |        23 | yes    |
| `tl`    |  12,579 |    54.0% | 41.7% |       12 |        11 | yes    |
| `nl`    | 159,228 |    49.4% | new   |        7 |         5 | **no** |
| `ja`    |  40,571 |    21.2% | 18.1% |       13 |        12 | **no** |

**`was` is the morning of 2026-09-21, before any books; `new` is the second batch.** Every language reads the Internet Archive now. Two were
not reading it at all and said nothing: German declared its books inside the `LEIPZIG` array of
package-name strings, so the build asked for a collection called `lz:[object Object]`, skipped it
with a warning and reported 98.4% anyway; Tagalog declared no books source at all while its
downloader filled a directory nothing pointed at. `node scripts/cache.mjs --strict` is the check that catches
both, and it fails rather than prints. Comparing what a language declares against what its
evidence holds finds neither: a broken source **un-declares itself**, because `SOURCES` drops
anything whose path is missing, so there is nothing left to compare. The disk is the one record
the fault cannot erase.

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

## Nothing is running

The session that gathered all this ended on 2026-09-21. The downloaders, the watchdog and the
refold chain were all in its scratchpad and are gone with it. **Nothing is lost**: every language
is published, conforming and licensed, and the 9355 books already on the shelves are in the
shared cache, which is outside every repository.

To carry on gathering books for a language:

```
node scripts/archive.mjs <tag> <collection or query> <count>
```

`COLLECTIONS.md` in each language repository names the query its shelf came from; the `ia` source
in its `sources.mjs` has it under `from`. Books are exempt from retirement, so a shelf survives
`retire.mjs`. A refold after more books arrive is `node build.mjs && node conform.mjs && node
saturation.mjs && node collections.mjs` in the language repository, then push, then regenerate the
roll-up here — see [the rule for changing a language](README.md#the-rule-for-changing-a-language).

**Watch two things if you restart a downloader.** Check free disk against the download size first;
this cache reached 92GB once. And if you write a watchdog that restarts them, give it a read-back
check: one built with an associative array resolved every key to the last entry's value and
restarted three languages with Japanese's collection, putting 697 wrong-language books across
seven shelves. No published list was affected, because the legibility floor refused all of them.

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
