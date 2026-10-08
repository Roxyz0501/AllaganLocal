using AllaganLocalPlugin;
using System.Text.Json;
using System.Text.RegularExpressions;
var count=0;
void Check(bool pass,string name){if(!pass)throw new Exception(name);count++;}
foreach(var code in LanguagePolicy.Codes)Check(LanguagePolicy.Normalize(code)==code,code);
foreach(var pair in new Dictionary<string,string>{{"JA_jp","ja"},{"en-GB","en"},{"de-DE","de"},{"fr-fr","fr"},{"ko_KR","ko"},{"zh-CN","zh-Hans"},{"zh-SG","zh-Hans"},{"zh-TW","zh-Hant"},{"zh-HK","zh-Hant"},{"zh-MO","zh-Hant"},{"zh-Hans-TW","zh-Hans"},{"zh-Hant-CN","zh-Hant"}})Check(LanguagePolicy.Normalize(pair.Key)==pair.Value,pair.Key);
foreach(var value in new string?[]{null,"","Auto","zh","unknown"})Check(LanguagePolicy.Normalize(value)==null,"invalid "+value);
Check(LanguagePolicy.Resolve(null,()=>"ja",()=>"en")=="ja","game wins");
Check(LanguagePolicy.Resolve("en",()=>throw new Exception(),()=>throw new Exception())=="en","saved English preserved without lookups");
Check(LanguagePolicy.Resolve("ja",()=>"en",()=>"fr")=="ja","legacy Japanese preserved");
Check(LanguagePolicy.Resolve(null,()=>throw new Exception(),()=>"fr")=="fr","failure falls through");
Check(LanguagePolicy.Resolve(null,()=>"zh",()=>"zh-TW")=="zh-Hant","ambiguous Chinese falls through");
Check(LanguagePolicy.Resolve("auto",()=>"unknown",()=>"zh")=="en","final English fallback");
foreach(var code in LanguagePolicy.Codes){var saved=LanguagePolicy.Resolve(code,()=>"ja",()=>"en");var json=JsonSerializer.Serialize(saved);Check(LanguagePolicy.Resolve(JsonSerializer.Deserialize<string>(json),()=>"fr",()=>"de")==code,"restart/character switch "+code);}
var rows=JsonSerializer.Deserialize<Dictionary<string,Dictionary<string,string>>>(File.ReadAllText(args[0]))!;
foreach(var language in new string?[]{null,"ja","en","Auto","bad","ko"}){
 var config=JsonSerializer.Deserialize<Configuration>(JsonSerializer.Serialize(new{Version=1,Language=language,DataDirectory="D:/Existing/data",AutoStart=false}))!;
 config.Language=LanguagePolicy.Resolve(config.Language,()=>"de",()=>"fr");
 var restored=JsonSerializer.Deserialize<Configuration>(JsonSerializer.Serialize(config))!;
 Check(restored.DataDirectory=="D:/Existing/data"&&!restored.AutoStart&&restored.Version==1,"other settings preserved "+language);
 Check(restored.Language==(LanguagePolicy.Normalize(language)??"de"),"config migration "+language);
}
var missing=JsonSerializer.Deserialize<Configuration>("{\"Version\":1}")!;
Check(missing.Language==null&&missing.AutoStart,"missing language distinguishable, auto start default");
foreach(var row in rows){Check(row.Value.Keys.Order().SequenceEqual(LanguagePolicy.Codes.Order()),row.Key+" keys");var slots=Regex.Matches(row.Value["en"],@"\{\d+(?:[^}]*)\}").Select(x=>x.Value).Order().ToArray();foreach(var code in LanguagePolicy.Codes){Check(!string.IsNullOrWhiteSpace(row.Value[code]),row.Key+code);Check(Regex.Matches(row.Value[code],@"\{\d+(?:[^}]*)\}").Select(x=>x.Value).Order().SequenceEqual(slots),row.Key+code+" format");}}
Console.WriteLine($"PASS: {count} language policy, persistence and resource checks; {rows.Count} complete keys.");
