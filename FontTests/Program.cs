using System.Reflection;
using AllaganLocalPlugin;
using Dalamud.Interface.ManagedFontAtlas;
using Dalamud.Bindings.ImGui;

var checks=0;
void Check(bool condition,string message){if(!condition)throw new Exception(message);checks++;}
foreach(var region in new[]{"jp","kr","sc","tc"}){
 var toolkit=DispatchProxy.Create<IBothPhases,ToolkitProxy>();
 var recorder=(ToolkitProxy)(object)toolkit;
 var file=Path.Combine("fonts",region+".otf");
 Check(toolkit is IFontAtlasBuildToolkitPreBuild && toolkit is IFontAtlasBuildToolkitPostBuild,"Both interfaces must exist on the same object");
 recorder.Step=FontAtlasBuildStep.PostBuild;
 UiFonts.ConfigureFont(toolkit,file);
 Check(recorder.Adds==0 && recorder.Sets==0,"PostBuild before initial build must not add or assign a font");
 for(var cycle=1;cycle<=3;cycle++){
  recorder.Step=FontAtlasBuildStep.PreBuild;
  UiFonts.ConfigureFont(toolkit,file);
  Check(recorder.Adds==cycle && recorder.Sets==cycle,"Each PreBuild must add and assign exactly one font");
  Check(recorder.File==file && recorder.Size==17,"Font file and size must be preserved");
  recorder.Step=FontAtlasBuildStep.PostBuild;
  UiFonts.ConfigureFont(toolkit,file);
  UiFonts.ConfigureFont(toolkit,file);
  Check(recorder.Adds==cycle && recorder.Sets==cycle,"Repeated PostBuild must not modify the built atlas");
 }
}
Console.WriteLine($"PASS: {checks} font lifecycle checks using actual Dalamud OnPreBuild and one object implementing both phase interfaces");

public interface IBothPhases:IFontAtlasBuildToolkitPreBuild,IFontAtlasBuildToolkitPostBuild{}
public class ToolkitProxy:DispatchProxy{
 public FontAtlasBuildStep Step;
 public int Adds,Sets;
 public string? File;
 public float Size;
 protected override object? Invoke(MethodInfo? method,object?[]? args){
  switch(method!.Name){
   case "get_BuildStep":return Step;
   case "AddFontFromFile":
    if(Step!=FontAtlasBuildStep.PreBuild)throw new Exception("Font addition outside PreBuild");
    Adds++;File=(string)args![0]!;Size=((SafeFontConfig)args[1]!).SizePx;return default(ImFontPtr);
   case "set_Font":Sets++;return null;
   default:throw new Exception("Unexpected SDK access: "+method.Name);
  }
 }
}
