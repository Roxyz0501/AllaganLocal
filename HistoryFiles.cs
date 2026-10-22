using Roxyz0501.Dalamud.CommonUi;
namespace AllaganLocalPlugin;
internal sealed class HistoryFiles : IDisposable
{
 readonly string directory;readonly object gate=new();Task? pending;bool disposed;volatile bool dirty=true;FileSystemWatcher? watcher;
 public StandardHistoryFilesTab.Snapshot Snapshot{get;private set;}
 public HistoryFiles(string directory){this.directory=directory;Snapshot=new(null,null,"","",[new("history",directory,null,null)]);}
 public void RefreshIfDirty(){if(dirty)Refresh();}
 public void Refresh(){lock(gate){if(disposed||pending is {IsCompleted:false})return;dirty=false;if(watcher==null&&Directory.Exists(directory)){watcher=new FileSystemWatcher(directory){IncludeSubdirectories=true,EnableRaisingEvents=true};watcher.Changed+=Invalidate;watcher.Created+=Invalidate;watcher.Deleted+=Invalidate;watcher.Renamed+=Invalidate;}pending=Task.Run(()=>{try{long count=0,bytes=0;if(Directory.Exists(directory)){foreach(var f in Directory.EnumerateFiles(directory,"money-history.json*")){count++;bytes+=new FileInfo(f).Length;}var days=Path.Combine(directory,"history-days");if(Directory.Exists(days))foreach(var f in Directory.EnumerateFiles(days,"*",SearchOption.AllDirectories)){var info=new FileInfo(f);if(info.Attributes.HasFlag(FileAttributes.ReparsePoint))continue;count++;bytes+=info.Length;}}Snapshot=new(count,bytes,"","",[new("history",directory,count,bytes)]);}catch{Snapshot=new(null,null,"","Error",[new("history",directory,null,null)]);}});}}
 private void Invalidate(object sender,FileSystemEventArgs e){if(e.FullPath.Contains(Path.DirectorySeparatorChar+"history-days"+Path.DirectorySeparatorChar)||Path.GetFileName(e.FullPath).StartsWith("money-history.json",StringComparison.Ordinal))dirty=true;}
 public void Dispose(){lock(gate){disposed=true;watcher?.Dispose();}pending?.GetAwaiter().GetResult();}
}
