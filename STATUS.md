# Where the work is

Operational state. The **findings** live in [README.md](README.md) and the **numbers** in
[LANGUAGES.md](LANGUAGES.md); this is the bit that goes stale.

## Forty-four are published and conforming; twenty-one ship

|          |   words | coverage | families | checkable | ships    |
| -------- | ------: | -------: | -------: | --------: | -------- |
| `de`     |  36,349 |    99.6% |       21 |        20 | yes      |
| `it`     |  40,782 |    99.6% |        7 |         5 | yes      |
| `uk`     |  20,640 |    98.7% |        6 |         4 | yes      |
| **`cs`** |  21,486 |    97.7% |        7 |         5 | yes      |
| `fi`     |  42,730 |    96.9% |        7 |         5 | yes      |
| _`af`_   |  11,165 |    90.4% |        7 |         6 | pending  |
| `ru`     | 373,007 |    87.9% |       10 |         8 | yes      |
| _`mk`_   |  18,269 |    85.5% |       12 |        11 | pending  |
| `id`     |  34,539 |    84.0% |        6 |         4 | yes      |
| **`fa`** |  41,801 |    81.8% |        6 |         4 | yes      |
| `pt-BR`  | 157,040 |    78.4% |        7 |         5 | yes      |
| _`he`_   |  12,253 |    76.9% |        8 |         7 | pending  |
| **`ro`** | 142,067 |    75.9% |        7 |         5 | yes      |
| _`sr`_   |  82,665 |    75.5% |       12 |        11 | pending  |
| _`hy`_   |  14,076 |    72.8% |        8 |         7 | pending  |
| `es`     | 145,686 |    72.2% |       25 |        24 | yes      |
| `fr`     | 104,090 |    72.2% |       17 |        16 | yes      |
| _`vi`_   |  18,057 |    70.5% |       10 |         9 | pending  |
| _`no`_   |  27,849 |    67.7% |        6 |         5 | pending  |
| _`ka`_   | 109,205 |    66.7% |       10 |         9 | pending  |
| `en`     | 112,351 |    64.4% |       15 |        14 | yes      |
| _`ms`_   |   5,048 |    63.7% |       10 |         9 | pending  |
| `ko`     |  24,400 |    63.4% |       24 |        23 | yes      |
| _`ga`_   |   8,585 |    63.4% |       11 |        10 | pending  |
| _`eu`_   |   3,964 |    61.1% |       10 |         9 | pending  |
| **`pl`** | 330,328 |    60.7% |        7 |         5 | yes      |
| _`sw`_   |  16,691 |    57.6% |        9 |         8 | pending  |
| `tl`     |  12,579 |    54.0% |       12 |        11 | yes      |
| `ar`     | 346,516 |    52.7% |        6 |         4 | yes      |
| _`sl`_   | 136,507 |    52.0% |       17 |        16 | pending  |
| **`tr`** | 327,920 |    51.4% |        6 |         4 | yes      |
| `nl`     | 164,989 |    51.2% |        7 |         5 | yes      |
| _`lv`_   |  49,838 |    49.9% |       13 |        12 | pending  |
| _`is`_   |  33,777 |    49.2% |        6 |         5 | pending  |
| _`lt`_   |  97,922 |    48.3% |       13 |        12 | pending  |
| _`sk`_   | 138,362 |    48.1% |       21 |        20 | pending  |
| **`sv`** | 162,041 |    43.6% |        7 |         5 | yes      |
| _`cy`_   |  19,697 |    41.3% |        9 |         9 | pending  |
| _`bg`_   | 107,898 |    38.7% |       19 |        18 | pending  |
| **`hu`** | 459,813 |    35.5% |        7 |         5 | yes      |
| `ja`     |  40,810 |    21.3% |       13 |        12 | **held** |
| _`da`_   |  63,245 |    20.4% |        6 |         5 | pending  |
| _`pcm`_  |   3,293 |    20.1% |        5 |         4 | pending  |
| _`et`_   | 100,784 |    17.1% |       16 |        15 | pending  |

**Languages in bold are the third batch**, built on 2026-09-22 and blessed the same day: `cs`
`fa` `ro` `pl` `tr` `sv` `hu`. Each clears the usability floor on all three boards and deals a
first-run tour of common words. Japanese is the only language that does not ship, and that is a
decision rather than a queue; its own `status.json` says why.

**Languages in italics are the fourth batch**, being built on 2026-09-23 and published as each
finishes; none is blessed. Twenty-seven languages are in it: `hr` and `pcm` first, because
Nick's coworkers are Croatian and Nigerian, then `da` `no` `is` `et` `lv` `lt`, `sk` `sl` `bg`
`mk` `sr`, `el` `ca` `gl` `pt`, and `af` `sw` `ms` `eu` `cy` `ga` `he` `hy` `ka` `vi`.

**Twenty-two of the fourth batch are published so far**, all pending: `pcm` and `is`, the ten
smaller lists, `af` `sw` `ms` `eu` `cy` `ga` `he` `hy` `ka` `vi`, five Slavic ones, `sk` `sl`
`bg` `mk` `sr`, and five Nordic and Baltic ones, `da` `no` `et` `lv` `lt`. Danish and Estonian
sit low for Hungarian's reason: candidate lists of 310,000 and 589,000 words, mostly forms nobody
has written down three times. Estonian's ready-made families proved 2.8% on their own; ten
publishers, literary weeklies above all, took it to 17.1%. Serbian is built from Cyrillic sources alone, and Slovak's book shelf was screened
for Czech, which would otherwise pass the legibility floor against it. Afrikaans, Hebrew, Armenian and
Vietnamese come in above seventy percent on families nobody had tried for them: publisher harvests
and Internet Archive shelves weeded for the right language, because the Archive's language tags
are mostly wrong. Basque is built on candidates with their English taken out
(`candidates/eu/PROVENANCE.md`); Welsh and Swahili still carry English from their candidate lists,
roughly 150 and 60 words in the commonest three thousand, and want the same cleanup. Every list
built from here on carries its written forms, so Vietnamese ships A CÒNG and not ACÒNG.

**Naijá is the one to read.** `SCRIPTS.md` said attestation would not work for it, because its
commonest words are spelled as English. That turned out to be half right. A collection that is
partly English is fixable: `sources.mjs` admits a document only if it reads as Naijá, and the guard
admits none of 40 English, 20 German or 20 Spanish books or of 60 Igbo, Yoruba, Hausa and Italian
Wikipedia articles, and all 1,189 chapters of the Naijá Bible. Without it 429 more words ship, and
309 of those are English. What stands is English quoted inside a Naijá document: THE and WAS ship,
and whether they are Naijá words is a lexicographer's call, not an attestation one. The candidates
had no validator at all, so 20.1% is the rule doing the only filtering there is.

**What the third batch showed.** Turkish and Hungarian are the demonstration this project was
built to make. Hungarian dropped 835,248 of 1,295,061 candidates and Turkish 312,230 of 638,282,
in both cases with the same median word length on each side of the line: the rule did not cut long
words or rare ones, it cut forms a grammar permits that nobody has written down three times in
three independent places. Swedish's 43.6% is the same story in compounds. A dictionary can generate
all of these; only some of them have been used.

**`conforms` means the paperwork matches the goods** — the evidence parses, every source is
registered, every shipped word has evidence from three independent families, and every attestation
says where to look. It says nothing about whether a list _plays_; the usability floor answers
that, and all fourteen shipping lists have passed it.

## Fourteen ship; Japanese does not, for now

Nick's call: seven on 2026-09-21, the second batch of seven the same night after he verified the
usability floor, the minimum-W tests and the boards each one deals. Japanese is 21.3% and the only
language below fifty, and the reason is not that it needs more books.

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

## The book harvest is over, and it is finished business

Every downloader stopped on 2026-09-21. The second batch reached its 2,000-book ceiling and was
folded in at 00:22; the first batch had between 54 and 126 books that arrived after its last build,
and those were folded in on 2026-09-22. All fifteen repositories are clean, pushed and rolled up.

**What the last fold bought, and why it matters more as a finding than as words:**

```
ru  +1,428   es +352   en +236   ja +239   fr +673   de +3   ko +5
```

Korean gained five words from eighty books; German three from a hundred and twenty-one. **The book
families are saturated for the mature languages.** A language whose curve has already flattened
does not improve by downloading more of the same family, which is exactly what the chart's
"returns stop at" column has been saying. More Archive books is no longer where coverage lives; a
new family, or a language nobody has built yet, is.

Nothing here survives a reboot except what is committed, and everything is committed. The books
themselves stay in `../blinkered-cache/raw`, outside every repository.

## The last mile per language

1. **Not more books.** Every downloader has stopped and every book is folded in. The last harvest
   bought Korean five words and German three, so a language whose curve has flattened gains
   nothing from another thousand of the same family. What is left is a **new family** for the
   languages that stalled low, or a language nobody has built yet.
2. **Japanese is the thinnest at 21.3%, and books are not what is holding it back.**
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
