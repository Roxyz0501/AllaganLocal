# Allagan Local

Author: **Roxyz0501**. New standalone Dalamud plugin.

[日本語の導入案内](README.ja.md)

Starts the bundled local inventory website when the plugin loads. Use the plugin settings or `/allaganlocal` to open the dashboard. The browser opens only when you click **Open dashboard**. There are no scheduled Windows tasks and no polling console windows.

## Installation and data

### データ取得元の前提

- **Allagan Tools（InventoryTools）**：所持品・所持金データの取得に必要です。
- **AllaganMarket**：マーケット販売履歴を利用する場合に必要です。
- 設定の「データ取得元プラグイン」で、それぞれの **未導入／導入済み・停止中／導入済み・稼働中** とバージョンを確認できます。Dalamud の導入一覧から判定します。
- 導入だけでなく、取得元プラグインがデータを記録・保存している必要があります。停止中・未導入でも、過去の保存済みデータは閲覧できます。

Allagan Tools is a prerequisite for collecting inventory and gil data. AllaganMarket is additionally required for market sales history. Settings show each source's installed/running state and version using Dalamud's plugin inventory. Installation alone does not create saved data.

This is an initial public preview. In-game acceptance remains unverified. Install through the shared custom repository: https://raw.githubusercontent.com/Roxyz0501/DalamudPluginRepo/main/repo.json . For developer installation: Extract the complete ZIP into a dedicated directory and add `AllaganLocalPlugin.dll` through Dalamud's developer plugin settings. Do not copy the DLL alone: `web/` and `runtime/` are required. API level: 15; runtime: .NET 10 Windows. The official Node.js Windows x64 runtime and its license are bundled.

The default data directory is `server-data` under the plugin's configuration directory, separate from the installation. Updates do not replace it. On a fresh installation, open the website's Connection and data settings and update the item catalog. Allagan Tools must have saved inventories before inventory data is available. AllaganMarket is optional and supplies sales history.

To use an existing Allagan Local installation, enter its **data** directory in plugin settings, save, stop the standalone server, then reload the plugin. Do not point two servers at the same data directory. If the dashboard is already running on port 47831, the plugin reuses it without claiming ownership or stopping it when unloaded.

Start on plugin load is enabled by default. Restart stops and replaces the owned server, or starts it if stopped. Servers started externally are not terminated. The plugin stops its own child server on unload. Unexpected server exits are logged and retried after 5 seconds (up to 5 retries per plugin session). It only listens on loopback. Server output and errors are written to `dashboard.log` in the data directory. Market and Lodestone updates remain explicit website operations.

## Languages and tags

Interface language selector: Japanese, English, German, French, Korean, Simplified Chinese and Traditional Chinese. Plugin settings pass the preferred language when opening the website; the site also saves its selection. Some detailed help and errors still remain in Japanese. Game item names currently use the site's Japanese item catalog, independent of interface language. User-created names are not translated. This language support does not assert that the same Dalamud build runs on every regional game client.

Main characters are configured with the **Main** tag on each character's page. No specific character is built into the plugin. Tag ordering: Main, Alt (number order), Submarine, untagged. Multiple tags are allowed; Alt takes precedence over Submarine.

## Build

`dotnet build -c Release` requires the installed Dalamud API 15 development assemblies. Run `prepare-runtime.ps1` to download and checksum-verify the official Node.js x64 runtime, then run `package.ps1`. The packager uses an explicit allowlist and never copies site `data/`, histories, portraits, user configuration or logs. The complete website source is included in `web/`.

Source and issues: https://github.com/Roxyz0501/AllaganLocal . This preview has managed and local-server verification; in-game acceptance and complete translation coverage remain pending.

## Optional support

Support is optional: [Roxyz0501 on Ko-fi](https://ko-fi.com/roxyz0501).

See THIRD_PARTY_NOTICES.md for integration references and third-party terms.

Referenced integrations by Critical-Impact: [Allagan Tools](https://github.com/Critical-Impact/InventoryTools) (GPL-3.0), saved inventory CSV and character metadata; [CriticalCommonLib](https://github.com/Critical-Impact/CriticalCommonLib) (GPL-3.0), CSV layout and inventory category conventions; [AllaganMarket](https://github.com/Critical-Impact/AllaganMarket) (AGPL-3.0), saved sales records. Their plugin code and binaries are not bundled.
