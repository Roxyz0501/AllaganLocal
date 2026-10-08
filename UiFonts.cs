using Dalamud.Interface.ManagedFontAtlas;
using Dalamud.Plugin;
namespace AllaganLocalPlugin;

public sealed class UiFonts : IDisposable
{
 private readonly Dictionary<string,IFontHandle> handles=[];
 public UiFonts(IDalamudPluginInterface pi,string root){
  foreach(var region in new[]{"jp","kr","sc","tc"}){
   var file=Path.Combine(root,"fonts",region+".otf");
   handles[region]=pi.UiBuilder.FontAtlas.NewDelegateFontHandle(toolkit=>{
    if(toolkit is IFontAtlasBuildToolkitPreBuild build)build.Font=build.AddFontFromFile(file,new SafeFontConfig{SizePx=17});
   });
  }
 }
 public IDisposable Push(string? language)=>handles[language switch{"ko"=>"kr","zh-Hans"=>"sc","zh-Hant"=>"tc",_=>"jp"}].Push();
 public void Dispose(){foreach(var font in handles.Values)font.Dispose();}
}
