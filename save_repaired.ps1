# Attach to running PowerPoint, save repaired copy for diffing
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
Write-Output ("presentations: " + $ppt.Presentations.Count)
$pres = $ppt.Presentations.Item(1)
Write-Output ("name: " + $pres.Name + " slides: " + $pres.Slides.Count)
$pres.SaveCopyAs("C:\Users\Sandeep_fastranking\Desktop\Devin\full_repaired.pptx")
Write-Output "saved repaired copy"
$pres.Close()
$ppt.Quit()
