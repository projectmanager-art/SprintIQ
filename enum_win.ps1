Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Collections.Generic;
public class WinEnum {
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
    [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr hWnd, EnumWindowsProc cb, IntPtr l);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int max);
    [DllImport("user32.dll")] public static extern int GetClassName(IntPtr hWnd, StringBuilder sb, int max);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr l);
}
"@
$proc = Get-Process POWERPNT -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $proc) { Write-Output "no POWERPNT"; exit 0 }
$targetPid = $proc.Id
$cb = [WinEnum+EnumWindowsProc]{
    param($hWnd, $l)
    $pid2 = 0
    [WinEnum]::GetWindowThreadProcessId($hWnd, [ref]$pid2) | Out-Null
    if ($pid2 -eq $targetPid) {
        $t = New-Object System.Text.StringBuilder 256
        $c = New-Object System.Text.StringBuilder 256
        [WinEnum]::GetWindowText($hWnd, $t, 256) | Out-Null
        [WinEnum]::GetClassName($hWnd, $c, 256) | Out-Null
        $vis = [WinEnum]::IsWindowVisible($hWnd)
        Write-Output ("HWND={0} PID match vis={1} class={2} title='{3}'" -f $hWnd, $vis, $c.ToString(), $t.ToString())
    }
    return $true
}
[WinEnum]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null
