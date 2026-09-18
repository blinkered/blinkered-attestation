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

## What lives where

- **`blinkered-attestation`** (here): the workflow. Source registry, locator scheme, evidence
  format, build tooling, and the conformance check. Nothing language-specific.
- **`blinkered-dictionary-<tag>`**: one repository per language, holding that language's
  evidence, its candidates, and its built list.
- **`blinkered`**: the game. Untouched until this model is proven.

Only the final evidence file is ever tracked. Downloaded dumps and per-source indexes live in an
untracked `.cache/`, because git history full of large regenerable files is the failure mode this
layout exists to avoid.

## Working on it

```sh
pnpm install
pnpm check      # typecheck, format, and tests at 100% coverage
```
