# Inject my slide XML into probe3.pptx (PowerPoint-authored skeleton) and open-test
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$src = "C:\Users\Sandeep_fastranking\Desktop\Devin\probe3.pptx"
$dst = "C:\Users\Sandeep_fastranking\Desktop\Devin\skeleton_s2.pptx"
Copy-Item $src $dst -Force
$mySlide = [System.IO.File]::ReadAllText("C:\Users\Sandeep_fastranking\Desktop\Devin\s2_mine.xml")
$zip = [System.IO.Compression.ZipFile]::Open($dst, [System.IO.Compression.ZipArchiveMode]::Update)
$e = $zip.Entries | Where-Object { $_.FullName -eq 'ppt/slides/slide1.xml' }
$e.Delete()
$ne = $zip.CreateEntry('ppt/slides/slide1.xml')
$sw = New-Object System.IO.StreamWriter($ne.Open(), (New-Object System.Text.UTF8Encoding($false)))
$sw.Write($mySlide); $sw.Close()
$zip.Dispose()
Write-Output "injected"
