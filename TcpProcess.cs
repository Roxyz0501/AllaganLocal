using System.Runtime.InteropServices;
namespace AllaganLocalPlugin;
internal static class TcpProcess
{
 [DllImport("iphlpapi.dll", SetLastError=true)] private static extern uint GetExtendedTcpTable(IntPtr table,ref int size,bool order,int family,int tableClass,uint reserved);
 public static int Find(int port){
  int size=0;GetExtendedTcpTable(IntPtr.Zero,ref size,false,2,3,0);var memory=Marshal.AllocHGlobal(size);
  try{if(GetExtendedTcpTable(memory,ref size,false,2,3,0)!=0)throw new InvalidOperationException("Cannot inspect listening server");
   var count=Marshal.ReadInt32(memory);for(var i=0;i<count;i++){var row=IntPtr.Add(memory,4+i*24);var raw=Marshal.ReadInt32(row,8);var local=((raw&255)<<8)|((raw>>8)&255);if(local==port)return Marshal.ReadInt32(row,20);}
   throw new InvalidOperationException("Server listener not found");
  }finally{Marshal.FreeHGlobal(memory);}
 }
}
