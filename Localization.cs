using System.Globalization;
using System.Reflection;
using System.Text.Json;
namespace AllaganLocalPlugin;

public static class Localization
{
 private static readonly Dictionary<string,Dictionary<string,string>> Strings=Load();
 private static Dictionary<string,Dictionary<string,string>> Load(){using var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("AllaganLocalPlugin.Localization.json")!;return JsonSerializer.Deserialize<Dictionary<string,Dictionary<string,string>>>(stream)!;}
 public static string Text(string? language,string key,params object[] args){
  var code=LanguagePolicy.Normalize(language)??"en";
  var value=Strings.TryGetValue(key,out var row)?row.GetValueOrDefault(code)??row.GetValueOrDefault("en")??key:key;
  return args.Length==0?value:string.Format(CultureInfo.InvariantCulture,value,args);
 }
 public static IEnumerable<string> AllText=>Strings.Values.SelectMany(x=>x.Values).Concat(LanguagePolicy.Names);
}
