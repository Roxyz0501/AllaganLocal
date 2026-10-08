// Minimal serialization contract; no game runtime is required for these tests.
namespace Dalamud.Configuration;
public interface IPluginConfiguration { int Version { get; set; } }
