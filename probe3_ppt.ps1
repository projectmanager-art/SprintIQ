# Probe 3: fresh start + window diagnostics + aggressive retry
$ErrorActionPreference = "Continue"
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class WE {
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int max);
    [DllImport("user32.dll")] public static extern int GetClassName(IntPtr hWnd, StringBuilder sb, int max);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr l);
}
"@

Get-Process POWERPNT -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$ppt = New-Object -ComObject PowerPoint.Application
try { $ppt.Visible = 1 } catch { Write-Output ("vis err: " + $_.Exception.Message) }
Start-Sleep -Seconds 5

$proc = Get-Process POWERPNT -ErrorAction SilentlyContinue | Select-Object -First 1
Write-Output ("proc: " + $proc.Id + " title='" + $proc.MainWindowTitle + "'")

$tpid = $proc.Id
$cb = [WE+EnumWindowsProc]{
    param($hWnd, $l)
    $pid2 = 0
    [WE]::GetWindowThreadProcessId($hWnd, [ref]$pid2) | Out-Null
    if ($pid2 -eq $tpid -and [WE]::IsWindowVisible($hWnd)) {
        $t = New-Object System.Text.StringBuilder 256
        $c = New-Object System.Text.StringBuilder 256
        [WE]::GetWindowText($hWnd, $t, 256) | Out-Null
        [WE]::GetClassName($hWnd, $c, 256) | Out-Null
        Write-Output ("  win: class=" + $c.ToString() + " title='" + $t.ToString() + "'")
    }
    return $true
}
[WE]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null

# try to dismiss anything modal
$shell = New-Object -ComObject WScript.Shell
$null = $shell.AppActivate($tpid)
Start-Sleep -Milliseconds 600
$shell.SendKeys("{ESC}"); Start-Sleep -Milliseconds 300
$shell.SendKeys("{ESC}"); Start-Sleep -Milliseconds 300

$pres = $null
for ($i = 0; $i -lt 10 -and $null -eq $pres; $i++) {
    try { $pres = $ppt.Presentations.Add() } catch { Write-Output ("  try $i err: " + $_.Exception.Message) }
    if ($null -eq $pres) { Start-Sleep -Seconds 1 }
}
Write-Output ("pres null? " + ($null -eq $pres))
if ($pres) {
    $slide = $pres.Slides.Add(1, 12)
    $tb = $slide.Shapes.AddTextbox(1, 40, 30, 600, 50)
    $tb.TextFrame.TextRange.Text = "probe3 ok"
    $pres.SaveAs("C:\Users\Sandeep_fastranking\Desktop\Devin\probe3.pptx")
    Write-Output "SAVED probe3.pptx"
    $pres.Close()
    $ppt.Quit()
} else {
    Write-Output "FAILED - will pivot to OOXML generation"
}
