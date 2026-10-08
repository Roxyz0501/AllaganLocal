using System.Diagnostics;
using System.Net.Http;
using System.Text.Json;
namespace AllaganLocalPlugin;

// Own only processes created by this instance. An already-running dashboard is reused.
public sealed class DashboardHost : IDisposable
{
 private readonly HttpClient http = new() { Timeout = TimeSpan.FromSeconds(3) };
 private readonly SemaphoreSlim gate = new(1);
 private readonly CancellationTokenSource lifetime = new();
 private readonly string web, runtime, data, address;
 private int failures;
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
 private async Task RunStartAsync(bool restart)
 {
  try{await gate.WaitAsync(lifetime.Token);}catch(OperationCanceledException){return;}
  try {
   if(restart){
    if(owned is {HasExited:false} previousProcess){
     Status="Restarting";
     lock(lifetime){intentionalStops.Add(previousProcess);previousProcess.Kill(entireProcessTree:true);}
     await previousProcess.WaitForExitAsync(lifetime.Token);owned=null;
    }else if(await IsRunning(lifetime.Token)){
     Status="ExternalServer";return;
    }
    failures=0;
   }
   if(await IsRunning(lifetime.Token)){Status="Running";return;}
   if(owned is {HasExited:false}){Status="Starting";return;}
   if(!File.Exists(runtime)||!File.Exists(Path.Combine(web,"server.mjs")))throw new FileNotFoundException("Bundled website/runtime is missing. Install the complete ZIP.");
   Directory.CreateDirectory(data);
   var start=new ProcessStartInfo(runtime){WorkingDirectory=web,UseShellExecute=false,CreateNoWindow=true,RedirectStandardError=true,RedirectStandardOutput=true};
   start.ArgumentList.Add(Path.Combine(web,"server.mjs"));
   start.Environment["PORT"]=new Uri(address).Port.ToString();
   start.Environment["ALLAGAN_DATA_DIR"]=data;start.Environment["ALLAGAN_CATALOG_DIR"]=data;
   start.Environment["ALLAGAN_SEED_DIR"]=Path.Combine(web,"seed");
   owned=new Process{StartInfo=start};
   owned.OutputDataReceived+=(_,e)=>{if(e.Data!=null)WriteLog(e.Data);};
   owned.ErrorDataReceived+=(_,e)=>{if(e.Data!=null)WriteLog("ERROR "+e.Data);};
   lock(lifetime){lifetime.Token.ThrowIfCancellationRequested();if(!owned.Start())throw new InvalidOperationException("Could not start the dashboard.");}
   owned.BeginOutputReadLine();owned.BeginErrorReadLine();Status="Starting";
   var process=owned;monitor=MonitorAsync(process);
   for(var i=0;i<30;i++){await Task.Delay(300,lifetime.Token);if(await IsRunning(lifetime.Token)){Status="Running";return;}if(process.HasExited)break;}
   throw new InvalidOperationException("Dashboard did not start. Check dashboard.log.");
  }catch(OperationCanceledException){}catch(Exception e){Status="Error";log(e.ToString());}
  finally{gate.Release();}
 }
 private void WriteLog(string text){try{lock(http){File.AppendAllText(Path.Combine(data,"dashboard.log"),DateTimeOffset.Now.ToString("O")+" "+text+Environment.NewLine);}}catch{} }
 private async Task MonitorAsync(Process process)
 {
  try{await process.WaitForExitAsync(lifetime.Token);WriteLog("Server exited: "+process.ExitCode);
   lock(lifetime){if(intentionalStops.Remove(process))return;}
   Status="Stopped";
   if(!lifetime.IsCancellationRequested){if(++failures>5){Status="RepeatedExits";return;}await Task.Delay(5000,lifetime.Token);await StartAsync();}
  }catch(OperationCanceledException){}catch(Exception e){log(e.ToString());}
 }
 public void Dispose()
 {
  lock(lifetime){lifetime.Cancel();try{if(owned is {HasExited:false})owned.Kill(entireProcessTree:true);}catch(Exception e){log(e.Message);}}
  // An external server was never assigned to owned and is left running.
 }
}
