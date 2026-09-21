# What a script forces on a language, before any evidence is gathered

Salvaged from `blinkered/docs/LANGUAGES.md` before that file was cut back. Everything here was
measured rather than assumed, most of it the expensive way, and none of it is recoverable from
the attestation repositories themselves.

It matters here because **the fold is what turns text into a candidate key.** A scan reads a
document, folds every token, and asks whether the result is a candidate. So a fold decision made
for the game — which tiles exist, what folds onto what — silently decides what a collection can
attest. Get it wrong and a language does not fail: it quietly proves fewer words, or proves the
wrong ones, and the coverage number looks like a thin corpus.

Japanese is the worked example and it is in this repository's [STATUS.md](STATUS.md): its reader
cannot emit a compound, so compound nouns cannot be attested at all, and the language sits at 20%
looking like it needs more books. It does not need more books.

## Folds already decided, and what each cost

- **Korean** is an alphabet, not a syllabary: 한 is ㅎ + ㅏ + ㄴ and NFD says so. Tiles are the
  **compatibility jamo**, the ones on a keyboard, because Unicode gives ㄱ three code points
  (initial, final, letter) and a board showing two of them shows one letter twice. **Compound
  finals are two tiles each**, which was the decision initially got wrong: tiling them spends
  eleven of fifty-one tiles to reach 139 words of 19,242, three of the eleven reaching none, and
  it dropped board density from 95 to 62.
- **Japanese** folds voicing and kana size away — 47 tiles, not 84 — which is what もじぴったん
  and Japanese crossword convention both do, for the same reason: an eighty-four letter alphabet
  is not a harder puzzle, it is a worse one. Folding size does **not** merge きって with きて,
  because the mora survives. The fold is lossy, so Japanese alone has no `display`: かつこう
  could be がっこう or かつこう.
- **Hebrew** tiles the ordinary letter forms and puts the five final shapes back for display, as
  Hebrew Scrabble does. Without that every finished word was a letter wrong: שלומ for שלום.
- **Vietnamese** carries tone on the tile, eighty-nine of them, independently arriving at exactly
  Vietboard's set. Folding tone away buys forty words a board and charges 14% of the vocabulary:
  HOA, HOÀ, HOÁ, HOẠ, HOẢ, HÒA, HÓA, HỌA and HỎA are nine words that become one. **The space
  folds and is not a tile** — 82% of Vietnamese words contain one, and 36,353 words fold to
  36,341 distinct keys with only one real collision.
- **No digraph is ever a tile.** Welsh CH DD FF NG LL PH RH TH, Hungarian's nine, Tagalog's NG,
  Igbo's nine. Not a linguistic call: the keyboard matches a single code point, so a
  multi-character tile can only be taken with the mouse, and a board whose commonest letter
  cannot be typed is a worse game than one whose alphabet is a letter short.
- **Serbian is Cyrillic only.** The Latin spelling is the same words letter for letter, so it
  would be a second language rather than a second spelling.

## Tiles that spell nothing, which is always a fold bug

Each of these was a letter of the alphabet, present in the weights, that no word could use —
because the fold ate it. They are found by reading the shipped list, the only place the weights
and the fold meet.

- **Russian Й** is И plus a combining breve in NFD, so the default fold merged МОЙ into МОИ. Dealt
  at one draw in a hundred; not one word of 423,101 could spell it.
- **Estonian Š and Ž**, and **Finnish Å**, the same way. Å is _ruotsalainen O_, the Swedish O,
  appearing in Finnish only inside Swedish names.
- **Georgian upper-cases into a different script.** Unicode 11 gave Mkhedruli an upper case for
  headings, so `toUpperCase` produces ᲥᲐᲠᲗᲣᲚᲘ rather than ქართული. Georgian does not upper-case.
- **Turkish** upper-cases i to İ under its own locale, which took the wrong tile on a board
  holding both. Folding has to be locale-aware or it is wrong in exactly one language.

## What contaminates a corpus, which is this repository's problem directly

The old pipeline's worst bug was asking the wrong question of a dictionary: `titles(x)` asks
whether _x_'s Wiktionary has this page, and a Wiktionary documents every language, so the deep
tail of a corpus filled up with English. Seven languages shipped that way. BECAUSE, THROUGH,
THOUGHT and BEAUTIFUL were playable in Italian, German and Finnish; 10,051 of Vietnamese's 14,564
validated words were English.

Attestation does not have that bug, because it asks a collection rather than a lexicon. It has
the same bug wearing different clothes: **a collection may not be in the language it claims.**
That is what `legible = 0.35` and `weed.mjs` are for, and the failure mode is identical — the
list grows, nothing errors, and every derived number downstream inherits it. Italian's density
scale fell from 1.10 to 0.83 when the English came out; nothing about Italian had changed.

Two contamination guards worth stealing from elsewhere:

- **Ayò Ọ̀rọ̀**, the Yoruba Wordle, admits a word only if it carries at least one tone mark or one
  of ẹ/ọ/ṣ, and rejects any diacritic Yoruba does not use. That is pointed at exactly this hole.
- **Armenian is clean for a structural reason** rather than a careful one: English cannot be
  spelled in Armenian script. Where a script excludes the contaminating language, the problem
  does not exist; where it does not, assume it does.

## Languages where attestation will not work as written

- **Naijá (`pcm`)** is an English-lexifier creole whose commonest words after `di`, `wey`, `dey`,
  `na` and `dem` are `for`, `of`, `to`, `and`, `go` — spelled exactly as English. Twelve of
  fourteen English probes are playable as Naijá. **No collection can distinguish Naijá `go` from
  English `go`**, so three independent families attesting `go` prove nothing about Naijá. The
  distinction is usage, not spelling, and usage cannot be recovered without a lexicon;
  `Category:Nigerian Pidgin lemmas` has 188 entries and there is no Naijá Wiktionary. This is a
  sourcing problem, not a pipeline one.
- **The subdotted words in the Naijá list are leaked Igbo**, not Naijá: `asụsụ`, `ndị`, `akwụkwọ`,
  `ụdaume`, `mkpụrụedemede` — Igbo grammatical vocabulary quoted in pcm.wikipedia's articles
  about language. The corpus handed it another language; the fold was not throwing letters away.

## Decisions that must be taken before a list is built, not after

- **Diacritics in the West African languages.** Yoruba tone marks and subdots (ẹ ọ ṣ), Igbo
  ị ọ ụ ṅ, Hausa hooked ɓ ɗ ƙ ƴ. These cannot fold away: _owó_ (money) and _owo_ (hand) are
  different words. Undiacriticised writing is routine online, so any web or Wikipedia corpus
  mixes marked and stripped forms — folding merges distinct words, not folding splits one word
  into two rankings, and no later step can sort it out.

  The evidence, from people who shipped these games: **underdots are tiles, tone is not.** Yoruba
  has two published Wordles differing on exactly this axis and nothing else; the plain 26-tile
  one is presented as the game and the 45-tile toned one calls itself a beta and needs nine
  guesses rather than six. Both keep the underdot. Suggested: Yoruba 26 tiles, tone folded,
  underdots kept; Igbo the same shape but nobody has shipped it either way and its collisions are
  worse (unmarked `akwa` is four words); **Hausa has nothing to decide** — its hooks are letters
  like Danish Ø, so they are tiles, and the whole risk is corpus ASCIIfication.

- **Abugidas** — Hindi, Bengali, Marathi, Telugu — need a decision about what a tile _is_ before
  they need a word list. Splitting by code point puts a vowel sign that cannot stand alone on a
  tile of its own. Agreed as a hard problem, not a build step.
- **Urdu** needs Nastaliq to look right, a font decision on top of right-to-left.

## Two habits this file is really about

**Measure by building, not by arguing.** Tagalog was called a validator problem and was a corpus
problem: its subtitle corpus is 10,665 words, a tenth of Malay's, and no validator moves that.
Swahili was written off entirely in the first pass and ships above Turkish. Latin needed a cut
seven times deeper than anything else because its corpus's top ranks are inflections its lexicon
refuses.

**Open the browser on a new language.** Turkish's two bugs — the keyboard taking the wrong i, and
the wordmark reading BLİNKERED — were both found by playing it and neither by a green test suite.
The right-to-left work found the wordmark spelling DEREKNILB for the same reason.
