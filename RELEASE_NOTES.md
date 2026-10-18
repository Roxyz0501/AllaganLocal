# Allagan Local 1.0.0.2

- 履歴保存をディスクへの書き込み完了後に切り替える方式へ変更し、直前の正常な履歴を1世代保持。読み込み失敗時は正常なバックアップから復旧します。
- 記録がない対象を含む日の、日別合計と推移グラフの集計不一致を修正。
- 当日の推移グラフに前日の最終値を比較元として表示。
- 履歴の対象一覧から内部集計データを除き、不要な転送量を削減。

バックアップが存在しない破損済みの履歴や未記録の日は、自動復元できません。元ファイルは保持します。個人データ・復元済み履歴は配布物に含みません。

Requires Allagan Tools for inventory/gil data and AllaganMarket for market sales history. Restart the website after updating if an older server is still running.
