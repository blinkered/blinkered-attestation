# Candidates

The words worth looking up, one directory per language, and the queue of languages nobody has
looked anything up for yet.

These are the fifty-one lists Blinkered shipped before attestation existed: a frequency-ordered
corpus intersected with whatever dictionary could validate it. That is the method this repository
was built to replace, and these are still the best answer anybody has to the only question it
leaves open, which is **which words are worth asking about**. A build reads a list here and asks
three independent families whether each word is real. Nothing a list here says survives into a
`words.txt` except as a question that got answered.

## Why they moved

They used to live in `blinkered/packages/words/data/`, which is where the game reads the list it
plays against. That worked for exactly as long as the two were the same file.

They are not the same file any more. `blinkered` now borrows its lists back from the language
repositories, so a candidate list left in `packages/words/data/de/words.txt` would be overwritten
by German's own output, and the next German build would take its own output as its candidates.
German could then never gain a word: every build would ask about exactly what the last build
proved, and the several hundred words its drop list is still chasing would stop being asked about
at all. Nothing would fail. The coverage number would read 100% and mean nothing.

So the candidates live here, apart from the lists they judge, and a language is free to overwrite
its output without touching its input.

## Where a build reads them

`build.mjs` in each `blinkered-dictionary-*` still defaults to the old path. Until that default
is changed, point it here:

```sh
CANDIDATES=../blinkered-attestation/candidates/de/words.txt node build.mjs
```

The one-line fix, in each language's `build.mjs`:

```js
const CANDIDATES =
  process.env.CANDIDATES ??
  new URL(`../blinkered-attestation/candidates/${LANGUAGE}/words.txt`, import.meta.url).pathname
```

`template/build.mjs` wants the same change, so a language created after this does not inherit the
old path.

## What the licenses here do and do not do

Every directory keeps the `LICENSE` and `PROVENANCE.md` it arrived with, and twenty-five of these
lists are share-alike. That matters here and stops mattering at the repository boundary.

**It matters here** because these files are distributed, and the terms they came under are the
terms they are still under. Nothing about parking them in a different repository changes what
Blinkered owes their authors, which is why the paperwork travelled with the words rather than
being left behind as a detail of the old layout.

**It stops mattering downstream** because an attested list is not derived from them. SCHADE ships
in German because three independent collections were found to contain it, and a candidate list
saying SCHADE is a German word is what made anybody look. A citation is not a license grant and
it does not need to be one. That is the whole argument of this repository, and these files are
the thing it is an argument about.

## The eight with a repository

Their candidates are still read on every rebuild, so these are live inputs rather than history.

| | language | candidates | terms it came under |
| --- | --- | ---: | --- |
| `de` | Deutsch | 36,493 | `CC-BY-SA-4.0` |
| `en` | English | 174,456 | `MIT` |
| `es` | Español | 201,655 | `MPL-1.1` |
| `fr` | Français | 144,105 | `MPL-2.0` |
| `ja` | 日本語 | 191,188 | `CC-BY-SA-4.0` |
| `ko` | 한국어 | 38,467 | `CC-BY-SA-4.0` |
| `ru` | Русский | 424,352 | `BSD-3-Clause` |
| `tl` | Tagalog | 23,306 | `CC-BY-SA-4.0` |

## The forty-three with none

This is the TODO. Each of these is a language Blinkered is fully translated into, still offers
nothing to play, and has a candidate list ready for the day somebody registers sources for it.
Starting one is `template/` plus a `sources.mjs`; the expensive part is finding three families
that between them cover the register these candidates came from, which for most of them is film
subtitles.

| | language | candidates | terms it came under |
| --- | --- | ---: | --- |
| `af` | Afrikaans | 12,354 | `LGPL-2.1-or-later` |
| `ar` | العربية | 656,979 | `MPL-1.1` |
| `arz` | مصرى | 154,576 | `CC-BY-SA-4.0` |
| `bg` | Български | 279,165 | `LGPL-2.1-or-later` |
| `ca` | Català | 46,841 | `LGPL-2.1-or-later` |
| `cs` | Čeština | 22,001 | `CC-BY-SA-4.0` |
| `cy` | Cymraeg | 47,635 | `LGPL-3.0-or-later` |
| `da` | Dansk | 309,554 | `LGPL-2.1-or-later` |
| `el` | Ελληνικά | 257,014 | `MPL-1.1` |
| `et` | Eesti | 589,422 | `LGPL-2.1-or-later` |
| `eu` | Euskara | 7,417 | `CC-BY-SA-4.0` |
| `fa` | فارسی | 51,132 | `Apache-2.0` |
| `fi` | Suomi | 44,104 | `CC-BY-SA-4.0` |
| `ga` | Gaeilge | 13,545 | `CC-BY-SA-4.0` |
| `gl` | Galego | 34,583 | `CC-BY-SA-4.0` |
| `he` | עברית | 15,924 | `CC-BY-SA-4.0` |
| `hr` | Hrvatski | 341,040 | `SISSL` |
| `hu` | Magyar | 1,295,061 | `LGPL-2.1-or-later` |
| `hy` | Հայերեն | 19,341 | `CC-BY-SA-4.0` |
| `id` | Bahasa Indonesia | 41,132 | `LGPL-3.0` |
| `is` | Íslenska | 68,689 | `CC-BY-SA-3.0` |
| `it` | Italiano | 40,944 | `CC-BY-SA-4.0` |
| `ka` | ქართული | 163,684 | `MIT` |
| `la` | Latina | 32,765 | `CC-BY-SA-4.0` |
| `lt` | Lietuvių | 202,690 | `BSD-3-Clause` |
| `lv` | Latviešu | 99,801 | `LGPL-2.1-or-later` |
| `mk` | Македонски | 21,362 | `CC-BY-SA-4.0` |
| `ms` | Bahasa Melayu | 7,921 | `CC-BY-SA-4.0` |
| `nl` | Nederlands | 322,146 | `BSD-3-Clause` |
| `no` | Norsk | 41,122 | `CC-BY-SA-4.0` |
| `pcm` | Naijá | 16,394 | `CC-BY-SA-4.0` |
| `pl` | Polski | 544,157 | `MPL-2.0` |
| `pt` | Português | 134,775 | `MPL-1.1` |
| `pt-BR` | Português (Brasil) | 200,241 | `MPL-2.0` |
| `ro` | Română | 187,238 | `LGPL-2.1-or-later` |
| `sk` | Slovenčina | 287,672 | `LGPL-2.1-or-later` |
| `sl` | Slovenščina | 262,639 | `LGPL-2.1-or-later` |
| `sr` | Српски | 109,513 | `LGPL-2.1-or-later` |
| `sv` | Svenska | 371,287 | `LGPL-3.0` |
| `sw` | Kiswahili | 29,002 | `LGPL-2.1-or-later` |
| `tr` | Türkçe | 638,282 | `MIT` |
| `uk` | Українська | 20,903 | `CC-BY-SA-4.0` |
| `vi` | Tiếng Việt | 25,622 | `CC-BY-SA-4.0` |

**Candidate count is not a ranking.** It is the size of the dictionary that validated the corpus,
so Hungarian's 1,295,061 is a fact about agglutination and Basque's 7,417 is a fact about how
little Basque anybody has put in a spell checker. What a language is worth building is decided by
whether three families can be found for it, and nothing in this column predicts that.

## Why language-specific files are here at all

They should not be, by the rule in the root README: this repository holds the workflow and a
language repository holds its language. `LANGUAGES.md` and `curves.svg` are the stated exception,
and they earn it by being derived from every language at once.

This is a second exception and a weaker one. A candidate list belongs to its language and should
live in that language's repository, next to the evidence it produced. Forty-three of these
languages have no repository to live in, and a queue of work has to be somewhere somebody will
find it. The eight that do have one are here only so that all fifty-one stay together while the
other forty-three wait.

**So this directory should shrink.** When a language gets a repository, its candidates should go
with it, and this becomes what it is for: the list of languages nobody has started.
