# Purchase history / CSV verification — 2026-10-19

Implemented in the existing Allagan Local project. Published as 1.1.0.0; public ZIP and shared index verified on 2026-10-19.

## Behavior
- Gil Ledger (`MarketLedger/market-ledger.db`) is opened read-only in a worker, schema 1/2. Purchase filters, character detail entry, aggregate summaries and charts; excluded characters omitted. Unknown tax is not invented. JST dates use inclusive start / exclusive next-day midnight.
- CSV: current display columns, selectable/reorderable fields, multiple named browser-local presets (100 maximum). Current-page uses already loaded rows; complete filtered export loads bounded pages. Generated table snapshots expose current page only; complete storage and per-container sources are separately available.
- UTF-8 BOM, quoted values, formula escaping, 100-row writer chunks, streaming file writer where supported, 50 MiB bounded download fallback. Revision changes abort mixed-snapshot exports. Gil Ledger snapshot CSV uses a dedicated worker/read transaction and backpressure.

## Measured / tested
- Web tests: 49 passed; native Release build: 0 warnings, 0 errors.
- Fixture DB: first query 6 SELECTs, unchanged repeat + conditional request 0 additional SELECTs, page change 1 SELECT. DB writes 0. External write invalidates cache. Identical worker requests coalesce.
- Actual preview API: initial 200, 1,377-byte purchase body; conditional repeat 304, 0 bytes; CSV 200 / 1 purchase. Storage export page bounded at 500 rows, 10 pages for the tested owner scope. These are fixture/preview measurements, not large-production throughput estimates.
- Browser: purchase navigation and totals; changing character removes other character's rows; character detail opens purchase history with matching character selected. CSV defaults, column toggle/order, two named presets, reload and reapply verified. Checkbox alignment corrected after screenshot inspection.
- CSV writer tests verify BOM, quote escaping, displayed defaults, ordered rows, no extra fields, page filter preservation, zero reads for current page, and revision change rejection.
- OS save dialog itself was not completed through browser automation; writer correctness is covered by the file-writer adapter test and the real read-only CSV endpoint.

## Bounds / exceptions
- Purchase API returns at most 100 records; graph 366 buckets; character groups/options 1,000; world options 200. Cache: 12 entries / 8 MiB per map, 2 MiB per entry, 120 seconds; browser cache 12 / 8 MiB / 30 seconds; hidden-tab polling is disabled by the existing app poller.
- Full exports are user initiated. Complete filtered summaries aggregate in SQLite; no full purchase ledger is sent to the browser. Cached page changes reuse summaries. Existing source CSV inventories remain server-resident and storage exports page the response without new source-file reads.
- No migration or write to Gil Ledger data. No old standalone autostart created.

## Local application
- Backed up the installed 1.0.0.2 web/fonts under `artifacts/installed-backup-purchase-csv-20261019-045653`, then applied the verified website files to that installation.
- Plugin server on port 47831: purchase API 200, CSV module 200, exactly one installed-plugin server process (PID 53684 at verification). No standalone autostart enabled.
- Native DLL source now lists Gil Ledger in dependency status; it is built but not hot-replaced in the running game. That native settings addition will ship with the next plugin release.
- Production browser screenshot: `artifacts/csv-export-verified.png`. Browser saved presets remain local to their browser/origin.

## 1.1.0.0 publication follow-up
- Release preparation includes new export/error translations and localized CSV column headings, with 714 complete dictionary keys and 1,397 codepoints covered in all regional fonts.
- Shared publication rule requires release/ZIP/index verification; the prior local-only completion and unpublished installed-file overwrite were incorrect. Future updates follow publication before installation.

