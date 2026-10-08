# Allagan Local 0.1.0.0 — Public preview

プラグイン読み込み時にローカルの所持品・所持金・販売履歴サイトを起動し、設定または `/allaganlocal` から開けます。

- データ取得には **Allagan Tools** が必要です。販売履歴を使う場合は **AllaganMarket** も必要です。取得元によるデータ保存が前提です。
- 設定で取得元の未導入／停止中／稼働中とバージョンを確認できます。
- 7言語の表示切替、メインキャラクターのタグ設定に対応しています。
- 個人データは同梱せず、保存先はプラグインの設定フォルダー内です。初回はサイト設定からアイテム辞書を更新してください。
- 既存サイトのデータを使う場合は、プラグイン設定の保存先を既存の data フォルダーに設定してください。
- Windowsの定期タスクを追加しません。サイトを既に起動している場合はそのサーバーを利用します。

**検証範囲**：Releaseビルド（警告・エラーなし）、サイト39テスト、サーバー起動・終了・復旧6チェック、配布パッケージの単独起動を確認済み。ゲーム内での実動作は未確認です。一部の説明・エラーとゲームアイテム名は日本語です。

Initial public preview. Requires Allagan Tools for inventory/gil collection and AllaganMarket for sales history. Source plugins must save data. In-game acceptance is unverified; some help/errors and game item names remain Japanese.

Shared custom repository: https://raw.githubusercontent.com/Roxyz0501/DalamudPluginRepo/main/repo.json

Author: Roxyz0501. Optional support: https://ko-fi.com/roxyz0501
