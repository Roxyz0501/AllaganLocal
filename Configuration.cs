using Dalamud.Configuration;
namespace AllaganLocalPlugin;
[Serializable]
public sealed class Configuration : IPluginConfiguration
{
 public int Version { get; set; } = 1;
 public string Language { get; set; } = "ja";
 public string DataDirectory { get; set; } = "";
 public bool AutoStart { get; set; } = true;
}
