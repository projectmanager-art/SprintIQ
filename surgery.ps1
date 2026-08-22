param([string]$src, [string]$dst, [string]$mode)
# mode: nobullets | nokpistrip | nofooter | noroundrect
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
Copy-Item $src $dst -Force
$zip = [System.IO.Compression.ZipFile]::Open($dst, [System.IO.Compression.ZipArchiveMode]::Update)
$e = $zip.Entries | Where-Object { $_.FullName -eq 'ppt/slides/slide1.xml' }
$sr = New-Object System.IO.StreamReader($e.Open()); $c = $sr.ReadToEnd(); $sr.Close()
switch ($mode) {
    "nobullets"   { $c = $c -replace '<a:pPr algn="l" marL="228600" indent="-228600">', '<a:pPr algn="l">' -replace '<a:buFont typeface="Arial"/><a:buChar char="."/>', '' }
    "nofooter"    { $c = $c -replace '(?s)<p:sp>(?:(?!</p:sp>).)*?(fline|ftext|pnum)(?:(?!</p:sp>).)*?</p:sp>', '' }
    "noroundrect" { $c = $c -replace 'prst="roundRect"', 'prst="rect"' }
    "nostrip"     { $c = $c -replace '(?s)<p:sp>(?:(?!</p:sp>).)*?kpi-strip(?:(?!</p:sp>).)*?</p:sp>', '' }
    "emptyp"      { $c = $c -replace '<a:p/>', '<a:p><a:endParaRPr lang="en-GB"/></a:p>' }
}
$e.Delete()
$ne = $zip.CreateEntry('ppt/slides/slide1.xml')
$sw = New-Object System.IO.StreamWriter($ne.Open(), (New-Object System.Text.UTF8Encoding($false)))
$sw.Write($c); $sw.Close()
$zip.Dispose()
Write-Output "surgery $mode done -> $dst"
