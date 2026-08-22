$path = "C:\Users\Sandeep_fastranking\Desktop\Invoice Analysis..xlsx"
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.IgnoreRemoteRequests = $true
$wb = $null
for ($i = 0; $i -lt 10 -and $null -eq $wb; $i++) {
    try { $wb = $excel.Workbooks.Open($path, 0, $true) }
    catch { Start-Sleep -Milliseconds 500 }
}
if ($null -eq $wb) { Write-Output "FAILED to open workbook"; $excel.Quit(); exit 1 }

foreach ($ws in $wb.Worksheets) {
    $used = $ws.UsedRange
    $rows = $used.Rows.Count
    $cols = $used.Columns.Count
    Write-Output "=== SHEET: $($ws.Name) | Rows: $rows | Cols: $cols ==="
    # Print first 8 rows x up to 12 cols
    $maxR = [Math]::Min(8, $rows)
    $maxC = [Math]::Min(12, $cols)
    for ($r = 1; $r -le $maxR; $r++) {
        $vals = @()
        for ($c = 1; $c -le $maxC; $c++) {
            $v = $used.Cells.Item($r, $c).Text
            $vals += $v
        }
        Write-Output ("R${r}: " + ($vals -join " | "))
    }
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
