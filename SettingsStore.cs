using System.Text.Json;
namespace AllaganLocalPlugin;
internal sealed class SettingsStore : IDisposable
{
 readonly string file;readonly object gate=new();readonly Timer timer;string saved,pending;int failures;bool disposed;
 public int FailureCount=>failures;public long Writes {get;private set;} public long LogicalBytes{get;private set;}public long BackupLogicalBytes{get;private set;}public long TemporaryPayloadBytes{get;private set;} public string? Error{get;private set;}
 public static bool Recovered {get;private set;}
 public static Configuration Load(string file,Configuration fallback){
  Exception? first=null;for(int i=0;i<4;i++){var candidate=i==0?file:file+".bak"+i;try{var c=JsonSerializer.Deserialize<Configuration>(File.ReadAllText(candidate))??throw new InvalidDataException();if(i>0){Recovered=true;if(File.Exists(file))File.Move(file,file+".corrupt-"+Guid.NewGuid().ToString("N"));File.Copy(candidate,file);}return c;}catch(FileNotFoundException){}catch(DirectoryNotFoundException){}catch(Exception e){first??=e;}}
  if(first!=null)throw new InvalidDataException("No valid settings generation",first);return fallback;
 }
 public SettingsStore(string file,Configuration value){this.file=file;saved=pending=JsonSerializer.Serialize(value);timer=new Timer(_=>{try{Flush();}catch{}},null,60000,60000);}
 public void Mark(Configuration value){lock(gate){if(disposed)return;pending=JsonSerializer.Serialize(value);}}
 public void Flush(){lock(gate){if(disposed||saved==pending)return;if(failures>=3)return;try{Directory.CreateDirectory(Path.GetDirectoryName(file)!);var bytes=System.Text.Encoding.UTF8.GetBytes(pending);using(var stream=new FileStream(file+".tmp",FileMode.Create,FileAccess.Write,FileShare.None)){stream.Write(bytes);TemporaryPayloadBytes+=bytes.Length;stream.Flush(true);} _=JsonSerializer.Deserialize<Configuration>(File.ReadAllText(file+".tmp"))??throw new InvalidDataException();
  for(int i=3;i>=1;i--){var source=i==1?file:file+".bak"+(i-1);if(!File.Exists(source))continue;_=JsonSerializer.Deserialize<Configuration>(File.ReadAllText(source))??throw new InvalidDataException();File.Copy(source,file+".bak"+i+".tmp",true);BackupLogicalBytes+=new FileInfo(source).Length;using(var backup=new FileStream(file+".bak"+i+".tmp",FileMode.Open,FileAccess.ReadWrite,FileShare.None)){backup.Flush(true);}}
  File.Move(file+".tmp",file,true);saved=pending;Writes++;LogicalBytes+=bytes.Length;for(int i=3;i>=1;i--){var staged=file+".bak"+i+".tmp";if(File.Exists(staged))File.Move(staged,file+".bak"+i,true);}failures=0;Error=null;
 }catch(Exception e){failures++;Error=e.Message;}}}
 public void Retry(){lock(gate){failures=0;Flush();}}
 public void Dispose(){timer.Dispose();lock(gate){if(disposed)return;Flush();disposed=true;}}
}
