# pptx_lib.ps1 - minimal OOXML (.pptx) generation library (dot-source this file)
# ASCII-only source. All text escaped. EMU: 914400 per inch, 12700 per pt.

$script:EMU = 914400
function IN([double]$v) { return [int][Math]::Round($v * $script:EMU) }
function XmlEsc($s) { return ([string]$s) -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;' -replace '"', '&quot;' }

$script:NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
$script:NSC = 'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'

# ---------------- text / shapes ----------------
function XmlPara($text, [double]$size = 12, [bool]$bold = $false, [string]$color = "0F172A", [string]$align = "l", [bool]$bullet = $false, [double]$spaceAfter = 4, [bool]$italic = $false) {
    $sz = [int]($size * 100)
    $b = if ($bold) { ' b="1"' } else { '' }
    $i = if ($italic) { ' i="1"' } else { '' }
    $pPr = "<a:pPr algn=`"$align`""
    if ($bullet) { $pPr += ' marL="228600" indent="-228600"' }
    $pPr += '>'
    if ($spaceAfter -gt 0) { $pPr += "<a:spcAft><a:spcPts val=`"$([int]($spaceAfter*100))`"/></a:spcAft>" }
    if ($bullet) { $pPr += '<a:buFont typeface="Arial"/><a:buChar char="' + [char]8226 + '"/>' }
    $pPr += '</a:pPr>'
    return "<a:p>$pPr<a:r><a:rPr lang=`"en-GB`" sz=`"$sz`"$b$i><a:solidFill><a:srgbClr val=`"$color`"/></a:solidFill><a:latin typeface=`"Segoe UI`"/></a:rPr><a:t>$(XmlEsc $text)</a:t></a:r></a:p>"
}

function XmlShape([int]$id, [string]$name, [double]$x, [double]$y, [double]$w, [double]$h, [string]$parasXml, [string]$fill, [string]$line, [double]$lineW = 0.75, [string]$geom = "rect", [string]$anchor = "t", [double]$marginL = 0.08, [double]$marginT = 0.04) {
    $fillXml = if ($fill) { "<a:solidFill><a:srgbClr val=`"$fill`"/></a:solidFill>" } else { "<a:noFill/>" }
    $lineXml = if ($line) { "<a:ln w=`"$([int]($lineW*12700))`"><a:solidFill><a:srgbClr val=`"$line`"/></a:solidFill></a:ln>" } else { "<a:ln><a:noFill/></a:ln>" }
    if ([string]::IsNullOrEmpty($parasXml)) { $parasXml = "<a:p/>" }  # txBody requires >= 1 paragraph
    $ml = IN($marginL); $mt = IN($marginT)
    return @"
<p:sp>
 <p:nvSpPr><p:cNvPr id="$id" name="$(XmlEsc $name)"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
 <p:spPr><a:xfrm><a:off x="$(IN $x)" y="$(IN $y)"/><a:ext cx="$(IN $w)" cy="$(IN $h)"/></a:xfrm><a:prstGeom prst="$geom"><a:avLst/></a:prstGeom>$fillXml$lineXml</p:spPr>
 <p:txBody><a:bodyPr wrap="square" anchor="$anchor" lIns="$ml" tIns="$mt" rIns="$ml" bIns="$mt"/><a:lstStyle/>$parasXml</p:txBody>
</p:sp>
"@
}

# KPI card: white rounded rect, colored top strip, label + big value + hint
function XmlKpi([int]$id, [double]$x, [double]$y, [double]$w, [double]$h, [string]$label, [string]$value, [string]$hint, [string]$color) {
    $strip = XmlShape ($id) "kpi-strip" $x $y $w 0.07 "" $color $null
    $card = XmlShape ($id + 1) "kpi-card" $x $y $w $h "" "FFFFFF" "E2E8F0" 1 "roundRect"
    $txt = (XmlPara $label 10.5 $true "64748B" "l" $false 2) + (XmlPara $value 20 $true $color "l" $false 1)
    if ($hint) { $txt += XmlPara $hint 9.5 $false "64748B" "l" $false 0 }
    $body = XmlShape ($id + 2) "kpi-txt" ($x + 0.05) ($y + 0.10) ($w - 0.1) ($h - 0.14) $txt $null $null
    return $strip + $card + $body
}

# ---------------- table ----------------
function XmlTable([int]$id, [double]$x, [double]$y, [double[]]$colW, [array]$rows, [double]$rowH = 0.32, [double]$hdrSize = 10, [double]$cellSize = 10.5, [bool[]]$numCols = @(), [string]$hdrFill = "0F172A") {
    $grid = ($colW | ForEach-Object { "<a:gridCol w=`"$(IN $_)`"/>" }) -join ""
    $trXml = ""
    for ($r = 0; $r -lt $rows.Count; $r++) {
        $isHdr = ($r -eq 0)
        $tcXml = ""
        for ($c = 0; $c -lt $rows[$r].Count; $c++) {
            $isNum = ($numCols.Count -gt $c -and $numCols[$c])
            $align = if ($isNum) { "r" } else { "l" }
            if ($isHdr) {
                $txtColor = "FFFFFF"; $bold = $true; $sz = $hdrSize; $fill = $hdrFill
            } else {
                $txtColor = "0F172A"; $bold = $false; $sz = $cellSize
                $fill = if ($r % 2 -eq 0) { "F8FAFC" } else { "FFFFFF" }
            }
            # allow inline color override with syntax "||RRGGBB||text"
            $cellText = [string]$rows[$r][$c]
            if ($cellText -match '^\|\|([0-9A-Fa-f]{6})\|(b?)\|\|(.*)$') {
                $txtColor = $Matches[1]; $bold = ($Matches[2] -eq 'b'); $cellText = $Matches[3]
            }
            $para = XmlPara $cellText $sz $bold $txtColor $align $false 0
            $tcXml += "<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>$para</a:txBody><a:tcPr marL=`"$(IN 0.06)`" marR=`"$(IN 0.06)`" marT=`"$(IN 0.02)`" marB=`"$(IN 0.02)`" anchor=`"ctr`"><a:solidFill><a:srgbClr val=`"$fill`"/></a:solidFill></a:tcPr></a:tc>"
        }
        $trXml += "<a:tr h=`"$(IN $rowH)`">$tcXml</a:tr>"
    }
    $totalW = ($colW | Measure-Object -Sum).Sum
    $totalH = $rowH * $rows.Count
    return @"
<p:graphicFrame>
 <p:nvGraphicFramePr><p:cNvPr id="$id" name="Table $id"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>
 <p:xfrm><a:off x="$(IN $x)" y="$(IN $y)"/><a:ext cx="$(IN $totalW)" cy="$(IN $totalH)"/></p:xfrm>
 <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1" bandRow="1"/><a:tblGrid>$grid</a:tblGrid>$trXml</a:tbl></a:graphicData></a:graphic>
</p:graphicFrame>
"@
}

# ---------------- charts ----------------
function XmlCatRef($cats, [string]$col = "A") {
    $pts = ""
    for ($i = 0; $i -lt $cats.Count; $i++) { $pts += "<c:pt idx=`"$i`"><c:v>$(XmlEsc $cats[$i])</c:v></c:pt>" }
    $last = $cats.Count + 1
    return "<c:cat><c:strRef><c:f>Sheet1!`$$col`$2:`$$col`$$last</c:f><c:strCache><c:ptCount val=`"$($cats.Count)`"/>$pts</c:strCache></c:strRef></c:cat>"
}
function XmlValRef($vals, [string]$colLetter, [string]$fmtCode = "General") {
    $pts = ""
    for ($i = 0; $i -lt $vals.Count; $i++) { $pts += "<c:pt idx=`"$i`"><c:v>$($vals[$i])</c:v></c:pt>" }
    $last = $vals.Count + 1
    return "<c:val><c:numRef><c:f>Sheet1!`$$colLetter`$2:`$$colLetter`$$last</c:f><c:numCache><c:formatCode>$fmtCode</c:formatCode><c:ptCount val=`"$($vals.Count)`"/>$pts</c:numCache></c:numRef></c:val>"
}
function XmlSerName($name, [string]$ref) {
    return "<c:tx><c:strRef><c:f>$ref</c:f><c:strCache><c:ptCount val=`"1`"/><c:pt idx=`"0`"><c:v>$(XmlEsc $name)</c:v></c:pt></c:strCache></c:strRef></c:tx>"
}
function XmlDLbls([string]$fmtCode = "", [bool]$pct = $false) {
    $fmt = if ($fmtCode) { "<c:numFmt formatCode=`"$fmtCode`" sourceLinked=`"0`"/>" } else { "" }
    $sv = if ($pct) { "0" } else { "1" }
    $sp = if ($pct) { "1" } else { "0" }
    return "<c:dLbls>$fmt<c:showLegendKey val=`"0`"/><c:showVal val=`"$sv`"/><c:showCatName val=`"0`"/><c:showSerName val=`"0`"/><c:showPercent val=`"$sp`"/><c:showBubbleSize val=`"0`"/></c:dLbls>"
}
function XmlCatAx([string]$pos = "b") {
    return "<c:catAx><c:axId val=`"100000001`"/><c:scaling><c:orientation val=`"minMax`"/></c:scaling><c:delete val=`"0`"/><c:axPos val=`"$pos`"/><c:majorTickMark val=`"none`"/><c:tickLblPos val=`"nextTo`"/><c:spPr><a:ln><a:solidFill><a:srgbClr val=`"CBD5E1`"/></a:solidFill></a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz=`"1000`"><a:solidFill><a:srgbClr val=`"475569`"/></a:solidFill><a:latin typeface=`"Segoe UI`"/></a:defRPr></a:pPr><a:endParaRPr lang=`"en-GB`"/></a:p></c:txPr><c:crossAx val=`"100000002`"/><c:crosses val=`"autoZero`"/><c:auto val=`"1`"/><c:lblAlgn val=`"ctr`"/><c:lblOffset val=`"100`"/></c:catAx>"
}
function XmlValAx([string]$fmtCode = "General", [string]$pos = "l") {
    return "<c:valAx><c:axId val=`"100000002`"/><c:scaling><c:orientation val=`"minMax`"/></c:scaling><c:delete val=`"0`"/><c:axPos val=`"$pos`"/><c:majorGridlines><c:spPr><a:ln><a:solidFill><a:srgbClr val=`"E2E8F0`"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode=`"$fmtCode`" sourceLinked=`"0`"/><c:majorTickMark val=`"none`"/><c:tickLblPos val=`"nextTo`"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz=`"1000`"><a:solidFill><a:srgbClr val=`"475569`"/></a:solidFill><a:latin typeface=`"Segoe UI`"/></a:defRPr></a:pPr><a:endParaRPr lang=`"en-GB`"/></a:p></c:txPr><c:crossAx val=`"100000001`"/><c:crosses val=`"autoZero`"/></c:valAx>"
}
function XmlChartTitle($title) {
    if (-not $title) { return "" }
    return "<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz=`"1200`" b=`"1`"><a:solidFill><a:srgbClr val=`"0F172A`"/></a:solidFill><a:latin typeface=`"Segoe UI`"/></a:defRPr></a:pPr><a:r><a:rPr lang=`"en-GB`" sz=`"1200`" b=`"1`"><a:solidFill><a:srgbClr val=`"0F172A`"/></a:solidFill><a:latin typeface=`"Segoe UI`"/></a:rPr><a:t>$(XmlEsc $title)</a:t></a:r></a:p></c:rich></c:tx><c:overlay val=`"0`"/></c:title>"
}

# $series: @(@{name; values; color}, ...) ; $cats: string[]
function New-BarChartXml($cats, $series, [string]$title = "", [string]$barDir = "col", [bool]$stacked = $false, [string]$fmtCode = "General", [bool]$legend = $true, [bool]$dataLabels = $false, [bool]$varyColors = $false) {
    $serXml = ""
    for ($s = 0; $s -lt $series.Count; $s++) {
        $col = [char]([int][char]'B' + $s)
        $gap = if ($stacked) { "<c:gapWidth val=`"60`"/>" } else { "<c:gapWidth val=`"80`"/>" }
        $dpts = ""
        if ($varyColors -and $series[$s].ptColors) {
            for ($p = 0; $p -lt $series[$s].ptColors.Count; $p++) {
                $dpts += "<c:dPt><c:idx val=`"$p`"/><c:bubble3D val=`"0`"/><c:spPr><a:solidFill><a:srgbClr val=`"$($series[$s].ptColors[$p])`"/></a:solidFill></c:spPr></c:dPt>"
            }
        }
        $serXml += "<c:ser><c:idx val=`"$s`"/><c:order val=`"$s`"/>" + (XmlSerName $series[$s].name "Sheet1!`$$col`$1") +
            "<c:spPr><a:solidFill><a:srgbClr val=`"$($series[$s].color)`"/></a:solidFill></c:spPr>" +
            $dpts + $(if ($dataLabels) { XmlDLbls $fmtCode } else { "" }) +
            (XmlCatRef $cats) + (XmlValRef $series[$s].values ([string]$col) $fmtCode) + "</c:ser>"
    }
    $grouping = if ($stacked) { "stacked" } else { "clustered" }
    $overlap = if ($stacked) { "<c:overlap val=`"100`"/>" } else { "" }
    $catPos = if ($barDir -eq "bar") { "l" } else { "b" }
    $valPos = if ($barDir -eq "bar") { "b" } else { "l" }
    $legendXml = if ($legend) { "<c:legend><c:legendPos val=`"b`"/><c:overlay val=`"0`"/><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz=`"1000`"><a:solidFill><a:srgbClr val=`"475569`"/></a:solidFill><a:latin typeface=`"Segoe UI`"/></a:defRPr></a:pPr><a:endParaRPr lang=`"en-GB`"/></a:p></c:txPr></c:legend>" } else { "" }
    return @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace $script:NSC>
 <c:lang val="en-GB"/>
 <c:chart>
  $(XmlChartTitle $title)
  <c:autoTitleDeleted val="0"/>
  <c:plotArea><c:layout/>
   <c:barChart><c:barDir val="$barDir"/><c:grouping val="$grouping"/><c:varyColors val="$(if($varyColors){1}else{0})"/>
    $serXml
    $gap$overlap
    <c:axId val="100000001"/><c:axId val="100000002"/>
   </c:barChart>
   $(XmlCatAx $catPos)
   $(XmlValAx $fmtCode $valPos)
  </c:plotArea>
  $legendXml
  <c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>
 </c:chart>
 <c:externalData r:id="rId1"><c:autoUpdate val="0"/></c:externalData>
</c:chartSpace>
"@
}

function New-LineChartXml($cats, $series, [string]$title = "", [string]$fmtCode = "General", [bool]$legend = $true, [bool]$dataLabels = $false) {
    $serXml = ""
    for ($s = 0; $s -lt $series.Count; $s++) {
        $col = [string][char]([int][char]'B' + $s)
        $serXml += "<c:ser><c:idx val=`"$s`"/><c:order val=`"$s`"/>" + (XmlSerName $series[$s].name "Sheet1!`$$col`$1") +
            "<c:spPr><a:ln w=`"28575`"><a:solidFill><a:srgbClr val=`"$($series[$s].color)`"/></a:solidFill></a:ln></c:spPr>" +
            "<c:marker><c:symbol val=`"circle`"/><c:size val=`"6`"/><c:spPr><a:solidFill><a:srgbClr val=`"$($series[$s].color)`"/></a:solidFill></c:spPr></c:marker>" +
            $(if ($dataLabels) { XmlDLbls $fmtCode } else { "" }) +
            (XmlCatRef $cats) + (XmlValRef $series[$s].values $col $fmtCode) + "<c:smooth val=`"0`"/></c:ser>"
    }
    $legendXml = if ($legend) { "<c:legend><c:legendPos val=`"b`"/><c:overlay val=`"0`"/></c:legend>" } else { "" }
    return @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace $script:NSC>
 <c:lang val="en-GB"/>
 <c:chart>
  $(XmlChartTitle $title)
  <c:plotArea><c:layout/>
   <c:lineChart><c:grouping val="standard"/>
    $serXml
    <c:axId val="100000001"/><c:axId val="100000002"/>
   </c:lineChart>
   $(XmlCatAx "b")
   $(XmlValAx $fmtCode "l")
  </c:plotArea>
  $legendXml
  <c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>
 </c:chart>
 <c:externalData r:id="rId1"><c:autoUpdate val="0"/></c:externalData>
</c:chartSpace>
"@
}

function New-DoughnutXml($cats, $values, $colors, [string]$title = "", [bool]$pct = $true) {
    $dpts = ""
    for ($p = 0; $p -lt $colors.Count; $p++) {
        $dpts += "<c:dPt><c:idx val=`"$p`"/><c:bubble3D val=`"0`"/><c:spPr><a:solidFill><a:srgbClr val=`"$($colors[$p])`"/></a:solidFill></c:spPr></c:dPt>"
    }
    $ser = "<c:ser><c:idx val=`"0`"/><c:order val=`"0`"/>" + (XmlSerName "Share" "Sheet1!`$B`$1") + $dpts + (XmlDLbls "" $pct) + (XmlCatRef $cats) + (XmlValRef $values "B") + "</c:ser>"
    return @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace $script:NSC>
 <c:lang val="en-GB"/>
 <c:chart>
  $(XmlChartTitle $title)
  <c:plotArea><c:layout/>
   <c:doughnutChart><c:varyColors val="1"/>
    $ser
    <c:dLbls><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="$(if($pct){1}else{0})"/><c:showBubbleSize val="0"/></c:dLbls>
    <c:firstSliceAng val="0"/><c:holeSize val="55"/>
   </c:doughnutChart>
  </c:plotArea>
  <c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>
  <c:plotVisOnly val="1"/>
 </c:chart>
 <c:externalData r:id="rId1"><c:autoUpdate val="0"/></c:externalData>
</c:chartSpace>
"@
}

function XmlChartFrame([int]$id, [double]$x, [double]$y, [double]$w, [double]$h, [string]$rid) {
    return @"
<p:graphicFrame>
 <p:nvGraphicFramePr><p:cNvPr id="$id" name="Chart $id"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>
 <p:xfrm><a:off x="$(IN $x)" y="$(IN $y)"/><a:ext cx="$(IN $w)" cy="$(IN $h)"/></p:xfrm>
 <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="$rid"/></a:graphicData></a:graphic>
</p:graphicFrame>
"@
}

# ---------------- embedded xlsx for chart data ----------------
function New-ChartXlsx([string]$path, [string[]]$headers, [array]$rows) {
    # rows: array of arrays (string/number)
    $sheetRows = ""
    $all = @($headers) + $rows
    for ($r = 0; $r -lt $all.Count; $r++) {
        $cells = ""
        $rowData = $all[$r]
        for ($c = 0; $c -lt $rowData.Count; $c++) {
            $ref = [string][char]([int][char]'A' + $c) + ($r + 1)
            $v = $rowData[$c]
            if ($v -is [double] -or $v -is [int] -or $v -is [decimal]) {
                $cells += "<c r=`"$ref`"><v>$v</v></c>"
            } else {
                $cells += "<c r=`"$ref`" t=`"inlineStr`"><is><t>$(XmlEsc $v)</t></is></c>"
            }
        }
        $sheetRows += "<row r=`"$($r+1)`">$cells</row>"
    }
    $sheetXml = "<?xml version=`"1.0`" encoding=`"UTF-8`" standalone=`"yes`"?><worksheet xmlns=`"http://schemas.openxmlformats.org/spreadsheetml/2006/main`"><sheetData>$sheetRows</sheetData></worksheet>"
    $ctXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'
    $relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    $wbXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>'
    $wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'

    if (Test-Path $path) { Remove-Item $path -Force }
    $fs = [System.IO.File]::Create($path)
    $zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    foreach ($entry in @(@("[Content_Types].xml", $ctXml), @("_rels/.rels", $relsXml), @("xl/workbook.xml", $wbXml), @("xl/_rels/workbook.xml.rels", $wbRels), @("xl/worksheets/sheet1.xml", $sheetXml))) {
        $e = $zip.CreateEntry($entry[0])
        $sw = New-Object System.IO.StreamWriter($e.Open(), $utf8)
        $sw.Write($entry[1]); $sw.Close()
    }
    $zip.Dispose(); $fs.Close()
}

# ---------------- package plumbing ----------------
function Write-Part([string]$root, [string]$relPath, [string]$content) {
    $full = Join-Path $root ($relPath -replace '/', [System.IO.Path]::DirectorySeparatorChar)
    $dir = [System.IO.Path]::GetDirectoryName($full)
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllText($full, $content, (New-Object System.Text.UTF8Encoding($false)))
}

function Zip-Directory([string]$srcDir, [string]$outFile) {
    if (Test-Path $outFile) { Remove-Item $outFile -Force }
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $fs = [System.IO.File]::Create($outFile)
    $zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
    $files = Get-ChildItem -Path $srcDir -Recurse -File
    foreach ($f in $files) {
        $rel = $f.FullName.Substring($srcDir.Length).TrimStart('\', '/') -replace '\\', '/'
        $entry = $zip.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
        $es = $entry.Open()
        $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
        $es.Write($bytes, 0, $bytes.Length)
        $es.Close()
    }
    $zip.Dispose(); $fs.Close()
}

function New-SlideXml([string]$shapesXml) {
    return @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld $script:NS>
 <p:cSld><p:spTree>
  <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
  <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
  $shapesXml
 </p:spTree></p:cSld>
 <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>
"@
}
