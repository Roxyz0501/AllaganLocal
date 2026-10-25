using System.Text.Json;
namespace AllaganLocalPlugin;
internal sealed class SettingsStore : IDisposable
{
 readonly string file;readonly object gate=new();readonly Timer timer;string saved,pending;int failures;bool disposed;readonly Queue<string> pendingCorrupt=new(),pendingBackups=new();
 public int FailureCount=>failures;public long Writes {get;private set;} public long LogicalBytes{get;private set;}public long BackupLogicalBytes{get;private set;}public long TemporaryPayloadBytes{get;private set;} public string? Error{get;private set;}
 public static bool Recovered {get;private set;}
 public static Configuration Load(string file,Configuration fallback){
  Exception? first=null;for(int i=0;i<4;i++){var candidate=i==0?file:file+".bak"+i;try{var c=JsonSerializer.Deserialize<Configuration>(File.ReadAllText(candidate))??throw new InvalidDataException();if(i>0){Recovered=true;if(File.Exists(file))File.Move(file,file+".corrupt-"+Guid.NewGuid().ToString("N"));File.Copy(candidate,file);}return c;}catch(FileNotFoundException){}catch(DirectoryNotFoundException){}catch(Exception e){first??=e;}}
  if(first!=null)throw new InvalidDataException("No valid settings generation",first);return fallback;
 }
 public SettingsStore(string file,Configuration value){this.file=file;saved=pending=JsonSerializer.Serialize(value);timer=new Timer(_=>{try{Flush();}catch{}},null,60000,60000);}
 public void Mark(Configuration value){lock(gate){if(disposed)return;pending=JsonSerializer.Serialize(value);}}
 void FinishBackups(){while(pendingCorrupt.TryPeek(out var damaged)){File.Move(damaged,damaged+".corrupt-"+Guid.NewGuid().ToString("N"));pendingCorrupt.Dequeue();}while(pendingBackups.TryPeek(out var target)){File.Move(target+".tmp",target,true);pendingBackups.Dequeue();}}
 public void Flush(){lock(gate){if(disposed||(saved==pending&&pendingCorrupt.Count==0&&pendingBackups.Count==0))return;if(failures>=3)return;try{FinishBackups();if(saved==pending){failures=0;Error=null;return;}Directory.CreateDirectory(Path.GetDirectoryName(file)!);var bytes=System.Text.Encoding.UTF8.GetBytes(pending);using(var stream=new FileStream(file+".tmp",FileMode.Create,FileAccess.Write,FileShare.None)){stream.Write(bytes);TemporaryPayloadBytes+=bytes.Length;stream.Flush(true);} _=JsonSerializer.Deserialize<Configuration>(File.ReadAllText(file+".tmp"))??throw new InvalidDataException();
  var valid=new List<string>();var corrupt=new List<string>();var staged=new List<string>();for(int i=0;i<4;i++){var source=i==0?file:file+".bak"+i;if(!File.Exists(source))continue;try{_=JsonSerializer.Deserialize<Configuration>(File.ReadAllText(source))??throw new InvalidDataException();}catch(Exception e) when(e is JsonException or InvalidDataException){if(i==0)throw;corrupt.Add(source);continue;}if(valid.Count<3)valid.Add(source);}
  for(int i=0;i<valid.Count;i++){var target=file+".bak"+(i+1);File.Copy(valid[i],target+".tmp",true);BackupLogicalBytes+=new FileInfo(valid[i]).Length;using(var backup=new FileStream(target+".tmp",FileMode.Open,FileAccess.ReadWrite,FileShare.None)){backup.Flush(true);}staged.Add(target);}

  File.Move(file+".tmp",file,true);saved=pending;Writes++;LogicalBytes+=bytes.Length;foreach(var damaged in corrupt)pendingCorrupt.Enqueue(damaged);foreach(var target in staged)pendingBackups.Enqueue(target);FinishBackups();failures=0;Error=null;
 }catch(Exception e){failures++;Error=e.Message;}}}
 public void Retry(){lock(gate){failures=0;Flush();}}
 public void Dispose(){timer.Dispose();lock(gate){if(disposed)return;Flush();disposed=true;}}
}
