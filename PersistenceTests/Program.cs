using AllaganLocalPlugin;
using System.Text.Json;
var root=Path.GetFullPath(args[0]);Directory.CreateDirectory(root);var file=Path.Combine(root,"settings.json");var c=new Configuration();var store=new SettingsStore(file,c);int checks=0;
void Check(bool pass,string name){if(!pass)throw new Exception(name);checks++;}
store.Flush();Check(store.Writes==0,"unchanged startup");c.DataDirectory="one";store.Mark(c);c.DataDirectory="two";store.Mark(c);Parallel.For(0,8,_=>store.Flush());Check(store.Writes==1,"single writer coalesces");
for(var i=3;i<=6;i++){c.DataDirectory=i.ToString();store.Mark(c);store.Flush();}Check(JsonSerializer.Deserialize<Configuration>(File.ReadAllText(file+".bak3"))!.DataDirectory=="3","three valid generations");
c.DataDirectory="logout";store.Mark(c);store.Flush();c.DataDirectory="dispose";store.Mark(c);store.Dispose();var count=store.Writes;store.Flush();Check(store.Writes==count,"no writes after disposal");Check(JsonSerializer.Deserialize<Configuration>(File.ReadAllText(file))!.DataDirectory=="dispose","end flush");
File.WriteAllText(file,"broken");Check(SettingsStore.Load(file,new()).DataDirectory=="logout","backup recovery");Check(SettingsStore.Recovered,"recovery notification");
var blocked=Path.Combine(root,"blocked");Directory.CreateDirectory(blocked);var failure=new SettingsStore(blocked,new());failure.Mark(new(){DataDirectory="changed"});for(var i=0;i<8;i++)failure.Flush();Check(failure.Error!=null&&failure.Writes==0&&failure.FailureCount==3,"bounded failed saving");failure.Dispose();
Console.WriteLine($"Native persistence: {checks} PASS; saves={store.Writes}; primary payload bytes={store.LogicalBytes}; backup copy bytes={store.BackupLogicalBytes}; temporary payload bytes={store.TemporaryPayloadBytes}");
