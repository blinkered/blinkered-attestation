# Where the work is

Operational state. The **findings** live in [README.md](README.md) and the **numbers** in
[LANGUAGES.md](LANGUAGES.md); this is the bit that goes stale.

## Published

|      |   words | coverage | families | checkable |
| ---- | ------: | -------: | -------: | --------: |
| `de` |  35,895 |    98.4% |       20 |        19 |
| `ru` | 297,071 |    70.0% |       10 |         8 |
| `ko` |  23,433 |    60.9% |       24 |        23 |
| `en` |  70,673 |    40.5% |       16 |         — |
| `fr` |  71,064 |    49.3% |       14 |        13 |

All public, all conforming. `es`, `ja` and `tl` are not published; `tl` does not yet conform.

## What changed today, and why the numbers moved

**The collections became disposable.** The evidence records each collection's token total now,
which is the denominator every rate needs and the only thing that was forcing ninety-two gigabytes
of downloads to be kept. A build reads the evidence already present, scans only what is on disk,
and reuses the rest. German rebuilds from nothing in four seconds instead of twenty-six minutes,
and produces byte-identical evidence.

**Books were the missing family.** Every drop list said the same thing and it took too long to
hear it: the stranded words are attested by a Wikipedia and one other thing and need a third, and
for ABALANZAR and АБАЖУРАМИ that third is books. German has a Gutenberg shelf and sits at 98%;
Russian had none and sat at 51%. Scanned books from the Internet Archive took Russian to 70.0% and
Korean to 60.9%, in builds of twenty-eight and seven seconds.

The literary _harvest_ that preceded this rescued three percent of Russian's stranded words. The
archives that hold literature predate sitemaps and returned nothing, and half the domains that did
answer were book reviews — journalism in the register the newspapers already covered.

## Running

```
/tmp/watchdog.sh        checks every 60s, restarts crashes, leaves exhausted collections alone
/tmp/after-en.log       fr build, then es and tl
/tmp/ia-<lang>.log      seven book downloaders
/tmp/names-<lang>.log   backfilling text filenames for books fetched before names were recorded
```

## Next

1. **es** and **tl** full builds; `tl` needs its stale ids cleared, which a rebuild does.
2. **Refold books into `ru`, `ko`, `fr`, `en`** once their filenames are backfilled, so book
   citations name the text rather than the catalogue page. Seconds each.
3. **ja** last: every collection goes through Sudachi, including its books.
4. **Re-measure the common-tier cut** before any of this reaches the game. `sources.mjs` carries
   Blinkered's old calibration and `blinkered/data/README.md` is explicit that skipping it is a
   silent fault rather than a loud one.

## The cache

`../blinkered-cache/raw`, outside every repository and symlinked in. `node scripts/cache.mjs` says
which language each part belongs to; `node scripts/retire.mjs <lang>` deletes what a language no
longer needs, refusing unless its evidence records every collection's total, its repository is
clean, and `COLLECTIONS.md` exists.
