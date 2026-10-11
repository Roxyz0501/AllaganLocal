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
 private readonly DashboardHost host;
 private readonly UiFonts fonts;
 private readonly IPluginLog log;
 private readonly string data;
 private readonly CommandInfo command;
 private string? uiError;
 private bool visible;
 private string T(string key)=>Localization.Text(config.Language,key);
 public Plugin(IDalamudPluginInterface pi,ICommandManager commands,IPluginLog log,IClientState client)
 {
  this.pi=pi;this.commands=commands;this.log=log;config=pi.GetPluginConfig() as Configuration??new();
  config.Language=LanguagePolicy.Resolve(config.Language,()=>client.ClientLanguage switch {ClientLanguage.Japanese=>"ja",ClientLanguage.English=>"en",ClientLanguage.German=>"de",ClientLanguage.French=>"fr",_=>null},()=>pi.UiLanguage);
  config.WebLanguageRevision??=Guid.NewGuid().ToString("N");pi.SavePluginConfig(config);
  var root=pi.AssemblyLocation.DirectoryName!;
  fonts=new UiFonts(pi,root);
  data=string.IsNullOrWhiteSpace(config.DataDirectory)?Path.Combine(pi.GetPluginConfigDirectory(),"server-data"):config.DataDirectory;
  host=new DashboardHost(root,data,text=>log.Warning(text));
  pi.UiBuilder.Draw+=Draw;pi.UiBuilder.OpenConfigUi+=Open;pi.UiBuilder.OpenMainUi+=Open;
  command=new CommandInfo((_,_)=>Open()){HelpMessage=T("command-help")};commands.AddHandler("/allaganlocal",command);
  PublishLanguage();
  if(config.AutoStart)_=host.StartAsync();
 }
 private void Open()=>visible=true;
 private void PublishLanguage(){try{Directory.CreateDirectory(data);var file=Path.Combine(data,"ui-language.json");var temp=file+".tmp";File.WriteAllText(temp,JsonSerializer.Serialize(new{language=config.Language,revision=config.WebLanguageRevision}));File.Move(temp,file,true);}catch(Exception e){uiError="language-save-error";log.Error(e,"Failed to publish UI language");}}
 private void OpenLink(string url){try{Process.Start(new ProcessStartInfo(url){UseShellExecute=true});uiError=null;}catch(Exception e){uiError="browser-error";log.Error(e,"Failed to open browser");}}
 private void DrawSources()
 {
  ImGui.Separator();
  ImGui.TextUnformatted(T("ui.1"));
  ImGui.TextWrapped(T("ui.2"));
  DrawSource("InventoryTools","Allagan Tools");
  DrawSource("AllaganMarket","AllaganMarket");
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
 private async Task OpenSiteAsync(){await host.StartAsync();if(host.Status=="Running")OpenLink(DashboardHost.Url+"?lang="+Uri.EscapeDataString(config.Language!));}
 private void Draw()
 {
  if(!visible)return;
  using var font=fonts.Push(config.Language);
  ImGui.SetNextWindowSize(new Vector2(640,550),ImGuiCond.FirstUseEver);
  if(ImGui.Begin("Allagan Local###AllaganLocalSettings",ref visible)){
   if(ImGui.BeginTabBar("tabs")){
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
     ImGui.TextWrapped(T("status."+host.Status));
     if(uiError!=null)ImGui.TextWrapped(T(uiError));
     DrawSources();
     var auto=config.AutoStart;if(ImGui.Checkbox(T("ui.9")+"###autostart",ref auto)){config.AutoStart=auto;pi.SavePluginConfig(config);}
     ImGui.TextWrapped(T("ui.10"));
     var directory=config.DataDirectory;if(ImGui.InputText("##data",ref directory,2048))config.DataDirectory=directory;
     if(ImGui.Button(T("ui.11")+"###save"))pi.SavePluginConfig(config);
 }
 private void DrawLanguageSettings(){
     var changed=StandardPluginTabs.DrawLanguageSelector(T("language-label"),T("language-help"),config.Language!);
     if(changed!=null&&changed!=config.Language){config.Language=changed;config.WebLanguageRevision=Guid.NewGuid().ToString("N");pi.SavePluginConfig(config);command.HelpMessage=T("command-help");PublishLanguage();}
     if(uiError!=null)ImGui.TextWrapped(T(uiError));
 }
 private void DrawSupport()=>StandardPluginTabs.DrawSupportContent(T("ui.12"),T("ui.13"),T("support-recipient"),T("support-button"));
 public void Dispose(){pi.UiBuilder.Draw-=Draw;pi.UiBuilder.OpenConfigUi-=Open;pi.UiBuilder.OpenMainUi-=Open;commands.RemoveHandler("/allaganlocal");host.Dispose();fonts.Dispose();}
}
