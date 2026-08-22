# Minimal 1-slide deck, no charts - isolate package plumbing
$ErrorActionPreference = "Stop"
. "C:\Users\Sandeep_fastranking\Desktop\Devin\pptx_lib.ps1"
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = "C:\Users\Sandeep_fastranking\Desktop\Devin\pptx_min"
if (Test-Path $root) { Remove-Item $root -Recurse -Force }
New-Item -ItemType Directory -Path $root | Out-Null

$slideContent = (XmlShape 2 "t" 1 1 8 1.5 (XmlPara "Minimal Test" 32 $true "0F172A" "l" $false 0) $null $null) +
                (XmlShape 3 "box" 1 3 4 1.2 (XmlPara "Card value" 12 $false "475569" "l" $false 0) "FFFFFF" "E2E8F0" 1 "roundRect") +
                (XmlTable 10 6 2 @(1.5, 1.5) @(@("H1", "H2"), @("a", "1"), @("b", "2")) 0.3 10 10 @($false, $true))

$ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'
Write-Part $root "[Content_Types].xml" $ct
Write-Part $root "_rels/.rels" '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>'
Write-Part $root "ppt/presentation.xml" "<?xml version=`"1.0`" encoding=`"UTF-8`" standalone=`"yes`"?><p:presentation $NS><p:sldMasterIdLst><p:sldMasterId id=`"2147483648`" r:id=`"rId1`"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id=`"256`" r:id=`"rId2`"/></p:sldIdLst><p:sldSz cx=`"12192000`" cy=`"6858000`" type=`"screen16x9`"/><p:notesSz cx=`"6858000`" cy=`"9144000`"/><p:defaultTextStyle><a:defPPr><a:defRPr lang=`"en-GB`"/></a:defPPr><a:lvl1pPr marL=`"0`" algn=`"l`" defTabSz=`"914400`" rtl=`"0`"><a:defRPr sz=`"1200`"><a:latin typeface=`"Segoe UI`"/></a:defRPr></a:lvl1pPr></p:defaultTextStyle></p:presentation>"
Write-Part $root "ppt/_rels/presentation.xml.rels" '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/><Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/></Relationships>'
Write-Part $root "_rels/.rels" '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'
Write-Part $root "ppt/slides/slide1.xml" (New-SlideXml $slideContent)
Write-Part $root "ppt/slides/_rels/slide1.xml.rels" '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>'
# copy master/layout/theme from full build tree if exists, else write minimal
$fullRoot = "C:\Users\Sandeep_fastranking\Desktop\Devin\pptx_build"
foreach ($p in @("ppt/slideMasters/slideMaster1.xml", "ppt/slideMasters/_rels/slideMaster1.xml.rels", "ppt/slideLayouts/slideLayout1.xml", "ppt/slideLayouts/_rels/slideLayout1.xml.rels", "ppt/theme/theme1.xml", "ppt/presProps.xml", "ppt/viewProps.xml", "ppt/tableStyles.xml", "docProps/core.xml", "docProps/app.xml")) {
    $src = Join-Path $fullRoot ($p -replace '/', '\')
    $dst = Join-Path $root ($p -replace '/', '\')
    $dd = [System.IO.Path]::GetDirectoryName($dst)
    if (-not (Test-Path $dd)) { New-Item -ItemType Directory -Path $dd -Force | Out-Null }
    Copy-Item $src $dst
}
Zip-Directory $root "C:\Users\Sandeep_fastranking\Desktop\Devin\min_test.pptx"
Write-Output "min_test.pptx written"
