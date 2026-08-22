. "C:\Users\Sandeep_fastranking\Desktop\Devin\pptx_lib.ps1"
$D = Get-Content "C:\Users\Sandeep_fastranking\Desktop\Devin\ppt_data.json" -Raw | ConvertFrom-Json
$E = $D.effort
Write-Output ("type E: " + $E.GetType().FullName)
Write-Output ("type estMin: " + $E.estMin.GetType().FullName)
Write-Output ("estMin val: " + $E.estMin)
$a = $E.estMin / 60
Write-Output ("simple div: " + $a)
$vals = @( ($E.estMin / 60), ($E.workloadMin / 60), ($E.actMin / 60) )
Write-Output ("parens form: " + ($vals -join ", "))
