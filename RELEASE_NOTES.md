# Allagan Local 0.1.0.1

- 「起動」ボタンを「再起動」に変更。稼働中ならプラグイン自身が起動したサーバーを停止して再起動し、停止中なら起動します。
- 「読み込み時にサイトを起動」は引き続き初期状態でONです。通常はボタンを押す必要はありません。
- 他の方法で起動されたサーバーは勝手に停止しません。
- 移行用のbrowser-settings.jsonがある場合、新しいブラウザーにタグ・サブ番号・表示設定を引き継ぎます。既存設定は上書きしません。個人データは配布ZIPに含めません。

Release build: zero warnings/errors. Nine host lifecycle checks and packaged startup/settings-migration checks passed. Native in-game restart UI has not been exercised by automated testing. Existing data remains in the plugin configuration directory.

Requires Allagan Tools for inventory/gil data; AllaganMarket is additionally required for market sales history. Some descriptions and game item names remain Japanese.
