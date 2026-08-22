# Save repaired copy of test_s2 and diff the slide XML
Add-Type -AssemblyName System.IO.Compression.FileSystem
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$pres = $ppt.Presentations.Item(1)
Write-Output ("attached: " + $pres.Name)
$pres.SaveCopyAs("C:\Users\Sandeep_fastranking\Desktop\Devin\test_s2_repaired.pptx")
$pres.Close()
$ppt.Quit()

$zip = [System.IO.Compression.ZipFile]::OpenRead("C:\Users\Sandeep_fastranking\Desktop\Devin\test_s2_repaired.pptx")
$e = $zip.Entries | Where-Object { $_.FullName -eq 'ppt/slides/slide1.xml' }
$sr = New-Object System.IO.StreamReader($e.Open()); $c = $sr.ReadToEnd(); $sr.Close(); $zip.Dispose()
[System.IO.File]::WriteAllText("C:\Users\Sandeep_fastranking\Desktop\Devin\s2_fixed.xml", $c)

$mine = [System.IO.File]::ReadAllText("C:\Users\Sandeep_fastranking\Desktop\Devin\s2_mine.xml") -replace '>\s+<', '><' -replace '\s+', ' '
$fixed = $c -replace '>\s+<', '><' -replace '\s+', ' '
Write-Output ("mine: " + $mine.Length + " chars, fixed: " + $fixed.Length + " chars")
$minLen = [Math]::Min($mine.Length, $fixed.Length)
$d = -1
for ($i = 0; $i -lt $minLen; $i++) { if ($mine[$i] -ne $fixed[$i]) { $d = $i; break } }
if ($d -ge 0) {
    Write-Output ("first divergence at char " + $d)
    Write-Output ("MINE  : ..." + $mine.Substring([Math]::Max(0, $d - 150), 400))
    Write-Output ("FIXED : ..." + $fixed.Substring([Math]::Max(0, $d - 150), 400))
} else { Write-Output "identical up to min length" }
