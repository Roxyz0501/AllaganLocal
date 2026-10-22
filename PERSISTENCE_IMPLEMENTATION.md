# Persistence audit implementation — 2026-10-23

This implements the 2026-10-22 persistence audit for Allagan Local and the existing standalone inventory Web app. Shared specifications and templates were not edited. The original independent-plugin classification and explicit persistent-server exception remain unchanged.

## Storage and compatibility

- Normal history capture no longer calls the legacy whole-snapshot writer. `history-days/YYYY-MM-DD.sqlite` uses the event's JST date, FULL synchronous WAL transactions, immutable IDs, a single writer, and chunks of at most 500 events. A completed source refresh is the commit boundary. Concurrent capture requests coalesce into one running request plus a dirty flag; a failed batch retains its original timestamps/IDs for retry. Three consecutive failures pause writes.
- Legacy migration is restartable and deduplicates already committed chunks. It verifies per-series daily values and event counts before writing a flushed migration marker. Both original JSON and its backup remain untouched. No production migration was executed during this work.
- Startup reads latest indexed records per series, retaining only the latest change and the current/previous JST day for ordinary summaries. Detailed history loads the requested date range plus one preceding baseline per series, preserving differences across missing days. The period cache has four entries, a 16 MiB total limit, an 8 MiB entry limit and a two-minute TTL; commits invalidate it. All historical dates remain queryable. Deliberately requesting a very broad period still requires reading that period; this is not a claim of constant-time all-time aggregation. Startup enumerates date partitions and latest per-key rows once; this cost grows with retained dates/keys, not with all event payloads in memory.
- `history-store.mjs` retains whole-snapshot functions only for explicit offline legacy repair and its compatibility tests. The live server never calls them.
- Gil Ledger's retained SQLite DB is opened read-only and remains the preferred, fully paged source. A supplied daily-archive manifest resolves that compatibility DB. If it is absent, daily immutable JSON records can build a disposable read-only in-memory index in the existing worker. This fallback validates IDs and has a 100,000-record safety limit; larger archives require the retained compatibility DB and report an error rather than silently truncating. Archive snapshots refresh at most once per two minutes.

## Settings and lifecycle

- Native and Web settings apply immediately, save changed content on one 60-second scheduler, coalesce edits and avoid writes for unchanged/reverted content. A single writer stages and validates the new file and up to three valid backup generations. Main replacement occurs before staged backup promotion, so pre-commit failures do not rotate normal backups. Corrupt primary files are preserved before recovery from a valid backup. All-invalid generations cause an error instead of an empty replacement.
- Logout flushes native settings and requests an authenticated server flush. Plugin disposal drains that request, cancels/joins monitoring and releases HTTP clients, process wrappers, semaphore, fonts and event subscriptions. The independent server intentionally survives game/plugin exit.
- Explicit server stop refuses new work, closes HTTP acceptance, aborts/drains price jobs, waits for active requests/background operations and flushes settings/history before exit. Authenticated host-control requests retain local Host/Origin checks. Forced termination cannot guarantee callbacks or recover up to 60 seconds of unsaved settings.
- Existing 1.2 servers have no graceful-control endpoint. Stop one using the previous plugin's Stop action before upgrading; this release does not force-kill it to install a replacement.

## History files and disposable caches

- Canonical `StandardHistoryFilesTab.cs` is copied unchanged, before Settings/Language/Support. SHA-256: `5BD56A3F0CD79F58CD673282C353E44782F4B4522AD93D46910CEE81A4DCDC8E`.
- Native and browser totals include daily journals, migration marker, old JSON, backups, corrupt copies and DB sidecars under the history directory. External-plugin stores, settings, exports and disposable caches are excluded. Enumeration reads metadata only, uses one pending task and caches results; native invalidation uses filesystem events, Web invalidation follows history commits. Directories open only on explicit native clicks. Counts are exact logical file lengths, not physical SSD allocation or lifetime writes.
- Price cache changes are per-item SQLite upserts; unchanged quotes and failed targeted requests do not rewrite the existing cache. Initial legacy cache import is a one-time exception. Same-item requests remain bounded by four network workers. Stop cancels waits and joins active operations.
- Disposable media caches: at most 10,000 files / 256 MiB, up to 90 days by modification age. Item links: 20,000 / 16 MiB, same age. Cleanup runs only after cache writes and at most once an hour; active duplicate cleanups merge. Retry maps are bounded. Histories, settings and exports are never deleted as caches. Logs rotate at 2 MiB with three previous files.
- Seven-language History files text, settings recovery/errors and expanded CJK subsets were added. Four font subsets cover all 1,429 required codepoints with no missing glyphs.

## Verification and measurements

All tests use small synthetic records and temporary directories; no installed DLL, running production server or real history was changed.

| Check | Result |
| --- | --- |
| Allagan Web/API/history/CSV/common-tab regression | 62 passed |
| Native settings persistence | 8 passed |
| Host lifecycle / persistent server / reuse / stop | 14 passed |
| Localization policy, saved language, resource completeness | 680 passed; 42 complete keys |
| Real Dalamud font lifecycle harness | 44 passed |
| Existing standalone Web app regression final shared-module sync | 44 passed |
| Canonical History files template | byte-identical SHA-256 |

Synthetic checks cover JST rollover, late events, restart, migration repetition, after-commit fault/retry deduplication, three-failure pause and explicit recovery, unchanged saves, concurrent flush requests, edits during an in-flight flush, three backups, corrupt-primary recovery, failed pre-replacement generation preservation, end flush and no post-disposal saves.

Measured logical payloads (not SSD physical writes):

- Unchanged history/settings cycles: zero committed save operations and zero new payload bytes.
- Three-day, five-series synthetic history: old whole JSON = 10,123 bytes. A further one-series change = one transaction / one event / 145 new event-record bytes including its immutable ID. WAL pages, SQLite headers, metadata and filesystem amplification are excluded from this payload measure.
- One tiny history event: 134 event-record bytes including its immutable ID; the resulting closed daily SQLite file is 24,576 logical file bytes. Native/browser metadata accounting is tested separately from write volume.
- Seven native setting commits: 664 bytes of committed primary payload, 664 bytes of complete temporary payload writes, plus 1,406 bytes of backup copies. These categories overlap by design; primary payload is written via its temporary file. No-change startup/disposal adds zero commits. Failed temporary writes may still write bytes despite zero successful commits.
- An unchanged requested history period uses the bounded cache: zero additional DB rows read on the repeated request. Identical market quote refresh preserves cache metrics exactly. Read-only purchase queries remain six initial SQL reads, zero extra reads for an unchanged cached view, one page read for a new page, and zero writes to the source DB.

Release build/package verification results are recorded in publication state. In-game native rendering, real logout/game shutdown timing, real external network behavior, a 190 MB production migration, long-duration/SSD physical measurements and actual user update acceptance remain unverified. The approximately 190 MB audit observation was file metadata, not cumulative write measurement.
