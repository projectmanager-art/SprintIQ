. "C:\Users\Sandeep_fastranking\Desktop\Devin\pptx_lib.ps1"
$D = Get-Content "C:\Users\Sandeep_fastranking\Desktop\Devin\ppt_data.json" -Raw | ConvertFrom-Json
$E = $D.effort
$GBP = [char]163
try {
    $vals = @($E.estMin / 60, $E.workloadMin / 60, $E.actMin / 60)
    Write-Output ("vals: " + ($vals -join ", "))
    $x = New-BarChartXml @("Estimated", "Planned Workload", "Actual Logged") @(@{ name = "Hours"; values = $vals; color = "64748B"; ptColors = @("64748B", "B45309", "4F46E5") }) "Test" "col" $false '0.0"h"' $false $true $true
    Write-Output "OK length $($x.Length)"
} catch {
    Write-Output ("ERR: " + $_.Exception.Message)
    Write-Output ("AT: " + $_.InvocationInfo.PositionMessage)
    Write-Output ("LINE: " + $_.InvocationInfo.Line)
}
