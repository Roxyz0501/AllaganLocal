## 1.3.0.2 — Recovery and lifecycle recheck (2026-10-25)

- A lost legacy-migration marker can be rebuilt without rejecting newer appended history. Imported immutable IDs and full contents are checked; conflicting records are never silently accepted.
- A corrupt backup no longer blocks saving a valid current Web/native configuration. Healthy generations are retained and damaged backups are preserved separately.
- An old purchase worker's exit cannot reject a replacement worker's requests. Closed services reject new work immediately, and CSV readers report an unexpected normal worker exit instead of waiting forever.
- Corrupt disposable market-price SQLite/JSON caches are preserved and rebuilt, allowing the dashboard to start. Purchase/history source data is never rebuilt or deleted as a cache.
- Verified with synthetic records and isolated servers; no installed DLL, production data or running production site was changed. Details: RECHECK_2026-10-25.md.

## 1.3.0.1 — Sales card layout (2026-10-23)

- Sales cards keep the character/world on a dedicated first row and amount/count on a consistent second row. Long names show an ellipsis with full text on hover; financial values and counts remain visible.
- Nested retainer and purchase-summary buttons use the same layout, with an intentional stacked layout in narrow containers.
- Headless Edge verified 15 theme/viewport combinations (1920, 1280, 768, 390 and 320 px; dark, green and light), equal summary heights and no clipped financial values or horizontal overflow. Four sales/purchase UI/data regression tests passed. No production data or installed DLL was changed.

## 1.3.0.0 — Persistence audit fixes (2026-10-23)

- JST daily SQLite journals append only changed history events; idempotent legacy migration preserves originals. Range reads and a bounded period cache replace full-history startup expansion.
- Settings apply immediately and save changed content every 60 seconds, flush on logout/disposal, keep three validated backups and recover corruption. Three consecutive failures pause saving with retry.
- Canonical History files tab and browser totals report exact logical file sizes and scope in seven languages.
- Price cache saves dirty item rows, reuses identical quotes, and stops/drains work on server shutdown. Disposable media/link caches and logs have size/age limits.
- Gil Ledger compatibility DB and daily archives are readable. Plugin disposal leaves the independent server running while releasing host resources.
- Synthetic data only; installed DLL and production history were not changed. Live-game shutdown/UI integration remains unverified. Full details: PERSISTENCE_IMPLEMENTATION.md.
- Before upgrading a running 1.2 server, stop it using the previous plugin's Stop button. The old server has no authenticated graceful-control endpoint. This release does not force-kill it or migrate data in the running installation.

# Allagan Local 1.2.0.0

- ロドストからジョブ・レベル一覧を取得。「通貨・トークン」の上に簡潔な一覧を表示。
- キャラクター一覧に「カンスト:n」タグを追加（バトルジョブのみ）。「ロドスト情報を更新」で取得します。
- リテイナー、キャラクター所持品、チョコボかばんの親プルダウンに枠数・数量を表示。
- リテイナーの保管者表記を「リテイナー名 - キャラクター名 @ サーバー名」に変更。
- 設定に「サイトを終了」を追加。既に起動中の同プラグインのサーバーを検証して引き継ぎ、終了・再起動できるように変更。

ジョブデータはロドストの反映時点の情報です。更新失敗時は前回の成功データを維持します。プラグイン更新後にサイトを再起動してください。
