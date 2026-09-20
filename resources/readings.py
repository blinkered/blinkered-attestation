"""
Turns Japanese text into the kana it is read as, one document per line.

Blinkered deals Japanese as kana tiles, but Japanese is written in kanji, so a corpus attests
nothing until it has been read aloud. Sudachi does that: it segments the text and reports each
token's reading in katakana, which Blinkered's own fold then turns into the hiragana its list is
written in.

SudachiDict-**small** on purpose. The core and full dictionaries add NEologd's entries, which
descend from Hatena's keyword list, whose terms grant hobby, academic and private use and refer
commercial use to Hatena case by case. That is not share-alike but it is just as blocking for a
shipped app, and it does not appear anywhere in the stated Apache-2.0. Small is UniDic alone,
under a plain BSD-3 grant, and it supplies every reading we need.

Reads `locator<TAB>text` on stdin, writes `locator<TAB>readings` on stdout, a line at a time.
"""

import sys

from sudachipy import Dictionary, SplitMode

# Particles, auxiliaries, punctuation and whitespace. None of them is a word a board can hold,
# and leaving them in would attest the commonest tiles in the language from grammar alone.
SKIP = {"助詞", "助動詞", "補助記号", "記号", "空白"}

# Sudachi refuses input over 49,149 bytes, and a Wikipedia article is several times that. The
# chunk is well under the limit because the boundary search may not find a break for a while,
# and because the limit is counted in bytes while the search works in characters.
CHUNK_BYTES = 20_000


def chunks(text: str):
    """Splits text at whitespace, near a size Sudachi will accept.

    Breaking mid-word would invent a reading for half a word, so the split hunts backwards for a
    space. Japanese often runs for a long way without one, so a chunk with no break in it is cut
    where it must be — losing at most the two tokens either side of the cut, out of thousands.
    """
    while text:
        if len(text.encode("utf-8")) <= CHUNK_BYTES:
            yield text
            return
        cut = CHUNK_BYTES // 3  # Worst case for UTF-8 Japanese: three bytes a character.
        space = text.rfind(" ", cut // 2, cut)
        at = space if space > 0 else cut
        yield text[:at]
        text = text[at:]


def main() -> None:
    # Mode C is the longest unit: 日本語 stays one word rather than becoming 日本 and 語. Mode A
    # is UniDic's short unit and reproduces exactly the 分か problem that made the OpenSubtitles
    # Japanese list unusable in the first place.
    tokenizer = Dictionary(dict="small").create()

    for line in sys.stdin:
        locator, _, text = line.rstrip("\n").partition("\t")
        if not text:
            continue
        readings = []
        for chunk in chunks(text):
            for token in tokenizer.tokenize(chunk, SplitMode.C):
                if token.part_of_speech()[0] in SKIP:
                    continue
                reading = token.reading_form()
                # A token Sudachi does not know comes back with no reading at all. Its surface
                # is not a reading and guessing one would attest a word nobody wrote.
                if reading:
                    readings.append(reading)
        sys.stdout.write(f"{locator}\t{' '.join(readings)}\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
