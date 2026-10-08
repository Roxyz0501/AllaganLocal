namespace AllaganLocalPlugin;

public static class LanguagePolicy
{
 public static readonly string[] Codes=["ja","en","de","fr","ko","zh-Hans","zh-Hant"];
 public static readonly string[] Names=["日本語","English","Deutsch","Français","한국어","简体中文","繁體中文"];
 public static string? Normalize(string? value)
 {
  var code=value?.Trim().Replace('_','-').ToLowerInvariant();
  if(string.IsNullOrEmpty(code))return null;
  var parts=code.Split('-');
  if(parts[0]=="zh"){
   if(parts.Contains("hans"))return "zh-Hans";
   if(parts.Contains("hant"))return "zh-Hant";
   if(parts.Skip(1).Any(p=>p is "cn" or "sg"))return "zh-Hans";
   if(parts.Skip(1).Any(p=>p is "tw" or "hk" or "mo"))return "zh-Hant";
   return null;
  }
  return parts[0] is "ja" or "en" or "de" or "fr" or "ko"?parts[0]:null;
 }
 public static string Resolve(string? saved,Func<string?> game,Func<string?> dalamud)
 {
  if(Normalize(saved) is {} existing)return existing;
  foreach(var get in new[]{game,dalamud})try{if(Normalize(get()) is {} language)return language;}catch{}
  return "en";
 }
}
