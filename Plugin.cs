using Roxyz0501.Dalamud.CommonUi;
using System.Diagnostics;
using System.Numerics;
using Dalamud.Bindings.ImGui;
using Dalamud.Game.Command;
using Dalamud.Plugin;
using Dalamud.Plugin.Services;
using Dalamud.Game;
using System.Text.Json;
namespace AllaganLocalPlugin;

public sealed class Plugin : IDalamudPlugin
{
 private readonly IDalamudPluginInterface pi;
 private readonly ICommandManager commands;
 private readonly Configuration config;
 private readonly SettingsStore settings;
 private readonly HistoryFiles historyFiles;
 private readonly IClientState client;
 private readonly DashboardHost host;
 private readonly UiFonts fonts;
 private readonly IPluginLog log;
 private readonly string data;
 private readonly CommandInfo command;
 private string? uiError;
 private bool visible,disposed;
 private string T(string key)=>Localization.Text(config.Language,key);
 public Plugin(IDalamudPluginInterface pi,ICommandManager commands,IPluginLog log,IClientState client)
 {
  this.pi=pi;this.commands=commands;this.log=log;this.client=client;config=SettingsStore.Load(Path.Combine(pi.GetPluginConfigDirectory(),"settings.json"),pi.GetPluginConfig() as Configuration??new());
  settings=new SettingsStore(Path.Combine(pi.GetPluginConfigDirectory(),"settings.json"),config);
  config.Language=LanguagePolicy.Resolve(config.Language,()=>client.ClientLanguage switch {ClientLanguage.Japanese=>"ja",ClientLanguage.English=>"en",ClientLanguage.German=>"de",ClientLanguage.French=>"fr",_=>null},()=>pi.UiLanguage);
  config.WebLanguageRevision??=Guid.NewGuid().ToString("N");settings.Mark(config);
  var root=pi.AssemblyLocation.DirectoryName!;
  fonts=new UiFonts(pi,root);
  data=string.IsNullOrWhiteSpace(config.DataDirectory)?Path.Combine(pi.GetPluginConfigDirectory(),"server-data"):config.DataDirectory;
  host=new DashboardHost(root,data,text=>log.Warning(text));
  historyFiles=new HistoryFiles(data);
  pi.UiBuilder.Draw+=Draw;pi.UiBuilder.OpenConfigUi+=Open;pi.UiBuilder.OpenMainUi+=Open;
  command=new CommandInfo((_,_)=>Open()){HelpMessage=T("command-help")};commands.AddHandler("/allaganlocal",command);
  client.Logout+=OnLogout;
  PublishLanguage();
  if(config.AutoStart)_=host.StartAsync();
 }
 private void OnLogout(int type,int code){settings.Flush();_=host.FlushAsync();}
 private void Open(){visible=true;historyFiles.Refresh();}
 private void PublishLanguage(){try{Directory.CreateDirectory(data);var file=Path.Combine(data,"ui-language.json");var temp=file+".tmp";var text=JsonSerializer.Serialize(new{language=config.Language,revision=config.WebLanguageRevision});if(File.Exists(file)&&File.ReadAllText(file)==text)return;File.WriteAllText(temp,text);File.Move(temp,file,true);}catch(Exception e){uiError="language-save-error";log.Error(e,"Failed to publish UI language");}}
 private void OpenLink(string url){try{Process.Start(new ProcessStartInfo(url){UseShellExecute=true});uiError=null;}catch(Exception e){uiError="browser-error";log.Error(e,"Failed to open browser");}}
 private void DrawSources()
 {
  ImGui.Separator();
  ImGui.TextUnformatted(T("ui.1"));
  ImGui.TextWrapped(T("ui.2"));
  DrawSource("InventoryTools","Allagan Tools");
  DrawSource("AllaganMarket","AllaganMarket");
  DrawSource("MarketLedger","Gil Ledger");
  ImGui.TextWrapped(T("ui.3"));
  ImGui.Separator();
 }
 private void DrawSource(string internalName,string name)
 {
  var installed=pi.InstalledPlugins.Where(p=>p.InternalName==internalName).ToArray();
  var plugin=installed.FirstOrDefault(p=>p.IsLoaded)??installed.FirstOrDefault();
  var status=plugin==null?T("ui.4"):
   plugin.IsLoaded?T("ui.5"):
   T("ui.6");
  ImGui.TextUnformatted(name);
  ImGui.PushStyleColor(ImGuiCol.Text,plugin?.IsLoaded==true?new Vector4(.45f,.9f,.65f,1):new Vector4(1,.76f,.4f,1));
  ImGui.TextWrapped(status+(plugin==null?"":"  v"+plugin.Version));ImGui.PopStyleColor();
 }
 private void OpenSite(){_=OpenSiteAsync();}
 private async Task OpenSiteAsync(){await host.StartAsync();if(!disposed&&host.Status=="Running")OpenLink(DashboardHost.Url+"?lang="+Uri.EscapeDataString(config.Language!));}
 private void Draw()
 {
  if(!visible)return;
  using var font=fonts.Push(config.Language);
  ImGui.SetNextWindowSize(new Vector2(640,550),ImGuiCond.FirstUseEver);
  if(ImGui.Begin("Allagan Local###AllaganLocalSettings",ref visible)){
   if(ImGui.BeginTabBar("tabs")){
    historyFiles.RefreshIfDirty();var snapshot=historyFiles.Snapshot;
    StandardHistoryFilesTab.Draw(new(T("history-tab"),T("history-count"),T("history-size"),T("history-directory"),T("history-open"),T("history-refresh"),T("history-scope"),T("history-note")),snapshot with{Scope=T("history-range"),Status=snapshot.Status=="Error"?T("history-error"):""},historyFiles.Refresh,path=>{try{if(Path.GetFullPath(path)!=Path.GetFullPath(data))throw new InvalidOperationException();Process.Start(new ProcessStartInfo(path){UseShellExecute=true});}catch{uiError="history-error";}});
    StandardPluginTabs.DrawStandardTrailingTabs(
     T("ui.7"),"settings",DrawSettings,
     T("language-tab"),DrawLanguageSettings,
     T("ui.12"),DrawSupport);
    ImGui.EndTabBar();
   }
  }ImGui.End();
 }
 private void DrawSettings(){
     if(ImGui.Button(T("open")+"###open"))OpenSite();
     if(ImGui.Button(T("ui.8")+"###restart"))_=host.RestartAsync();
     ImGui.SameLine();if(ImGui.Button(T("stop")+"###stop"))_=host.StopAsync();
     ImGui.TextWrapped(T("status."+host.Status));
     if(uiError!=null)ImGui.TextWrapped(T(uiError));
     if(SettingsStore.Recovered)ImGui.TextWrapped(T("settings-recovered"));
     if(settings.Error!=null){ImGui.TextWrapped(T("settings-error")+" "+settings.Error);if(ImGui.Button(T("history-refresh")+"###settings-retry"))settings.Retry();}
     DrawSources();
     var auto=config.AutoStart;if(ImGui.Checkbox(T("ui.9")+"###autostart",ref auto)){config.AutoStart=auto;settings.Mark(config);}
     ImGui.TextWrapped(T("ui.10"));
     var directory=config.DataDirectory;if(ImGui.InputText("##data",ref directory,2048)){config.DataDirectory=directory;settings.Mark(config);}
     if(ImGui.Button(T("ui.11")+"###save"))settings.Mark(config);
 }
 private void DrawLanguageSettings(){
     var changed=StandardPluginTabs.DrawLanguageSelector(T("language-label"),T("language-help"),config.Language!);
     if(changed!=null&&changed!=config.Language){config.Language=changed;config.WebLanguageRevision=Guid.NewGuid().ToString("N");settings.Mark(config);command.HelpMessage=T("command-help");PublishLanguage();}
     if(uiError!=null)ImGui.TextWrapped(T(uiError));
 }
 private void DrawSupport()=>StandardPluginTabs.DrawSupportContent(T("ui.12"),T("ui.13"),T("support-recipient"),T("support-button"));
 public void Dispose(){disposed=true;pi.UiBuilder.Draw-=Draw;pi.UiBuilder.OpenConfigUi-=Open;pi.UiBuilder.OpenMainUi-=Open;commands.RemoveHandler("/allaganlocal");client.Logout-=OnLogout;settings.Dispose();historyFiles.Dispose();host.Dispose();fonts.Dispose();}
}
