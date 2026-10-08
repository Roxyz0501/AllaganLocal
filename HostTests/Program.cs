using AllaganLocalPlugin;
using System.Net;
using System.Net.Sockets;
using System.Diagnostics;
var root=Path.GetFullPath(args[0]);var probe=new TcpListener(IPAddress.Loopback,0);probe.Start();var port=((IPEndPoint)probe.LocalEndpoint).Port;probe.Stop();
var work=Path.Combine(root,"artifacts","host-test-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(Path.Combine(work,"web"));Directory.CreateDirectory(Path.Combine(work,"runtime"));File.Copy(Path.Combine(root,"runtime","node.exe"),Path.Combine(work,"runtime","node.exe"));
await File.WriteAllTextAsync(Path.Combine(work,"web","server.mjs"),"import http from 'node:http';const s=http.createServer((req,res)=>{if(req.url==='/exit'){res.end('bye');setTimeout(()=>process.exit(7),50);return;}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({app:'allagan-local',pid:process.pid}));});s.listen(Number(process.env.PORT),'127.0.0.1');");
var data=Path.Combine(work,"data");using var client=new HttpClient{Timeout=TimeSpan.FromSeconds(1)};
bool ok=true;void Check(bool test,string name){Console.WriteLine(name+": "+(test?"PASS":"FAIL"));ok&=test;}
async Task<string> Identity()=>await client.GetStringAsync($"http://127.0.0.1:{port}/api/health");
using(var owner=new DashboardHost(work,data,Console.WriteLine,port)){
 await Task.WhenAll(owner.StartAsync(),owner.StartAsync());Check(owner.Status=="Running","Concurrent load starts one server");
 using(var borrowed=new DashboardHost(work,data,Console.WriteLine,port)){await borrowed.StartAsync();Check(borrowed.Status=="Running","Reuse existing server");var external=await Identity();await borrowed.RestartAsync();Check(await Identity()==external,"Restart does not kill borrowed server");}
 Check((await client.GetAsync($"http://127.0.0.1:{port}/api/health")).IsSuccessStatusCode,"Disposing borrower preserves server");
 var before=await Identity();await owner.RestartAsync();Check(owner.Status=="Running"&&before!=await Identity(),"Restart replaces owned process");
 await client.GetAsync($"http://127.0.0.1:{port}/exit");await Task.Delay(12000);
 Check((await client.GetAsync($"http://127.0.0.1:{port}/api/health")).IsSuccessStatusCode,"Unexpected exit recovers");
 Check((await File.ReadAllTextAsync(Path.Combine(data,"dashboard.log"))).Contains("Server exited: 7"),"Exit code logged");
}
await Task.Delay(500);try{await client.GetAsync($"http://127.0.0.1:{port}/api/health");Check(false,"Owned server stopped");}catch(Exception e) when(e is HttpRequestException or TaskCanceledException){Check(true,"Owned server stopped");}
using(var stopped=new DashboardHost(work,data,Console.WriteLine,port)){await stopped.RestartAsync();Check(stopped.Status=="Running","Restart starts a stopped server");}
Environment.ExitCode=ok?0:1;
