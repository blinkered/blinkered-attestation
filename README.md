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
dewiki:9912847 ->  https://de.wikipedia.org/?oldid=9912847
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
