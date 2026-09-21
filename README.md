# Blinkered attestation

How a Blinkered word list earns its words.

A word game needs a dictionary, and the obvious way to get one is to take somebody's. That is
what Blinkered does today: each of its fifty-one lists is a frequency-ordered corpus intersected
with a dictionary that validated it, and twenty-one of those lists therefore come out CC BY-SA,
inheriting terms from the only clean validator that existed for the language.

This repository is the other way round. A word ships because we can show it is real:

> SCHADE is in the German list because it occurs in three independent collections, at these
> documents. That is not the same as taking it from a dictionary.

Dictionaries still have a job — they supply **candidates**, the words worth looking up. What
earns a word its place is evidence, recorded per word, in a file anybody can argue with.

**[Where every language stands](LANGUAGES.md)** — coverage, families consulted, and all of their
saturation curves on one pair of axes.

## The rule

```
drop   iff  fewer than 3 INDEPENDENT sources attest the word
W tier iff  kept AND common enough by aggregate rate   (counts toward the board's word floor)
credit      everything else that was kept              (scores, never gates solvability)
```

**Independent means three different collections**, not three documents inside one. Three pages of
a single web crawl can easily be three mirrors of the same dictionary, and a rule that counted
them as three would certify exactly the words it exists to catch.

**Rarity never deletes.** A word three collections attest is real whether it is common or not.
How common it is decides only which tier it lands in. That separation is inherited from
Blinkered, where a frequency floor was tried and withdrawn because it rejected SWALE — an
ordinary English word with thirteen occurrences in a corpus of film subtitles. Thirteen
occurrences is a fact about films. Three collections is a fact about English.

## Three collections is not enough if they are the same collection

Learned on the first real build, and the most expensive thing to get wrong.

**Register** is the variety of language that suits a setting: formal or casual, written or
spoken, technical or everyday. Same language, different words. A collection of text is never a
neutral sample of a language — it is a sample of one register, and the words of the others are
simply not in it. No encyclopedia says goodbye; no 1890s novel mentions a homepage.

German was attested against Tatoeba, Project Gutenberg and Wikisource. Three genuinely separate
organizations, three separate downloads, and the rule passed: 83% of the list kept. The dropped
17% is what condemned it.

```
dropped words, by their rank in the corpus the candidates came from

  rank      0-5,000       82        OKAY(118)  DAD(366)  MOM(420)  KUMPEL(702)
  rank  5,000-10,000     248        TSCHÜSS(1060)  FOTOS(1251)  SEXY(2324)
  rank 10,000-20,000     881        FERNSEHER(2589)  PIZZA(2687)  KÜHLSCHRANK(3320)
  rank 20,000-50,000   4,672        HOMEPAGE  FITNESS  HYGIENISCH  FLUGZEUGTRÄGER
```

OKAY is the 118th commonest word in German. FERNSEHER and KÜHLSCHRANK are a television and a
refrigerator. None of them is rare, obscure or disputable, and all of them were dropped for want
of evidence.

The three collections were independent in every sense that licensing cares about and in none
that matters here. Gutenberg and Wikisource are both pre-1930s literature; Tatoeba is curated
teaching sentences. Nothing in that mix has ever written the word HOMEPAGE, so no amount of
volume would have helped.

**So a source has two jobs, and they are separate.** Independence makes the claim defensible:
three collections cannot be one dictionary wearing three hats. Register makes the claim
_correct_: the collections have to between them cover the kind of language the candidates come
from. Blinkered's German candidates were drawn from film subtitles, so the list is spoken,
colloquial and modern, and attesting it needs a source that is too.

Adding a fourth pre-1930s novel collection would satisfy the rule and change nothing. A modern
news and web collection was what OKAY needed.

**The check, therefore, is not the keep rate. It is reading the drop list.** A build that keeps a
plausible-looking 83% and drops PIZZA is a failed build, and only the drop list says so.

Adding two Leipzig collections — German news from 2024 and German web from 2021 — took the keep
rate from 83.0% to 93.3% and brought back sixteen of those seventeen words. Nothing about the
rule changed. The evidence did.

```
                            3 sources, one register    5 sources, three registers
  kept                      30,288  (83.0%)            34,061  (93.3%)
  OKAY, PIZZA, FERNSEHER    dropped                    kept
  TSCHÜSS                   dropped                    dropped, at two sources
```

TSCHÜSS is the shape of what remains: attested by Tatoeba and by 2024 news, and by nothing else,
because saying goodbye is not something an encyclopedia or a nineteenth-century novel does.

## Three collections, gathered by three different people

A refinement that only shows up once a language has more than a handful of sources, and which
would quietly have hollowed the rule out.

A Wikipedia and a Wikisource are two collections and one Wikimedia. Five years of Leipzig news
are five collections and one crawler. Counting those as three sightings lets a word ship on a
single organization's word, which is the thing the rule exists to prevent — so the count is over
**families**, not collection ids.

This is also the answer for a language whose every collection is a re-processing of the same web
crawl. Egyptian Arabic has three such collections and therefore one family, and it fails the rule
rather than passing it on a technicality.

## The last few hundred words

The bulk collections do the overwhelming majority of a language and then stop dead. What is left
is a few hundred perfectly ordinary words that an encyclopedia, a shelf of novels and a sentence
bank all happen not to contain — in German, the second-person verb forms and the colloquial
compounds: KLAUST, BLAMIERST, ANRIEFST, POTTHÄSSLICH, AUSZUFLIPPEN.

Those are found one at a time, by searching for the word and then **fetching the page and
checking it is really there**. A search engine saying a page holds a word is not the page holding
it. The harvest is a separate, deliberate step and the file it writes is committed, so the build
stays reproducible and offline and nobody re-runs thousands of searches to rebuild a list.

**It is cheaper than it looks.** Searching for two words returned five pages, and those five
pages attested ten of the words that were one family short — the eight others incidentally,
because a page containing one colloquial word contains others. At roughly five words a search,
a language's tail is a few hundred searches rather than a few thousand.

**A search hit attests but does not rank.** Its token total is an artefact of what was searched
for, so a rate taken against it would report the rarest words in the language as the commonest —
they are the only ones anybody looked for. Sources carry a `ranks` flag for exactly this.

**What it is not.** Fetching a page Common Crawl already crawled is a second act of verification,
not a second opinion: the gatherer differs and the publisher does not. For a rare word it is
genuine independence, because a crawl samples the web rather than exhausting it and a search
reaches pages it never captured. For a common one it is thinner than "three independent
collections" sounds. Worth knowing which of the two a language is leaning on.

## Where to find families

The ready-made corpora — a Wikipedia, a Gutenberg, a Tatoeba — are a small and arbitrary set, and
for most of the world's languages they run out fast. Korean has no Leipzig package, no Gutenberg
shelf and no eBible translation: three families, one of which is fifteen thousand sentences.

Treating that as the ceiling was a failure of imagination. Korean has newspapers, broadcasters,
literary archives, a parliament that publishes its proceedings and a government that publishes
its gazette, and under the family rule every one of those is an independent voice. The techniques
below are roughly in order of how much they return for the effort.

**Fetch a publisher directly.** Works for every language on earth and needs no corpus to exist.
Find a domain, read its sitemap or feed, fetch a few hundred pages, keep the text. Ten domains is
ten families — more than any language gets from the ready-made corpora put together. `fetch.ts`
does this, and does it slowly on purpose: robots.txt honoured, one request at a time with a pause
between, a user agent that says who we are, and a hard cap per host. We are a guest on somebody's
server, reading what they published, in order to cite them.

**OPUS is a dozen families, not one.** Its sub-corpora were gathered by unrelated people and only
share a distributor. For Korean alone: TED talks (15.6MB), QED educational subtitles (19.3MB),
Global Voices citizen journalism, Tanzil Quran translations, and KDE's software localization.
Five families from one site, for a language that looked like it had none.

**Software localization covers nearly every language.** GNOME, KDE, Mozilla, LibreOffice and
Ubuntu each translate into a hundred-odd locales, and each project is a separate family. The
register is narrow — menus, buttons, error messages — which makes it a poor primary source and a
perfectly good third opinion.

**Religious translations are a family with excellent locators.** eBible for Bibles, Tanzil for
Quran translations. Both are verse-addressed, so the locator is exact and permanent, and both are
gathered by people with no connection to any web crawl. The register is archaic-leaning, so they
add confidence rather than reach.

**National literary archives, where a language has one.** Aozora Bunko for Japanese (17,700 public
domain works, and its files carry human-supplied furigana — kana readings with no analyser in the
chain). Deutsches Textarchiv and Zeno.org for German. Gallica for French. Biblioteca Virtual
Miguel de Cervantes for Spanish. Lib.ru for Russian. These are Gutenberg's equivalents and nobody
thinks of them because Gutenberg is the one with the English name.

**What does not work, and why it keeps looking like it will.** A collection with no document
identifiers cannot attest anything, however much text it holds — CC-100 has 700MB of Tagalog and
not one URL in it. And a dataset that re-processes a crawl somebody else made is the same family
as the crawl: FineWeb-2, HPLT, mC4, CC-100 and NLLB are five datasets and one opinion.

## What decides a language's coverage

Four languages built, and the number that predicts coverage is not the number of families. It is
how big the candidate list is against how far the families reach.

```
              candidates   families   kept
  German          36,493      5        97.9%
  Spanish        201,655      5        47.8%
  French         144,105      5        48.0%
  Korean          38,467      3         6.8%
```

German and French have the same five families and differ by fifty points. The difference is that
German's starter list is 36,000 words and French's is 144,000 — four times as many, most of the
excess being inflected forms that only a very large corpus ever sees. French has two families big
enough to reach them, a Wikipedia and a Gutenberg, and three that are not: Leipzig at 50,000
words, Tatoeba at 55,000, a Bible at 15,000. Since a word needs three families, every word has to
pass through one of the small ones, and the small ones are the ceiling.

**So the lever is bigger families, not more of them.** A sixth small collection moves French by a
percent; one more collection the size of its Wikipedia would move it by tens. That is what makes
fetching publishers worth the afternoon — not because any one newspaper is large, but because
twenty of them together are, and each is a family in its own right.

Korean shows the same arithmetic at its limit: two families of thirty-four thousand words each and
a third of two thousand six hundred, so the list shipped two thousand six hundred.

## The evidence file

One per language, tab-separated, four columns: the word, the collections that attest it, how many
hits in each, and a sample locator or two per collection.

```
#blinkered/attestations/1 language=de words=2 sources=3 built=2026-09-18 digest=…
SCHADE	cc,dewiki,gut	412,88,7	cc:https://…/artikel dewiki:9912847 gut:21034
ABSEITS	cc,dewiki	130,12	cc:https://…/spiel dewiki:7740221
```

A locator is `<source>:<id>`, and `registry.ts` gives every source a URL template, so a short id
becomes a link somebody can open:

```
gut:21034      ->  https://www.gutenberg.org/ebooks/21034
dewiki:9912847 ->  https://de.wikipedia.org/?curid=9912847
cc:<url>       ->  the URL itself; a crawl has no durable per-document id
```

Sources are sorted and counts are written in the same order, so a rebuild over unchanged evidence
produces identical bytes and a diff means something really changed.

**One evidence file, or a directory of them, never both.** German's evidence passed sixty
megabytes once it had a harvest behind it, and GitHub warns above fifty a file. So `writeEvidence`
splits past forty megabytes into `attestations/000.tsv`, `001.tsv` and so on, each a complete and
independently valid evidence file with its own header and digest — a fragment that only parses
when reassembled would make a corrupt shard indistinguishable from a missing one. Readers go
through `readEvidence`, which refuses a repository holding both layouts rather than quietly
counting half its words twice.

## Checking a locator, and checking your check

Spot-checking the German evidence, `dewiki:2129` looked wrong: the page is the Hamburg article
and a search for `tschüss` found nothing, in the live page and in the revision current when the
dump was taken. It looked like the scanner had filed a word under the wrong page.

It had not. The Hamburg article says **tschüß**, in the orthography Germany reformed in 1996, and
German's fold maps ß to SS. Both spellings land on TSCHÜSS, which is correct — a word game deals
tiles, and those are the same tiles. The search was wrong, not the evidence.

This is the second time an ad-hoc check has been the error rather than the data; the first was a
case-sensitive search against a page that renders its text lower-cased. **Check a locator through
the fold, not by eye.** A spot check that does not know what the fold knows will keep reporting
faults that are not there, and the day it reports a real one nobody will believe it.

## Proving it

`verify.mjs` does what somebody who disbelieved us would do: take a word, expand each locator in
its evidence into a URL, fetch that URL, and look for the word on the page. Through the fold,
never by eye — a word ships under its folded key and almost never appears that way in print, and
checking by eye has produced two false alarms already.

The first real run, six Korean words, found something worth designing around:

```
3/6 words proved.  pages: 37 found, 3 absent, 6 unreachable

  wiki:ko, wikisource:ko, tat   every locator resolved and held its word
  fw2                           dead links and rewritten pages
```

**A citation to a stable id is permanent; a citation to a crawled URL decays.** A Wikipedia page
id, a Tatoeba sentence id and a Gutenberg ebook number will resolve in ten years. A URL taken
from a crawl was a snapshot of a page that has since moved, changed or gone — `book.daum.net`
and a LEGO product page were dead within a few years of being crawled.

That is a reason to prefer collections with durable identifiers where a language has them, and to
read a failed verification carefully: a page that will not load says nothing about the word,
while a page that loads without it is a finding.

## Pushing a language

A language repository becomes public when its **record is honest and checkable**, not when its
coverage is high. Those are different questions and conflating them would be the one mistake that
undoes the whole method: a thin language published with its thinness stated is fine, and a thick
one published with a claim its evidence cannot support is not fine at any coverage.

So the bar for publishing is:

1. **`node conform.mjs` passes.** The list ships only words the evidence supports, from registered
   sources, each with somewhere to look.
2. **No file is over the limit.** `writeEvidence` shards past 40MB; nothing tracked approaches
   GitHub's 50MB warning.
3. **Nothing republishes a source.** A harvest file records counts, never prose:
   `awk -F'\t' '$2 !~ /:[0-9]+( |$)/' searched.tsv` must print nothing.
4. **`SATURATION.md` is regenerated** from the committed evidence, so the curve describes the
   evidence actually in the repository.
5. **The roll-up here is regenerated too** — see the rule below.

Coverage gates something else entirely: whether a list is good enough to go into the game. That is
Blinkered's own question, answered by its board-density floor and its `everyLanguagePlays` test,
and a repository can be published long before its language is playable.

## The rule for changing a language

> **Any change to a `blinkered-dictionary-*` repository, before it is pushed, must also update
> the summary statistics in `blinkered-attestation` — and its workflow rules, if the change
> taught us something about the method.**

Both halves matter, and for different reasons.

**The statistics**, because a roll-up that lags is worse than no roll-up. [`LANGUAGES.md`](LANGUAGES.md)
and `curves.svg` are the only place anybody can see all fifty-one languages at once, and a reader
who finds them stale learns not to trust them — at which point the comparison they exist for stops
happening. They are generated, so keeping them current costs one command:

```sh
node scripts/languages.mjs        # every sibling repository
node scripts/languages.mjs de ko  # only these
```

It reads each `blinkered-dictionary-*` beside this one, measures its committed evidence with the
same code that language used, and writes `LANGUAGES.md` and `curves.svg`. Nothing in it is
authoritative: if it disagrees with a language repository, the language repository is right.

**The workflow rules**, because every hard-won fact in this README was learned in a language
repository and would have been lost there. The truncated dump that failed as a CRC error, the
harvest file that was quietly republishing newspapers, the saturation tie-break that made French
report a fifteen-thousand-word family ahead of a hundred-and-twenty-thousand-word one — each was
found while building one language and each applies to all of them. A fix that stays in the
repository where it was found is a fix the next language gets to discover again.

The test is simple: **if you learned it, it goes here; if you measured it, it goes there.**

## What lives where

- **`blinkered-attestation`** (here): the workflow. Source registry, locator scheme, evidence
  format, build tooling, and the conformance check. Nothing language-specific.
- **`blinkered-dictionary-<tag>`**: one repository per language, holding that language's
  evidence, its candidates, and its built list.
- **`blinkered`**: the game. Untouched until this model is proven.

The roll-up files here — [`LANGUAGES.md`](LANGUAGES.md) and `curves.svg` — are the exception that
proves the split: they are generated from the language repositories and are the only thing here
that is about particular languages. They are derived, never edited, and never authoritative.

Only the final evidence file is ever tracked. Downloaded dumps and per-source indexes live in an
untracked `.cache/`, because git history full of large regenerable files is the failure mode this
layout exists to avoid.

**A dump is not ready until its download has finished.** Obvious, and worth writing down because
it cost a twenty-minute build: a partial `.bz2` decompresses happily until it hits the end of what
has arrived, then fails as a CRC error that reads exactly like a corrupt file. Check the size
against the server's `content-length`, or wait for the download to report done — never judge by
the file existing and looking big enough.

**And the cache is deleted per language once its evidence is written.** The collections for one
language run to tens of gigabytes — a Wikipedia dump is 1GB for Korean and 24GB for English, and
a FineWeb-2 shard is 4.5GB apiece — so queueing six languages at once fills a disk, which is how
this rule was learned. The evidence file is the artifact and the dumps are regenerable, so a
language is scanned, its evidence committed, and its sources removed. A rebuild re-downloads,
which is the right trade: rebuilds are deliberate and rare, and the evidence they would produce
is already committed and checkable without them.

## Working on it

```sh
pnpm install
pnpm check      # typecheck, format, and tests at 100% coverage
```
