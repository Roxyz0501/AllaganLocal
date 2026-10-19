using System.Diagnostics;
using System.Net.Http;
using System.Text.Json;
namespace AllaganLocalPlugin;

// Adopt only the verified local listener running this plugin runtime.
public sealed class DashboardHost : IDisposable
{
 private readonly HttpClient http = new() { Timeout = TimeSpan.FromSeconds(3) };
 private readonly SemaphoreSlim gate = new(1);
 private readonly CancellationTokenSource lifetime = new();
 private readonly string web, runtime, data, address;
 private int failures, generation;
 private Process? owned;
 private Task? monitor;
 private readonly HashSet<Process> intentionalStops = [];
 private readonly Action<string> log;
 public string Status { get; private set; } = "Stopped";
 public const string Url = "http://127.0.0.1:47831/";
 public DashboardHost(string root, string data, Action<string> log, int port=47831)
 { web=Path.Combine(root,"web");runtime=Path.Combine(root,"runtime","node.exe");this.data=data;this.log=log;address="http://127.0.0.1:"+port+"/"; }
 private async Task<bool> IsRunning(CancellationToken ct)
 {
  try { using var response=await http.GetAsync(address+"api/health",ct); using var json=JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
   if(json.RootElement.TryGetProperty("app",out var app)&&app.GetString()=="allagan-local")return true;
   throw new InvalidOperationException("Port 47831 is occupied by another application.");
  } catch(HttpRequestException) { return false; } catch(TaskCanceledException) when(!ct.IsCancellationRequested) { return false; }
 }
 public Task StartAsync()=>RunStartAsync(false);
 public Task RestartAsync()=>RunStartAsync(true);
 public async Task StopAsync(){
  await gate.WaitAsync();try{generation++;await StopServerAsync();Status="Stopped";}catch(Exception e){Status="Error";log(e.ToString());}finally{gate.Release();}
 }
 private async Task AdoptAsync(){
  using var response=await http.GetAsync(address+"api/health",lifetime.Token);using var json=JsonDocument.Parse(await response.Content.ReadAsStringAsync(lifetime.Token));
  if(json.RootElement.GetProperty("app").GetString()!="allagan-local")throw new InvalidOperationException("Unexpected server");
  var pid=TcpProcess.Find(new Uri(address).Port);
  if(json.RootElement.TryGetProperty("pid",out var value)&&value.GetInt32()!=pid)throw new InvalidOperationException("Server identity changed");
  var process=Process.GetProcessById(pid);var executable=process.MainModule?.FileName??"";
  var currentRoot=Directory.GetParent(Path.GetDirectoryName(runtime)!)!;
  var candidate=Directory.GetParent(Path.GetDirectoryName(executable)!)!;
  if(!string.Equals(executable,runtime,StringComparison.OrdinalIgnoreCase)&&!(Path.GetFileName(executable).Equals("node.exe",StringComparison.OrdinalIgnoreCase)&&candidate.Parent?.FullName==currentRoot.Parent?.FullName&&System.Text.RegularExpressions.Regex.IsMatch(candidate.Name,@"^\d+\.\d+\.\d+\.\d+$")))throw new InvalidOperationException("Server executable is not this plugin's bundled runtime.");
  owned=process;
 }
 private async Task StopServerAsync(){
  if(owned is not {HasExited:false}){if(!await IsRunning(lifetime.Token))return;await AdoptAsync();}
  var process=owned!;lock(lifetime){intentionalStops.Add(process);process.Kill(entireProcessTree:true);}
  await process.WaitForExitAsync(lifetime.Token);owned=null;
 }

 private async Task RunStartAsync(bool restart)
 {
  try{await gate.WaitAsync(lifetime.Token);}catch(OperationCanceledException){return;}
  try {
   if(restart){generation++;Status="Restarting";await StopServerAsync();failures=0;}
   if(await IsRunning(lifetime.Token)){if(owned is not {HasExited:false}){await AdoptAsync();monitor=MonitorAsync(owned!);}Status="Running";return;}
   if(owned is {HasExited:false}){Status="Starting";return;}
   if(!File.Exists(runtime)||!File.Exists(Path.Combine(web,"server.mjs"))||!File.Exists(Path.Combine(web,"server-runner.mjs")))throw new FileNotFoundException("Bundled website/runtime is missing. Install the complete ZIP.");
   Directory.CreateDirectory(data);
   var start=new ProcessStartInfo(runtime){WorkingDirectory=web,UseShellExecute=false,CreateNoWindow=true};
   start.ArgumentList.Add(Path.Combine(web,"server-runner.mjs"));
   start.Environment["PORT"]=new Uri(address).Port.ToString();
   start.Environment["ALLAGAN_DATA_DIR"]=data;start.Environment["ALLAGAN_CATALOG_DIR"]=data;
   start.Environment["ALLAGAN_SEED_DIR"]=Path.Combine(web,"seed");
   owned=new Process{StartInfo=start};
   lock(lifetime){lifetime.Token.ThrowIfCancellationRequested();if(!owned.Start())throw new InvalidOperationException("Could not start the dashboard.");}
   Status="Starting";
   var process=owned;monitor=MonitorAsync(process);
   for(var i=0;i<30;i++){await Task.Delay(300,lifetime.Token);if(await IsRunning(lifetime.Token)){Status="Running";return;}if(process.HasExited)break;}
   throw new InvalidOperationException("Dashboard did not start. Check dashboard.log.");
  }catch(OperationCanceledException){}catch(Exception e){Status="Error";log(e.ToString());}
  finally{gate.Release();}
 }
 private void WriteLog(string text){try{lock(http){File.AppendAllText(Path.Combine(data,"dashboard.log"),DateTimeOffset.Now.ToString("O")+" "+text+Environment.NewLine);}}catch{} }
 private async Task MonitorAsync(Process process)
 {
  var epoch=generation;
  try{await process.WaitForExitAsync(lifetime.Token);WriteLog("Server exited: "+process.ExitCode);
   lock(lifetime){if(intentionalStops.Remove(process))return;}
   Status="Stopped";
   if(!lifetime.IsCancellationRequested){if(++failures>5){Status="RepeatedExits";return;}await Task.Delay(5000,lifetime.Token);if(epoch==generation)await StartAsync();}
  }catch(OperationCanceledException){}catch(Exception e){log(e.ToString());}
 }
 public void Dispose()
 {
  // Keep the independent server alive after plugin unload/game exit. No redirected
  // pipes or plugin callbacks remain necessary for its logging or operation.
  lock(lifetime){lifetime.Cancel();}
 }
}
