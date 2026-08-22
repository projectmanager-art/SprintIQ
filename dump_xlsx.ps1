param(
    [string]$Path = "C:\Users\Sandeep_fastranking\Desktop\Devin\source.xlsx",
    [string]$OutDir = "C:\Users\Sandeep_fastranking\Desktop\Devin\extracted",
    [switch]$Dump
)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($Path)

# Shared strings
$sharedStrings = @()
$ssEntry = $zip.Entries | Where-Object { $_.FullName -eq 'xl/sharedStrings.xml' }
if ($ssEntry) {
    $reader = New-Object System.IO.StreamReader($ssEntry.Open())
    [xml]$ssXml = $reader.ReadToEnd()
    $reader.Close()
    $ns = New-Object System.Xml.XmlNamespaceManager($ssXml.NameTable)
    $ns.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
    foreach ($si in $ssXml.SelectNodes("//x:si", $ns)) {
        $texts = $si.SelectNodes(".//x:t", $ns) | ForEach-Object { $_.'#text' }
        $sharedStrings += ($texts -join "")
    }
}

# Workbook sheets
$wbEntry = $zip.Entries | Where-Object { $_.FullName -eq 'xl/workbook.xml' }
$reader = New-Object System.IO.StreamReader($wbEntry.Open())
[xml]$wbXml = $reader.ReadToEnd()
$reader.Close()
$nsW = New-Object System.Xml.XmlNamespaceManager($wbXml.NameTable)
$nsW.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
$nsW.AddNamespace("r", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")

# rels to map rId -> target
$relsEntry = $zip.Entries | Where-Object { $_.FullName -eq 'xl/_rels/workbook.xml.rels' }
$reader = New-Object System.IO.StreamReader($relsEntry.Open())
[xml]$relsXml = $reader.ReadToEnd()
$reader.Close()
$ridMap = @{}
foreach ($rel in $relsXml.Relationships.Relationship) {
    $ridMap[$rel.Id] = $rel.Target
}

# styles: detect date-formatted cells via numFmt
$stylesEntry = $zip.Entries | Where-Object { $_.FullName -eq 'xl/styles.xml' }
$dateStyleIds = @{}
if ($stylesEntry) {
    $reader = New-Object System.IO.StreamReader($stylesEntry.Open())
    [xml]$stXml = $reader.ReadToEnd()
    $reader.Close()
    $nsS = New-Object System.Xml.XmlNamespaceManager($stXml.NameTable)
    $nsS.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
    $customFmts = @{}
    foreach ($nf in $stXml.SelectNodes("//x:numFmts/x:numFmt", $nsS)) {
        $customFmts[[int]$nf.numFmtId] = $nf.formatCode
    }
    $builtinDateIds = @(14,15,16,17,22,27,28,30,31,36,45,46,47,50,57,58)
    $cellXfs = $stXml.SelectNodes("//x:cellXfs/x:xf", $nsS)
    $idx = 0
    foreach ($xf in $cellXfs) {
        $nfId = [int]$xf.numFmtId
        $isDate = $false
        if ($builtinDateIds -contains $nfId) { $isDate = $true }
        elseif ($customFmts.ContainsKey($nfId)) {
            $code = $customFmts[$nfId].ToLower()
            if ($code -match '[dmy]' -and $code -notmatch '\[red\]|0\.0') { $isDate = $true }
        }
        if ($isDate) { $dateStyleIds[$idx] = $true }
        $idx++
    }
}

function Convert-SheetToRows($sheetPath, $sheetName) {
    $entry = $zip.Entries | Where-Object { $_.FullName -eq $sheetPath }
    if (-not $entry) { return }
    $reader = New-Object System.IO.StreamReader($entry.Open())
    [xml]$xml = $reader.ReadToEnd()
    $reader.Close()
    $ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
    $ns.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
    $rows = @()
    foreach ($row in $xml.SelectNodes("//x:sheetData/x:row", $ns)) {
        $cells = @{}
        $maxCol = 0
        foreach ($c in $row.SelectNodes("x:c", $ns)) {
            $ref = $c.r
            $colLetters = ($ref -replace '[0-9]', '')
            $colNum = 0
            foreach ($ch in $colLetters.ToCharArray()) { $colNum = $colNum * 26 + ([int][char]$ch - 64) }
            if ($colNum -gt $maxCol) { $maxCol = $colNum }
            $t = $c.t
            $s = [int]$c.s
            $vNode = $c.SelectSingleNode("x:v", $ns)
            $isNode = $c.SelectSingleNode("x:is", $ns)
            $val = ""
            if ($t -eq 's' -and $vNode) {
                $val = $sharedStrings[[int]$vNode.InnerText]
            } elseif ($t -eq 'inlineStr' -and $isNode) {
                $val = ($isNode.SelectNodes(".//x:t", $ns) | ForEach-Object { $_.'#text' }) -join ""
            } elseif ($vNode) {
                $raw = $vNode.InnerText
                if ($dateStyleIds.ContainsKey($s) -and $raw -match '^[0-9]+(\.[0-9]+)?$') {
                    $val = ([DateTime]::FromOADate([double]$raw)).ToString("yyyy-MM-dd")
                } else { $val = $raw }
            }
            $cells[$colNum] = $val
        }
        $rowArr = @()
        for ($i = 1; $i -le $maxCol; $i++) {
            $rowArr += $(if ($cells.ContainsKey($i)) { $cells[$i] } else { "" })
        }
        $rows += ,($rowArr)
    }
    return $rows
}

foreach ($sheet in $wbXml.SelectNodes("//x:sheets/x:sheet", $nsW)) {
    $name = $sheet.name
    $rid = $sheet.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
    $target = $ridMap[$rid]
    if ($target -notmatch '^xl/') { $target = "xl/" + $target }
    Write-Output "=== SHEET: $name (file: $target) ==="
    $rows = Convert-SheetToRows $target $name
    Write-Output ("Total rows: " + $rows.Count)
    $show = [Math]::Min(10, $rows.Count)
    for ($r = 0; $r -lt $show; $r++) {
        Write-Output ("R$($r+1): " + ($rows[$r] -join " | "))
    }
    if ($Dump) {
        if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }
        $safe = ($name -replace '[^\w\-]', '_')
        $csvPath = Join-Path $OutDir "$safe.csv"
        $lines = foreach ($rowArr in $rows) {
            ($rowArr | ForEach-Object {
                $v = [string]$_
                if ($v -match '[",\r\n]') { '"' + ($v -replace '"', '""') + '"' } else { $v }
            }) -join ","
        }
        [System.IO.File]::WriteAllLines($csvPath, $lines, (New-Object System.Text.UTF8Encoding($false)))
        Write-Output "Wrote $csvPath"
    }
}
$zip.Dispose()
