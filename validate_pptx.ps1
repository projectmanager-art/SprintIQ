# Validate the generated pptx: XML well-formedness, chart wiring, key figures
$path = "C:\Users\Sandeep_fastranking\Desktop\Devin\Management_Invoice_Project_Analysis.pptx"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($path)
$errors = 0
$chartTokens = 0
$allText = New-Object System.Text.StringBuilder
foreach ($e in $zip.Entries) {
    if ($e.FullName -match '\.xml$|\.rels$') {
        try {
            $sr = New-Object System.IO.StreamReader($e.Open())
            $content = $sr.ReadToEnd(); $sr.Close()
            $doc = New-Object System.Xml.XmlDocument
            $doc.LoadXml($content)
            if ($e.FullName -match 'slides/slide\d+\.xml$' -and $content -cmatch '"CHART\d"') { Write-Output "WARN: unreplaced chart token in $($e.FullName)"; $chartTokens++ }
            if ($e.FullName -match 'slides/slide\d+\.xml$') {
                # collect visible text
                $ns = New-Object System.Xml.XmlNamespaceManager($doc.NameTable)
                $ns.AddNamespace("a", "http://schemas.openxmlformats.org/drawingml/2006/main")
                foreach ($t in $doc.SelectNodes("//a:t", $ns)) { [void]$allText.Append($t.InnerText + " | ") }
            }
        } catch {
            Write-Output "XML ERROR in $($e.FullName): $($_.Exception.Message)"
            $errors++
        }
    }
}
Write-Output "Parts: $($zip.Entries.Count), XML errors: $errors, chart tokens left: $chartTokens"
$txt = $allText.ToString()
$checks = @("39,049.20", "32,834.40", "6,214.80", "84.1%", "536h 51m", "367h 50m", "328h 55m", "55h 47m", "384h 42m", "AMEN SHOES", "CATESBY ENGLAND", "NWT", "Executive Summary", "Recommended Management Actions", "CONFIDENTIAL")
$ix = 0
foreach ($c in $checks) { $ix++; $found = $txt.Contains($c); Write-Output ("check{0:D2} [{1}]: {2}" -f $ix, $c, $(if ($found) { "OK" } else { "MISSING" })) }
$pound = [char]163
Write-Output ("pound sign present: " + $txt.Contains([string]$pound))
$zip.Dispose()
