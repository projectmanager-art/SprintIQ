param([string]$minePath = "C:\Users\Sandeep_fastranking\Desktop\Devin\min_test.pptx", [string]$fixedPath = "C:\Users\Sandeep_fastranking\Desktop\Devin\min_test_repaired.pptx")
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Read-Zip($path) {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($path)
    $map = @{}
    foreach ($e in $zip.Entries) {
        $sr = New-Object System.IO.StreamReader($e.Open())
        $map[$e.FullName] = $sr.ReadToEnd()
        $sr.Close()
    }
    $zip.Dispose()
    return $map
}
$m = Read-Zip $minePath
$f = Read-Zip $fixedPath
Write-Output "=== parts only in mine ==="
foreach ($k in $m.Keys) { if (-not $f.ContainsKey($k)) { Write-Output "  $k" } }
Write-Output "=== parts only in repaired ==="
foreach ($k in $f.Keys) { if (-not $m.ContainsKey($k)) { Write-Output "  $k" } }
Write-Output "=== content diffs (shared parts) ==="
foreach ($k in $m.Keys) {
    if ($f.ContainsKey($k)) {
        $a = $m[$k] -replace '>\s+<', '><' -replace '\s', ''
        $b = $f[$k] -replace '>\s+<', '><' -replace '\s', ''
        if ($a -ne $b) { Write-Output ("  DIFF: " + $k + " (mine " + $m[$k].Length + " vs fixed " + $f[$k].Length + ")") }
    }
}
