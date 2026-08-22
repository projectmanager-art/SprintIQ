# Probe PowerPoint COM state step by step
$ppt = $null
for ($i = 0; $i -lt 15 -and $null -eq $ppt; $i++) {
    try { $ppt = New-Object -ComObject PowerPoint.Application } catch { Start-Sleep -Seconds 2 }
}
Write-Output ("ppt null? " + ($null -eq $ppt))
try { $ppt.Visible = 1; Write-Output "visible set" } catch { Write-Output ("visible err: " + $_.Exception.Message) }
Start-Sleep -Seconds 3
$pres = $null
try { $pres = $ppt.Presentations.Add(); Write-Output ("pres null? " + ($null -eq $pres)) } catch { Write-Output ("pres err: " + $_.Exception.Message) }
if ($pres) {
    Write-Output ("slides count: " + $pres.Slides.Count)
    $slide = $null
    try { $slide = $pres.Slides.Add(1, 12) } catch { Write-Output ("slide err: " + $_.Exception.Message) }
    Write-Output ("slide null? " + ($null -eq $slide))
    if ($null -eq $slide) {
        try {
            $slide2 = $pres.Slides.AddSlide(1, $pres.SlideMaster.CustomLayouts.Item(7))
            Write-Output ("AddSlide worked? " + ($null -ne $slide2))
        } catch { Write-Output ("AddSlide err: " + $_.Exception.Message) }
    }
}
Write-Output "probe done - leaving app open"
