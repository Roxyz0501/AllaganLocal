using AllaganLocalPlugin;
using System.Net;
using System.Net.Sockets;
using System.Diagnostics;
if(args[0]=="child"){
 using var childHost=new DashboardHost(args[1],args[2],Console.WriteLine,int.Parse(args[3]));
 await childHost.StartAsync();Environment.ExitCode=childHost.Status=="Running"?0:1;return;
}
var root=Path.GetFullPath(args[0]);var probe=new TcpListener(IPAddress.Loopback,0);probe.Start();var port=((IPEndPoint)probe.LocalEndpoint).Port;probe.Stop();
var work=Path.Combine(root,"artifacts","host-test-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(Path.Combine(work,"web"));Directory.CreateDirectory(Path.Combine(work,"runtime"));File.Copy(Path.Combine(root,"runtime","node.exe"),Path.Combine(work,"runtime","node.exe"));
await File.WriteAllTextAsync(Path.Combine(work,"web","server.mjs"),"import http from 'node:http';import fs from 'node:fs';import path from 'node:path';fs.mkdirSync(process.env.ALLAGAN_DATA_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.ALLAGAN_DATA_DIR,'server-control.key'),'test-control');const s=http.createServer((req,res)=>{if(req.url==='/api/host-stop'||req.url==='/api/host-flush'){if(req.headers['x-allagan-control']!=='test-control'){res.writeHead(403);res.end();return;}res.end('{}');if(req.url.endsWith('stop'))setTimeout(()=>process.exit(0),10);return;}if(req.url==='/exit'){res.end('bye');setTimeout(()=>process.exit(7),50);return;}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({app:'allagan-local',pid:process.pid}));});s.listen(Number(process.env.PORT),'127.0.0.1');");
File.Copy(Path.Combine(root,"web","server-runner.mjs"),Path.Combine(work,"web","server-runner.mjs"));
var data=Path.Combine(work,"data");using var client=new HttpClient{Timeout=TimeSpan.FromSeconds(1)};
bool ok=true;void Check(bool test,string name){Console.WriteLine(name+": "+(test?"PASS":"FAIL"));ok&=test;}
async Task<string> Identity()=>await client.GetStringAsync($"http://127.0.0.1:{port}/api/health");
using(var owner=new DashboardHost(work,data,Console.WriteLine,port)){
 await Task.WhenAll(owner.StartAsync(),owner.StartAsync());Check(owner.Status=="Running","Concurrent load starts one server");
 using(var borrowed=new DashboardHost(work,data,Console.WriteLine,port)){await borrowed.StartAsync();Check(borrowed.Status=="Running","Reuse existing server");var external=await Identity();await borrowed.RestartAsync();Check(await Identity()!=external,"Restart replaces verified adopted server");}
 Check((await client.GetAsync($"http://127.0.0.1:{port}/api/health")).IsSuccessStatusCode,"Disposing borrower preserves server");
 var before=await Identity();await owner.RestartAsync();Check(owner.Status=="Running"&&before!=await Identity(),"Restart replaces owned process");
 await client.GetAsync($"http://127.0.0.1:{port}/exit");await Task.Delay(12000);
 Check((await client.GetAsync($"http://127.0.0.1:{port}/api/health")).IsSuccessStatusCode,"Unexpected exit recovers");
 Check((await File.ReadAllTextAsync(Path.Combine(data,"dashboard.log"))).Contains("Server exited: 7"),"Exit code logged");
}
await Task.Delay(500);
Check((await client.GetAsync($"http://127.0.0.1:{port}/api/health")).IsSuccessStatusCode,"Plugin disposal preserves owned server");
var survivor=await Identity();
using(var next=new DashboardHost(work,data,Console.WriteLine,port)){await next.StartAsync();Check(await Identity()==survivor,"Next plugin load reuses surviving server");await next.StopAsync();await Task.Delay(6000);try{await Identity();Check(false,"Explicit stop stays stopped");}catch(Exception e) when(e is HttpRequestException or TaskCanceledException){Check(true,"Explicit stop stays stopped");}await next.StartAsync();}
await client.GetAsync($"http://127.0.0.1:{port}/exit");await Task.Delay(500);
using(var stopped=new DashboardHost(work,data,Console.WriteLine,port)){await stopped.RestartAsync();Check(stopped.Status=="Running","Restart starts a stopped server");}
await client.GetAsync($"http://127.0.0.1:{port}/exit");await Task.Delay(500);
var childStart=new ProcessStartInfo(Environment.ProcessPath!){UseShellExecute=false,CreateNoWindow=true};
foreach(var arg in new[]{"child",work,data,port.ToString()})childStart.ArgumentList.Add(arg);
using(var child=Process.Start(childStart)!){await child.WaitForExitAsync();Check(child.ExitCode==0,"Launching parent exits normally");}
try{
 Check((await client.GetAsync($"http://127.0.0.1:{port}/api/health")).IsSuccessStatusCode,"Server survives actual parent process exit");
 using var nextGame=new DashboardHost(work,data,Console.WriteLine,port);var before=await Identity();await nextGame.StartAsync();Check(await Identity()==before,"New game session does not duplicate surviving process");
}finally{await client.GetAsync($"http://127.0.0.1:{port}/exit");}
Environment.ExitCode=ok?0:1;
