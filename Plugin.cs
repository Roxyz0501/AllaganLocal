using System.Diagnostics;
using System.Numerics;
using Dalamud.Bindings.ImGui;
using Dalamud.Game.Command;
using Dalamud.Plugin;
using Dalamud.Plugin.Services;
namespace AllaganLocalPlugin;

public sealed class Plugin : IDalamudPlugin
{
 private readonly IDalamudPluginInterface pi;
 private readonly ICommandManager commands;
 private readonly Configuration config;
 private readonly DashboardHost host;
 private bool visible;
 private static readonly string[] Codes=["ja","en","de","fr","ko","zh-Hans","zh-Hant"];
 private static readonly string[] Languages=["日本語","English","Deutsch","Français","한국어","简体中文","繁體中文"];
 private readonly string[] open=["サイトを開く","Open dashboard","Dashboard öffnen","Ouvrir le tableau de bord","사이트 열기","打开网站","開啟網站"];
 private int Lang=>Math.Max(0,Array.IndexOf(Codes,config.Language));
 private string T(params string[] text)=>text[Lang];
 public Plugin(IDalamudPluginInterface pi,ICommandManager commands,IPluginLog log)
 {
  this.pi=pi;this.commands=commands;config=pi.GetPluginConfig() as Configuration??new();
  var root=pi.AssemblyLocation.DirectoryName!;
  var data=string.IsNullOrWhiteSpace(config.DataDirectory)?Path.Combine(pi.GetPluginConfigDirectory(),"server-data"):config.DataDirectory;
  host=new DashboardHost(root,data,text=>log.Warning(text));
  pi.UiBuilder.Draw+=Draw;pi.UiBuilder.OpenConfigUi+=Open;pi.UiBuilder.OpenMainUi+=Open;
  commands.AddHandler("/allaganlocal",new CommandInfo((_,_)=>Open()){HelpMessage="Allagan Local dashboard settings"});
  if(config.AutoStart)_=host.StartAsync();
 }
 private void Open()=>visible=true;
 private void DrawSources()
 {
  ImGui.Separator();
  ImGui.TextUnformatted(T("データ取得元プラグイン","Data source plugins","Datenquellen-Plugins","Plugins sources de données","데이터 제공 플러그인","数据来源插件","資料來源外掛"));
  ImGui.TextWrapped(T(
   "所持品・所持金の取得には Allagan Tools が必要です。マーケット販売履歴を利用する場合は AllaganMarket も必要です。",
   "Allagan Tools is required for inventory and gil data. AllaganMarket is also required to use market sales history.",
   "Allagan Tools wird für Inventar- und Gil-Daten benötigt. Für den Marktverkaufsverlauf wird zusätzlich AllaganMarket benötigt.",
   "Allagan Tools est requis pour les inventaires et les gils. AllaganMarket est également requis pour l’historique des ventes.",
   "소지품과 길 데이터를 가져오려면 Allagan Tools가 필요합니다. 시장 판매 내역에는 AllaganMarket도 필요합니다.",
   "获取背包和金币数据需要 Allagan Tools。使用市场销售记录还需要 AllaganMarket。",
   "取得背包和金幣資料需要 Allagan Tools。使用市場銷售記錄還需要 AllaganMarket。"));
  DrawSource("InventoryTools","Allagan Tools");
  DrawSource("AllaganMarket","AllaganMarket");
  ImGui.TextWrapped(T(
   "導入済みでも、取得元でデータを記録・保存する必要があります。未導入・停止中でも保存済みの記録は閲覧できます。",
   "Source plugins must record and save data. Saved records remain viewable when a source is missing or stopped.",
   "Die Quell-Plugins müssen Daten aufzeichnen und speichern. Gespeicherte Daten bleiben auch ohne aktive Quelle sichtbar.",
   "Les plugins sources doivent enregistrer les données. Les données sauvegardées restent consultables sans source active.",
   "제공 플러그인에서 데이터를 기록하고 저장해야 합니다. 미설치 또는 중지 상태에서도 저장된 기록은 볼 수 있습니다.",
   "来源插件需要记录并保存数据。未安装或已停止时仍可查看已保存的记录。",
   "來源外掛需要記錄並儲存資料。未安裝或已停止時仍可查看已儲存的記錄。"));
  ImGui.Separator();
 }
 private void DrawSource(string internalName,string name)
 {
  var installed=pi.InstalledPlugins.Where(p=>p.InternalName==internalName).ToArray();
  var plugin=installed.FirstOrDefault(p=>p.IsLoaded)??installed.FirstOrDefault();
  var status=plugin==null?T("未導入","Not installed","Nicht installiert","Non installé","미설치","未安装","未安裝"):
   plugin.IsLoaded?T("導入済み・稼働中","Installed · running","Installiert · aktiv","Installé · actif","설치됨 · 실행 중","已安装 · 运行中","已安裝 · 執行中"):
   T("導入済み・停止中","Installed · stopped","Installiert · inaktiv","Installé · arrêté","설치됨 · 중지됨","已安装 · 已停止","已安裝 · 已停止");
  ImGui.TextUnformatted(name);ImGui.SameLine();
  ImGui.TextColored(plugin?.IsLoaded==true?new Vector4(.45f,.9f,.65f,1):new Vector4(1,.76f,.4f,1),status+(plugin==null?"":"  v"+plugin.Version));
 }
 private void OpenSite(){_=OpenSiteAsync();}
 private async Task OpenSiteAsync(){await host.StartAsync();if(host.Status=="Running")Process.Start(new ProcessStartInfo(DashboardHost.Url+"?lang="+Uri.EscapeDataString(config.Language)){UseShellExecute=true});}
 private void Draw()
 {
  if(!visible)return;
  ImGui.SetNextWindowSize(new Vector2(640,550),ImGuiCond.FirstUseEver);
  if(ImGui.Begin("Allagan Local###AllaganLocalSettings",ref visible)){
   if(ImGui.BeginTabBar("tabs")){
    if(ImGui.BeginTabItem(T("設定","Settings","Einstellungen","Paramètres","설정","设置","設定"))){
     if(ImGui.Button(open[Lang]))OpenSite();ImGui.SameLine();
     if(ImGui.Button(T("再起動","Restart","Neu starten","Redémarrer","다시 시작","重新启动","重新啟動")))_=host.RestartAsync();
     ImGui.TextWrapped(host.Status);
     DrawSources();
     var lang=Lang;if(ImGui.Combo("Language",ref lang,Languages,Languages.Length)){config.Language=Codes[lang];pi.SavePluginConfig(config);}
     var auto=config.AutoStart;if(ImGui.Checkbox(T("読み込み時にサイトを起動","Start on plugin load","Beim Laden starten","Démarrer au chargement","플러그인 로드 시 시작","加载插件时启动","載入插件時啟動"),ref auto)){config.AutoStart=auto;pi.SavePluginConfig(config);}
     ImGui.TextWrapped(T("既存データのフォルダー（空欄なら専用保存先）。変更後はプラグインを再読み込み。","Existing data folder (blank: plugin storage). Reload plugin after changing.","Datenordner (leer: Plugin-Speicher). Danach Plugin neu laden.","Dossier de données (vide : stockage du plugin). Rechargez après modification.","기존 데이터 폴더 (빈칸: 플러그인 저장소). 변경 후 다시 로드하세요.","现有数据目录（留空使用插件目录）。修改后重新加载插件。","現有資料目錄（留空使用外掛目錄）。修改後重新載入外掛。"));
     var directory=config.DataDirectory;if(ImGui.InputText("##data",ref directory,2048))config.DataDirectory=directory;
     if(ImGui.Button(T("保存","Save","Speichern","Enregistrer","저장","保存","儲存")))pi.SavePluginConfig(config);
     ImGui.EndTabItem();
    }
    ImGui.PushStyleColor(ImGuiCol.Text,new Vector4(1f,.78f,.3f,1));
    ImGui.PushStyleColor(ImGuiCol.TabHovered,new Vector4(.5f,.32f,.08f,1));
    ImGui.PushStyleColor(ImGuiCol.TabActive,new Vector4(.38f,.24f,.05f,1));
    var support=ImGui.BeginTabItem(T("支援","Support","Unterstützung","Soutien","후원","支持","支持"));ImGui.PopStyleColor(3);
    if(support){ImGui.TextUnformatted("Roxyz0501");ImGui.TextWrapped(T("支援は任意です。","Support is optional.","Unterstützung ist freiwillig.","Le soutien est facultatif.","후원은 선택 사항입니다.","支持完全自愿。","支持完全自願。"));if(ImGui.Button("Ko-fi / Roxyz0501"))Process.Start(new ProcessStartInfo("https://ko-fi.com/roxyz0501"){UseShellExecute=true});ImGui.EndTabItem();}
    ImGui.EndTabBar();
   }
  }ImGui.End();
 }
 public void Dispose(){pi.UiBuilder.Draw-=Draw;pi.UiBuilder.OpenConfigUi-=Open;pi.UiBuilder.OpenMainUi-=Open;commands.RemoveHandler("/allaganlocal");host.Dispose();}
}
