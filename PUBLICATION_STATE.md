# Publication state

## 2026-10-08 Allagan Local 0.1.0.1

- Release: https://github.com/Roxyz0501/AllaganLocal/releases/tag/v0.1.0.1
- ZIP: https://github.com/Roxyz0501/AllaganLocal/releases/download/v0.1.0.1/AllaganLocalPlugin-0.1.0.1.zip
- SHA-256: `5ACEE10D54FFB8B202BA09A5C6504AF2BA03ED438A660E82708A0616ED220FE0`.
- Startup remains enabled by default. Restart replaces only the owned server and also starts a stopped server. External processes remain untouched.
- Optional local browser-settings migration seed restores missing preferences; no private seed/data is distributed.
- Clean build, nine lifecycle checks, packaged startup and migration-preservation/cross-origin checks passed. Public ZIP hash/manifest verified. Native restart button has not been exercised in game.

2026-10-08: User requested public release of this standalone plugin.

Version 0.1.0.0 is prepared as an initial public preview. Clean Release build: zero warnings/errors. Six host lifecycle checks and packaged server/seven-language asset checks passed. Original website regression suite: 39 passed. No user data, histories, cached game assets or credentials are packaged.

In-game acceptance remains unverified and some detailed text is not translated; disclosed in README and release notes.

- Source: https://github.com/Roxyz0501/AllaganLocal
- Release: https://github.com/Roxyz0501/AllaganLocal/releases/tag/v0.1.0.0
- ZIP: https://github.com/Roxyz0501/AllaganLocal/releases/download/v0.1.0.0/AllaganLocalPlugin-0.1.0.0.zip
- Icon: https://raw.githubusercontent.com/Roxyz0501/AllaganLocal/main/images/icon.png
- Anonymous repository/icon HTTP 200 verified; icon content type image/png. Public ZIP matches SHA-256 `CAC3985CD433F1A8DADCAC90DFCB8AD6046BF95862481438C58BB256C4D6EBCF`.
- Packaged author, RepoUrl and IconUrl verified; no personal inventory/history/cache data. Shared-index registration published in `18bcc1658395cfd19a544dff033bf1f338f7203c`; anonymous commit-pinned index verified with all six entries. Normal main URL temporarily retained a cached five-entry response (max-age 300).
## 2026-10-08 Allagan Local 0.2.0.0 — published

- Seven-language interface completion, persisted initial language resolution, live Config-to-website synchronization, and bundled OFL font subsets.
- Clean Release: zero warnings/errors; 410 localization checks, 42 web tests and nine host lifecycle checks passed. Packaged startup/resources/migration checks passed.
- Native in-game UI acceptance remains unverified; documented in LOCALIZATION_IMPLEMENTATION.md and release notes.


- Release: https://github.com/Roxyz0501/AllaganLocal/releases/tag/v0.2.0.0
- ZIP: https://github.com/Roxyz0501/AllaganLocal/releases/download/v0.2.0.0/AllaganLocalPlugin-0.2.0.0.zip
- Source commit: `450260521c130dc75730732a27057c39a49ab173`. SHA-256: `80EACB814A60EFFC8FDC33D3125E28EC9DFC10B2A2DCC32FB0E6553F5D810C1F`.
- Anonymous repo/icon HTTP 200 (image/png); public ZIP hash and packaged metadata verified. Shared registration `1e165529bccec42614860284ef74397f6ce9655f` verified at both commit-pinned and normal main URLs (six entries, five other entries unchanged).

## 2026-10-09 Allagan Local 0.2.0.1 — local crash-fix preparation, not published

- Routes font additions through the real SDK OnPreBuild helper; the toolkit can implement both phase interfaces, so interface type tests are not phase checks.
- 44 real-SDK delegate lifecycle checks passed; the old implementation fails the same regression test. 410 localization checks and clean Release rebuild (zero warnings/errors) passed; isolated package validation passed.
- No installed DLL replacement, GitHub release, or shared index change. The public release remains 0.2.0.0. Native in-game startup/rendering are unverified.
- Prepared ZIP SHA-256: `3537016F371A047E54DE79E3A42F90F5DA69C68F5BA2A2C21F607E0B9BAC81A3`. Packaged DLL matches the fixed Release DLL; all four regional fonts retained.


## 2026-10-09 Allagan Local 0.2.0.1 — published

- User explicitly authorized publication. Release: https://github.com/Roxyz0501/AllaganLocal/releases/tag/v0.2.0.1
- ZIP: https://github.com/Roxyz0501/AllaganLocal/releases/download/v0.2.0.1/AllaganLocalPlugin-0.2.0.1.zip
- Source 33a5983; shared registration ee5098524dc99e270bb44b0ee17e0356f8c5d755.
- SHA-256: `3537016F371A047E54DE79E3A42F90F5DA69C68F5BA2A2C21F607E0B9BAC81A3`. Anonymous ZIP hash and repository/icon HTTP 200 verified. Shared commit-pinned URL verified: six entries, five other entries unchanged. Normal main URL still returned cached 0.2.0.0 at verification; installer visibility may be delayed by CDN caching.
- 44 font lifecycle checks, 410 localization checks, Release build zero warnings/errors and package checks passed. Native in-game startup remains unverified. Installed DLL was not replaced.


## 2026-10-11 Allagan Local 0.2.0.2

- Release: https://github.com/Roxyz0501/AllaganLocal/releases/tag/v0.2.0.2
- ZIP: https://github.com/Roxyz0501/AllaganLocal/releases/download/v0.2.0.2/AllaganLocalPlugin-0.2.0.2.zip
- Source 3b54367; SHA-256 `771AF4E1C8CE6CF7DEEC50088190863D01B0C54777BD5D052B8270BA47C57C5C`.
- Keeps server alive across plugin/game exit, reuses existing instance, writes logs independently of parent pipes. Fixes exclusive sidebar selection and stale history responses.
- 13 host checks including actual parent process exit/reuse, 43 Web checks, clean Release zero warnings/errors and packaged runner validation passed. Native in-game acceptance unverified.
- Public repository/icon HTTP 200 (image/png) and downloaded ZIP hash verified. Five other entries unchanged.

- Shared registration `89bda8d2eb1a77433f3100e5f5c0abda1601224a` verified at both commit-pinned and normal main URLs: HTTP 200, six entries, Allagan Local 0.2.0.2.


## 2026-10-11 Allagan Local 1.0.0.0

- Release: https://github.com/Roxyz0501/AllaganLocal/releases/tag/v1.0.0.0
- ZIP: https://github.com/Roxyz0501/AllaganLocal/releases/download/v1.0.0.0/AllaganLocalPlugin-1.0.0.0.zip
- Source `976f6d492286cdf882bc236c4a68a442479d0f1b`; SHA-256 `0C3D7A7975181825B085230AD22BF5119571F09296297BB3198A95E8EB6E5B34`.
- Canonical StandardPluginTabs.cs copied byte-for-byte; separate LanguageSettings and Support tabs. Saved language, migration, browser sync and persistent server preserved. No new data/API requests.
- 485 localization, 44 font, 43 Web and 13 host checks passed. 1,361 codepoints covered by four fonts. Release zero warnings/errors; package startup/manifest verified. Native in-game acceptance unverified.
- Public repository/icon HTTP 200 (image/png), downloaded ZIP hash verified. Only Allagan Local index entry changed; all other entries preserved.

- Shared registration `cd0374b415897d0137aa26f735208506e543a1f6` verified at the anonymous commit-pinned URL (HTTP 200, seven entries, all other six preserved). Normal main URL returned cached 0.2.0.2 at verification.

## 2026-10-12 local follow-up — not published

- Updated canonical StandardPluginTabs and routed Settings, Language settings, Support through one final DrawStandardTrailingTabs call. Existing visible order is unchanged.
- Canonical equality/order integration test passed, 485 localization checks passed, Release rebuild zero warnings/errors. No data access or Web changes. In-game rendering unverified.
- Public version and ZIP remain 1.0.0.0 without replacement. This change is pending a future release.


## 2026-10-12 Allagan Local 1.0.0.1

- Release: https://github.com/Roxyz0501/AllaganLocal/releases/tag/v1.0.0.1
- ZIP: https://github.com/Roxyz0501/AllaganLocal/releases/download/v1.0.0.1/AllaganLocalPlugin-1.0.0.1.zip
- Source 85d9aee; shared registration `1b04fe414fd37cebfe0956ce4e95860917295fa6`.
- SHA-256: `23FB31B1EFBC1245A78F4B1FAF00FF2147E2BE25CB7ED46D086DAA3B1242C387`.
- Canonical trailing tab helper and order integration test passed; 485 localization checks and Release build zero warnings/errors. Package startup/manifest/resources verified. Native in-game rendering remains unverified. Existing 1.0.0.0 asset unchanged.
- Public repo/icon HTTP 200 (image/png), downloaded ZIP hash verified. Connector and pinned public index show 1.0.0.1; normal main raw URL retained cached 1.0.0.0. All other index entries preserved.

## 2026-10-18 local history repair — not published

- Confirmed live money-history.json was truncated/zero-filled from byte 106,954,752 (28,962,265 zero bytes). The API reported history load failure and stopped capture. Exact cause of the on-disk corruption is unknown.
- Preserved original in server-data and ignored artifacts/history-repair-20261018. Explicit offline salvage recovered 24,827 complete series through October 15; merged the valid October 8 migration snapshot for missing series (31,806 total). Missing dates are not fabricated.
- Added flushed atomic history snapshots and one previous-generation backup (hard link on NTFS, flushed copy fallback). Startup can recover a valid backup while preserving damaged main. No unbounded backup rotation; corruption files are only created on actual recovery.
- Fixed aggregate timeline/daily mismatch when an entity has missing dates, included unchanged daily observations, and added previous-day starting balance to the intraday chart. Reused the JST date formatter.
- Removed internal item-owner and asset-summary series from history entity choices/API transfer.
- 48 Web tests passed; API integration rerun passed after response filtering. Actual plugin runtime patched locally and restarted (no old standalone server or autostart enabled). Public 1.0.0.1 asset is unchanged.
- Live APIs confirmed October 18 capture and restored previous-day comparisons on October 15 for retainers, lists and items. October 16–17 were not recorded, so October 18 comparison remains unavailable.
- Measured 8 history reads including repeat/navigation/concurrent requests: HTTP 200, no history-file writes, 190–385ms, 29–789KB per response. Current all-gil response 41.5KB; 18-day pre-filter response was 3.29MB (different date ranges, not a direct ratio). One backup exists. Goal: no writes on unchanged reads; no new DB/external calls. First startup recovery/changed inventory intentionally writes a snapshot; raw item-location detail remains a larger legacy response. Evidence in ignored repair artifact directory.

## 2026-10-18 Allagan Local 1.0.0.2 published

- Release: https://github.com/Roxyz0501/AllaganLocal/releases/tag/v1.0.0.2
- Source: 051e4a4d2385db2ce2b65d969b7ee6e32d9e7d33; shared index: db122e5e1d5c4a2c85f30f56a459135f7902334f.
- ZIP SHA-256: 35D3A5AFD690F2B18754768676F7DC97AB925618A59A14FC48AD3300C90D45CD.
- Release build: zero warnings/errors. 48 Web tests and subsequent API integration verification passed. Packaged server, seven dictionaries, fonts, isolated data, and 1.0.0.2 manifest verified.
- Anonymous repository HTTP 200, public ZIP download hash matches, commit-pinned public distribution index verified. Only AllaganLocalPlugin index entry changed; all other plugins retained. No private history or recovery artifacts included.
- A running older server may need a website restart after plugin update. Automatic recovery requires a valid backup; already-lost history is not reconstructed by installing this release.
