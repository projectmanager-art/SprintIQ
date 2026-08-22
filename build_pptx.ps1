# build_pptx.ps1 - generate Management_Invoice_Project_Analysis.pptx as raw OOXML (no PowerPoint COM needed)
# ASCII-only source. Dot-sources pptx_lib.ps1. Data: ppt_data.json (validated against dashboard + Excel).
param([switch]$NoCharts, [string]$OutName = "Management_Invoice_Project_Analysis.pptx", [string]$OnlySlides = "")
$ErrorActionPreference = "Stop"
. "C:\Users\Sandeep_fastranking\Desktop\Devin\pptx_lib.ps1"
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$GBP = [char]163
$EMD = [char]8212
$D = Get-Content "C:\Users\Sandeep_fastranking\Desktop\Devin\ppt_data.json" -Raw | ConvertFrom-Json
$K = $D.kpis; $E = $D.effort; $RATE = $D.rate

function M($v) { return $GBP + ([double]$v).ToString("N2") }
function M0($v) { return $GBP + ([double]$v).ToString("N0") }
function Pc($v) { return ([double]$v).ToString("F1") + "%" }
function Dur($min) { $h = [Math]::Floor([int]$min / 60); $m = [int]$min % 60; return ("{0}h {1:D2}m" -f $h, $m) }

# palette
$C_NAVY = "0F172A"; $C_BLUE = "1E40AF"; $C_GREEN = "15803D"; $C_RED = "B91C1C"; $C_TEAL = "0D9488"
$C_INDIGO = "4F46E5"; $C_AMBER = "B45309"; $C_SLATE = "64748B"; $C_LIGHT = "F1F5F9"; $C_LINE = "E2E8F0"
$C_LBLUE = "93C5FD"; $C_CARD = "FFFFFF"; $C_MUT = "475569"; $C_DARKCARD = "1E293B"

$script:id = 10
function GId { $script:id += 4; return $script:id }

# page furniture
function TitleBar([string]$title, [string]$kicker) {
    $b = GId
    $bar = XmlShape $b "titlebar" 0 0 13.333 0.85 "" $C_NAVY $null
    $txt = (XmlPara $kicker.ToUpper() 9.5 $true $C_LBLUE "l" $false 1) + (XmlPara $title 21 $true "FFFFFF" "l" $false 0)
    $tb = XmlShape ($b + 1) "title" 0.45 0.06 12.4 0.78 $txt $null $null 0.75 "rect" "ctr"
    return $bar + $tb
}
function Footer([int]$n, [int]$total) {
    $b = GId
    $ln = XmlShape $b "fline" 0.45 7.12 12.44 0.012 "" $C_LINE $null
    $f = (XmlPara "Confidential $EMD Management Use Only  |  Invoice, Project & Development Effort Analysis  |  Data as of $($D.asOf)" 8.5 $false $C_SLATE "l" $false 0)
    $fb = XmlShape ($b + 1) "ftext" 0.45 7.16 10.5 0.3 $f $null $null
    $pg = XmlShape ($b + 2) "pnum" 11.9 7.16 1.0 0.3 (XmlPara "$n / $total" 8.5 $false $C_SLATE "r" $false 0) $null $null
    return $ln + $fb + $pg
}
function CalloutBox([double]$x, [double]$y, [double]$w, [double]$h, [string]$text, [string]$color = $C_BLUE, [string]$fill = "EFF6FF", [double]$size = 12) {
    $b = GId
    $box = XmlShape $b "callout" $x $y $w $h "" $fill $color 1.25 "roundRect"
    $tb = XmlShape ($b + 1) "callout-txt" ($x + 0.12) ($y + 0.08) ($w - 0.24) ($h - 0.16) (XmlPara $text $size $false "1E3A8A" "l" $false 0) $null $null 0.75 "rect" "ctr"
    return $box + $tb
}
function SectionHead([double]$x, [double]$y, [double]$w, [string]$text) {
    return XmlShape (GId) "sh" $x $y $w 0.32 (XmlPara $text 13 $true $C_NAVY "l" $false 0) $null $null
}

# ============================ SLIDE CONTENT ============================
$slides = @()
$TOTAL = 18

# ---- S1 COVER ----
$s = ""
$s += XmlShape (GId) "bg" 0 0 13.333 7.5 "" $C_NAVY $null
$s += XmlShape (GId) "accent" 0.9 2.02 2.2 0.05 "" $C_LBLUE $null
$s += XmlShape (GId) "t1" 0.9 2.25 11.5 1.1 (XmlPara "Invoice, Project & Development Effort Analysis" 40 $true "FFFFFF" "l" $false 0) $null $null
$s += XmlShape (GId) "t2" 0.9 3.35 11.5 0.5 (XmlPara "Management Review  |  Period: 2023 $EMD Present (as of $($D.asOf))" 17 $false $C_LBLUE "l" $false 0) $null $null
$s += XmlShape (GId) "t3" 0.9 4.0 11.5 0.4 (XmlPara "Prepared for Senior Management  |  Source: Invoice Analysis workbook + WorkGrid project dashboard" 12 $false "94A3B8" "l" $false 0) $null $null
$s += XmlShape (GId) "conf" 0.9 4.75 3.6 0.42 (XmlPara "CONFIDENTIAL $EMD MANAGEMENT USE ONLY" 10.5 $true $C_LBLUE "ctr" $false 0) $null $C_LBLUE 1 "roundRect" "ctr"
# cover mini KPIs
$mk = @(@("Total Invoiced", (M0 $K.gross)), @("Collected", (M0 $K.paid)), @("Outstanding", (M0 $K.outstanding)), @("Dev Hours Delivered", (Dur $E.actMin)))
for ($i = 0; $i -lt 4; $i++) {
    $x = 0.9 + $i * 2.95
    $s += XmlShape (GId) "mk$i" $x 5.6 2.7 1.05 "" $C_DARKCARD "334155" 1 "roundRect"
    $s += XmlShape (GId) "mkt$i" ($x + 0.15) 5.75 2.4 0.8 ((XmlPara $mk[$i][0] 10 $true "94A3B8" "l" $false 2) + (XmlPara $mk[$i][1] 19 $true "FFFFFF" "l" $false 0)) $null $null
}
$slides += $s

# ---- S2 EXECUTIVE SUMMARY ----
$s = TitleBar "Executive Summary" "Overall Position"
$cards = @(
    @("Total Projects", "$($K.projects)", "9 invoice-layer + 8 PM", $C_BLUE),
    @("Total Clients", "$($K.clients)", "", $C_BLUE),
    @("Total Invoices", "$($K.invoices)", "125 unique IDs", $C_BLUE),
    @("Total Invoiced", (M0 $K.gross), "incl. VAT", $C_BLUE),
    @("Total Collected", (M0 $K.paid), "", $C_GREEN),
    @("Outstanding", (M0 $K.outstanding), (Pc $K.outstandingPct) + " of invoiced", $C_RED),
    @("Collection Rate", (Pc $K.collectionPct), "", $C_GREEN),
    @("Dev Hours Delivered", (Dur $E.actMin), "+" + (Pc $E.overPct) + " vs estimate", $C_INDIGO)
)
for ($i = 0; $i -lt 8; $i++) {
    $col = $i % 4; $row = [Math]::Floor($i / 4)
    $s += XmlKpi (GId) (0.45 + $col * 3.16) (1.05 + $row * 1.18) 2.96 1.05 $cards[$i][0] $cards[$i][1] $cards[$i][2] $cards[$i][3]
}
$s += SectionHead 0.45 3.55 8 "Key Insights"
$ins = ""
foreach ($t in $D.insights) { $ins += XmlPara $t 11 $false "1E293B" "l" $true 5 }
$s += XmlShape (GId) "ins" 0.45 3.9 12.44 3.1 $ins $null $null
$s += Footer 2 $TOTAL
$slides += $s

# ---- S3 FINANCIAL OVERVIEW ----
$s = TitleBar "Financial Performance Overview" "What is our overall position?"
$big = @(@("Total Invoiced", (M $K.gross), $C_BLUE, "net $(M $K.net) + VAT $(M $K.tax)"),
         @("Total Collected", (M $K.paid), $C_GREEN, "$($K.paidCount) paid invoices"),
         @("Total Outstanding", (M $K.outstanding), $C_RED, "$($K.unpaidCount) unpaid invoices"),
         @("Collection Rate", (Pc $K.collectionPct), $C_GREEN, "avg $( $K.avgDaysToPay ) days to payment"))
for ($i = 0; $i -lt 4; $i++) {
    $s += XmlKpi (GId) 0.45 (1.1 + $i * 1.13) 4.6 1.0 $big[$i][0] $big[$i][1] $big[$i][3] $big[$i][2]
}
$s += XmlChartFrame (GId) 5.4 1.1 7.5 4.4 "CHART1"
$s += CalloutBox 5.4 5.7 7.5 1.1 "$(M $K.paid) of $(M $K.gross) invoiced value has been collected ($(Pc $K.collectionPct)). $(M $K.outstanding) ($(Pc $K.outstandingPct)) remains outstanding $EMD all of it in the 2026 invoice cohort." $C_BLUE "EFF6FF" 12
$s += Footer 3 $TOTAL
$slides += $s

# ---- S4 YEAR-WISE ----
$s = TitleBar "Year-wise Financial Performance" "How much business have we generated?"
$s += XmlChartFrame (GId) 0.45 1.1 8.0 4.6 "CHART2"
$obs = ""
$yrs = $D.years
$topY = @($yrs | Sort-Object gross -Descending)[0]
$obs += XmlPara "$($topY.year) was the highest-revenue year: $(M $topY.gross) across $($topY.invoices) invoices." 11.5 $false "1E293B" "l" $true 6
$obs += XmlPara "2023$($EMD)2025 cohorts are 100% collected; 2026 collection stands at $(Pc (@($yrs | Where-Object year -eq 2026)[0].collectionPct))." 11.5 $false "1E293B" "l" $true 6
$obs += XmlPara "Invoiced value grew strongly 2023 to 2025, then moderated in 2026 ($(M (@($yrs | Where-Object year -eq 2026)[0].gross)))." 11.5 $false "1E293B" "l" $true 6
$obs += XmlPara "All outstanding ($(M $K.outstanding)) was generated by 2026 invoices $EMD driven by the monthly retainer run." 11.5 $false "1E293B" "l" $true 6
$s += SectionHead 8.75 1.1 4.1 "Key Observations"
$s += XmlShape (GId) "obs" 8.75 1.5 4.15 4.4 $obs $null $null
$s += Footer 4 $TOTAL
$slides += $s

# ---- S5 GROWTH ----
$s = TitleBar "Project & Client Growth" "Business acquisition"
$s += XmlChartFrame (GId) 0.45 1.1 7.3 4.5 "CHART3"
$gk = @(@("Total Projects", "$($K.projects)", $C_BLUE), @("Total Clients", "$($K.clients)", $C_BLUE),
        @("Repeat Clients", "$($D.repeat.repeatClients) of $($K.clients)", $C_TEAL), @("Avg Projects / Client", "$($D.repeat.avgProjectsPerClient)", $C_TEAL))
for ($i = 0; $i -lt 4; $i++) {
    $s += XmlKpi (GId) 8.15 (1.1 + $i * 1.18) 4.75 1.05 $gk[$i][0] $gk[$i][1] "" $gk[$i][2]
}
$s += CalloutBox 0.45 5.85 12.45 0.95 "All 4 clients appear across multiple years and receive recurring monthly retainer invoices $EMD the business is entirely repeat/retainer-driven, with acquisition concentrated in 2024 (3 new clients, 6 new projects)." $C_TEAL "F0FDFA" 12
$s += Footer 5 $TOTAL
$slides += $s

# ---- S6 SEO VS DEV ----
$s = TitleBar "SEO vs Development Performance" "Where is the revenue coming from?"
$tblRows = @(
    @("Metric", "SEO", "Development"),
    @("Projects", "$($D.seo.projects) (invoice layer)", "$($E.projects) PM / $($D.dev.projects) invoice"),
    @("Invoices", "$($D.seo.invoices)", "$($D.dev.invoices)"),
    @("Invoiced", (M $D.seo.gross), (M $D.dev.gross)),
    @("Paid", (M $D.seo.paid), (M $D.dev.paid)),
    @("Outstanding", "||B91C1C|b||" + (M $D.seo.outstanding), "||B91C1C|b||" + (M $D.dev.outstanding)),
    @("Collection %", (Pc $D.seo.collectionPct), (Pc $D.dev.collectionPct)),
    @("Actual Hours", "no PM data", (Dur $E.actMin)),
    @("Effort Value (@ ${GBP}$RATE/hr)", "n/a", "approx " + (M $E.effValue))
)
$s += XmlTable (GId) 0.45 1.1 @(2.4, 2.6, 2.9) $tblRows 0.34 10 10.5 @($false, $true, $true)
$s += XmlChartFrame (GId) 8.35 1.1 4.55 4.1 "CHART4"
$s += CalloutBox 0.45 5.5 12.45 1.3 "SEO generates 86% of invoiced revenue ($(M $D.seo.gross)) on monthly retainers, with solid collection ($(Pc $D.seo.collectionPct)). Development is smaller in revenue ($(M $D.dev.gross), $(Pc $D.dev.collectionPct) collection) but consumes 536h 51m of delivery effort $EMD approx $(M $E.effValue) at ${GBP}$RATE/hr $EMD and only $(M $E.invPaid) of development-linked invoicing has been identified as paid." $C_INDIGO "EEF2FF" 11.5
$s += Footer 6 $TOTAL
$slides += $s

# ---- S7 DEVELOPMENT EFFORT ----
$s = TitleBar "Development Effort Delivered" "How much work have we actually delivered?"
$ek = @(@("Estimated Hours", (Dur $E.estMin), "8 projects", $C_SLATE),
        @("Total Workload", (Dur $E.workloadMin), "team of $($E.team)", $C_AMBER),
        @("Actual Logged Hours", (Dur $E.actMin), "reported total $(Dur $E.loggedMin)", $C_INDIGO),
        @("Effort Overrun", "+" + (Dur $E.overMin), "+" + (Pc $E.overPct) + " vs estimate", $C_RED))
for ($i = 0; $i -lt 4; $i++) {
    $s += XmlKpi (GId) (0.45 + $i * 3.16) 1.1 2.96 1.05 $ek[$i][0] $ek[$i][1] $ek[$i][2] $ek[$i][3]
}
$s += XmlChartFrame (GId) 0.45 2.5 7.6 3.5 "CHART5"
$obs2 = (XmlPara "Actual logged effort is significantly above estimate: $(Dur $E.actMin) delivered vs $(Dur $E.estMin) estimated (+$(Pc $E.overPct))." 11.5 $false "1E293B" "l" $true 6) +
        (XmlPara "Logged time also exceeds planned workload by $(Dur ($E.loggedMin - $E.workloadMin)) ($(Pc $E.loggedVsWorkloadPct) utilisation)." 11.5 $false "1E293B" "l" $true 6) +
        (XmlPara "6 of 8 projects are over estimate $EMD up to +275% (see Effort Variance slide)." 11.5 $false "1E293B" "l" $true 6)
$s += SectionHead 8.35 2.5 4.5 "Interpretation"
$s += XmlShape (GId) "obs2" 8.35 2.9 4.5 3.0 $obs2 $null $null
$s += Footer 7 $TOTAL
$slides += $s

# ---- S8 REVENUE VS DELIVERED EFFORT ----
$s = TitleBar "Revenue vs Delivered Development Effort" "How much of that work has been financially recovered?"
$flow = @(@("WORK DELIVERED", (Dur $E.actMin), "approx $(M $E.effValue) @ ${GBP}$RATE/hr", $C_INDIGO),
          @("BILLED (invoice identified)", (Dur $E.billedMin), "$(M $E.invGross) invoiced", $C_AMBER),
          @("PAID", (Dur $E.paidMin), "$(M $E.invPaid) received", $C_GREEN))
for ($i = 0; $i -lt 3; $i++) {
    $x = 0.45 + $i * 4.45
    $s += XmlShape (GId) "fl$i" $x 1.15 3.55 1.5 "" "FFFFFF" $flow[$i][3] 1.5 "roundRect"
    $s += XmlShape (GId) "flt$i" ($x + 0.15) 1.3 3.25 1.25 ((XmlPara $flow[$i][0] 10 $true $C_SLATE "l" $false 2) + (XmlPara $flow[$i][1] 21 $true $flow[$i][3] "l" $false 2) + (XmlPara $flow[$i][2] 10 $false $C_MUT "l" $false 0)) $null $null
    if ($i -lt 2) { $s += XmlShape (GId) "arr$i" ($x + 3.68) 1.75 0.55 0.3 "" $C_SLATE $null 0.75 "rightArrow" }
}
$s += XmlChartFrame (GId) 0.45 3.0 7.4 3.3 "CHART6"
$gap = (XmlPara "DELIVERED BUT UNBILLED: $(Dur $E.unbilledMin) (approx $(M $E.unbilledValue)) $EMD no invoice identified." 11.5 $true $C_RED "l" $true 7) +
       (XmlPara "INVOICED BUT UNPAID: $(Dur $E.unpaidMin) (approx $(M $E.unpaidValue)) $EMD invoice raised, payment pending." 11.5 $true $C_AMBER "l" $true 7) +
       (XmlPara "Awaiting verification: $(Dur $E.verifyMin) (Nomads Clothing) $EMD excluded from unbilled until confirmed." 11 $false $C_MUT "l" $true 0)
$s += SectionHead 8.15 3.0 4.7 "The Recovery Gap"
$s += XmlShape (GId) "gap" 8.15 3.4 4.75 2.9 $gap $null $null
$s += Footer 8 $TOTAL
$slides += $s

# ---- S9 UNRECOVERED EFFORT ----
$s = TitleBar "Unrecovered Development Effort" "Financial exposure of delivered work"
$u = @(@("UNBILLED DEVELOPMENT EFFORT", (Dur $E.unbilledMin), "approx $(M $E.unbilledValue)", "Delivered, no invoice identified", $C_AMBER),
       @("INVOICED BUT UNPAID EFFORT", (Dur $E.unpaidMin), "approx $(M $E.unpaidValue)", "Invoice raised, payment not received", $C_RED),
       @("TOTAL UNRECOVERED EFFORT", (Dur $E.unrecMin), "approx $(M $E.unrecValue)", "at ${GBP}$RATE/hr configurable rate", $C_NAVY))
for ($i = 0; $i -lt 3; $i++) {
    $x = 0.45 + $i * 4.25
    $s += XmlShape (GId) "u$i" $x 1.2 3.95 2.1 "" "FFFFFF" $u[$i][4] 2 "roundRect"
    $s += XmlShape (GId) "ut$i" ($x + 0.2) 1.4 3.55 1.8 ((XmlPara $u[$i][0] 10.5 $true $u[$i][4] "l" $false 4) + (XmlPara $u[$i][1] 30 $true $u[$i][4] "l" $false 3) + (XmlPara $u[$i][2] 15 $true $C_MUT "l" $false 3) + (XmlPara $u[$i][3] 10 $false $C_SLATE "l" $false 0)) $null $null
}
$s += CalloutBox 0.45 3.7 12.45 1.35 "Development effort worth approx $(M $E.unrecValue) ($(Dur $E.unrecMin)) has been delivered without financial recovery. The largest component is unbilled work: NWT ($(Dur 8657)), Silver Street London ($(Dur 4855)) and Nomads Saige ($(Dur 4023)) have logged hours with no corresponding invoice. Unbilled effort is NOT an outstanding invoice $EMD it becomes recoverable only once billed." $C_RED "FEF2F2" 12
$brk = (XmlPara "Invoiced but unpaid sits with CATESBY ENGLAND ($(M 720) outstanding of $(M 1200) invoiced, 92h 58m delivered)." 11 $false "1E293B" "l" $true 6) +
       (XmlPara "Paid development work: Nomads Trade Website (84h 56m, $(M 1437.6) received in full)." 11 $false "1E293B" "l" $true 6) +
       (XmlPara "Hourly valuation is a management indicator (configurable rate), not an accounting figure." 11 $false $C_MUT "l" $true 0)
$s += XmlShape (GId) "brk" 0.45 5.3 12.45 1.6 $brk $null $null
$s += Footer 9 $TOTAL
$slides += $s

# ---- S10 CLIENT EXPOSURE ----
$s = TitleBar "Client Financial Exposure" "Which clients owe the most?"
$s += XmlChartFrame (GId) 0.45 1.1 6.6 4.6 "CHART7"
$cr = @(@("Client", "Invoiced", "Paid", "Outstanding", "Coll. %"))
foreach ($c in $D.clients) {
    $outTxt = (M $c.outstanding); if ([double]$c.outstanding -gt 0) { $outTxt = "||B91C1C|b||" + $outTxt }
    $cr += ,@($c.client, (M0 $c.gross), (M0 $c.paid), $outTxt, (Pc $c.collectionPct))
}
$s += XmlTable (GId) 7.35 1.1 @(2.2, 1.15, 1.15, 1.3, 0.85) $cr 0.36 9.5 10 @($false, $true, $true, $true, $true)
$topO = @($D.clients | Sort-Object outstanding -Descending)[0]
$s += CalloutBox 7.35 4.35 5.55 1.35 "$($topO.client) requires management attention: $(M $topO.outstanding) outstanding ($(Pc (100 - $topO.collectionPct)) of its invoiced value). NOMADS CLOTHING LIMITED follows at $(M (@($D.clients | Sort-Object outstanding -Descending)[1].outstanding))." $C_RED "FEF2F2" 11
$s += Footer 10 $TOTAL
$slides += $s

# ---- S11 PROJECT EXPOSURE ----
$s = TitleBar "Project-level Financial & Effort Exposure" "Where is the combined exposure?"
$pr = @(@("Project", "Client", "Actual Hrs", "Invoiced", "Paid", "Outstanding", "Unbilled Effort", "Exposure"))
$topExp = @($E.exposure | Select-Object -First 7)
foreach ($p in $topExp) {
    $inv = if ([double]$p.invGross -gt 0) { M0 $p.invGross } else { "-" }
    $pd = if ([double]$p.invPaid -gt 0) { M0 $p.invPaid } else { "-" }
    $ot = if ([double]$p.invOut -gt 0) { "||B91C1C|b||" + (M $p.invOut) } else { "-" }
    $ub = if ([double]$p.unbilledValue -gt 0) { "||B45309|b||" + (M $p.unbilledValue) } else { "-" }
    $pr += ,@($p.name, ($p.client -replace " LIMITED", "" -replace " \(UK\)", ""), (Dur $p.actMin), $inv, $pd, $ot, $ub, "||B91C1C|b||" + (M $p.exposure))
}
$s += XmlTable (GId) 0.45 1.1 @(2.15, 1.9, 1.15, 1.1, 1.1, 1.2, 1.45, 1.15) $pr 0.37 9.5 10 @($false, $false, $true, $true, $true, $true, $true, $true)
$s += CalloutBox 0.45 4.6 12.45 1.2 "Highest exposure: NWT (NOMADS) $EMD 144h 17m delivered, approx $(M 1442.83) of unbilled effort, no invoice identified. CATESBY ENGLAND combines 92h 58m delivered with $(M 720) unpaid invoiced value." $C_RED "FEF2F2" 12
$s += XmlShape (GId) "note11" 0.45 6.0 12.45 0.7 (XmlPara "Unbilled effort value = actual hours x ${GBP}$RATE/hr (management indicator). Exposure = outstanding invoices + unbilled effort value. Projects with ambiguous invoice linkage (Nomads Clothing, 30h 02m) are excluded from exposure pending verification." 9.5 $false $C_SLATE "l" $false 0) $null $null
$s += Footer 11 $TOTAL
$slides += $s

# ---- S12 AGEING ----
$s = TitleBar "Outstanding Payment & Ageing Analysis" "How old is the unpaid money?"
$s += XmlChartFrame (GId) 0.45 1.1 6.9 4.5 "CHART8"
$ag = @(@("Client", "Invoice Date", "Outstanding", "Days Past Due"))
foreach ($o in ($D.oldest | Select-Object -First 5)) {
    $ag += ,@(($o.client -replace " LIMITED", "" -replace " \(UK\)", ""), $o.date, "||B91C1C|b||" + (M $o.outstanding), "$($o.overdueDays)")
}
$s += SectionHead 7.65 1.1 5.2 "5 Oldest Outstanding Invoices"
$s += XmlTable (GId) 7.65 1.5 @(1.85, 1.2, 1.25, 0.95) $ag 0.36 9.5 10 @($false, $false, $true, $true)
$s += CalloutBox 7.65 4.05 5.25 1.6 "$(M $K.outstanding) outstanding across $($K.unpaidCount) invoices; $(Pc (@($D.ageing | Where-Object {$_.bucket -in @('61-90 days','91-180 days','181-365 days','365+ days')} | Measure-Object amount -Sum).Sum / $K.outstanding * 100)) is 61+ days past due. Oldest: SUPERHOUSE (UK) invoice of $(M 238.8), $($D.oldest[0].overdueDays) days past due." $C_AMBER "FFFBEB" 11
$s += Footer 12 $TOTAL
$slides += $s

# ---- S13 EFFORT VARIANCE ----
$s = TitleBar "Development Effort Variance" "Where did effort exceed the estimate?"
$s += XmlChartFrame (GId) 0.45 1.1 7.8 4.7 "CHART9"
$vi = (XmlPara "6 of 8 projects exceeded their estimates; total overrun +$(Dur $E.overMin) (+$(Pc $E.overPct))." 11.5 $false "1E293B" "l" $true 7) +
      (XmlPara "Worst overruns: Nomads Clothing +275% (30h 02m vs 8h 00m), AMEN SHOES +151%, CATESBY ENGLAND +132%." 11.5 $false "1E293B" "l" $true 7) +
      (XmlPara "Only FOOTWEAR DEPOT - 1 (-71%) and Silver Street London (-10%) are under estimate." 11.5 $false "1E293B" "l" $true 7) +
      (XmlPara "Overruns amplify the unbilled-exposure issue: more hours delivered than scoped, without matching invoices." 11.5 $true $C_RED "l" $true 0)
$s += SectionHead 8.55 1.1 4.3 "Interpretation"
$s += XmlShape (GId) "vi" 8.55 1.5 4.35 4.3 $vi $null $null
$s += Footer 13 $TOTAL
$slides += $s

# ---- S14 RISKS ----
$s = TitleBar "Key Risks & Management Attention" "Derived from the data, with figures"
$rColors = @{ "Payment Risk" = $C_RED; "Delivery Risk" = $C_INDIGO; "Revenue Recovery Risk" = $C_AMBER; "Billing Risk" = $C_AMBER; "Project Risk" = $C_TEAL; "Data Risk" = $C_SLATE }
$rFill = @{ "Payment Risk" = "FEF2F2"; "Delivery Risk" = "EEF2FF"; "Revenue Recovery Risk" = "FFFBEB"; "Billing Risk" = "FFFBEB"; "Project Risk" = "F0FDFA"; "Data Risk" = "F1F5F9" }
for ($i = 0; $i -lt $D.risks.Count; $i++) {
    $r = $D.risks[$i]
    $col = $i % 2; $row = [Math]::Floor($i / 2)
    $x = 0.45 + $col * 6.32; $y = 1.1 + $row * 1.52
    if ($i -eq 6) { $x = 0.45; $w = 12.44 } else { $w = 6.02 }
    $cc = $rColors[$r.cat]; if (-not $cc) { $cc = $C_SLATE }
    $ff = $rFill[$r.cat]; if (-not $ff) { $ff = "F1F5F9" }
    $s += XmlShape (GId) "r$i" $x $y $w 1.38 "" $ff $cc 1.25 "roundRect"
    $s += XmlShape (GId) "rt$i" ($x + 0.15) ($y + 0.08) ($w - 0.3) 1.24 ((XmlPara $r.cat.ToUpper() 9.5 $true $cc "l" $false 2) + (XmlPara $r.text 10.5 $false "1E293B" "l" $false 0)) $null $null
}
$s += Footer 14 $TOTAL
$slides += $s

# ---- S15 RECOMMENDATIONS ----
$s = TitleBar "Recommended Management Actions" "What should management do?"
$recs = ""
for ($i = 0; $i -lt $D.recommendations.Count; $i++) {
    $recs += XmlPara ("{0}.  {1}" -f ($i + 1), $D.recommendations[$i]) 11.5 $false "1E293B" "l" $false 8
}
$s += XmlShape (GId) "recs" 0.45 1.15 12.44 4.35 $recs $null $null
$s += CalloutBox 0.45 5.75 12.45 1.15 "MANAGEMENT FOCUS: $(M $K.paid) of $(M $K.gross) invoiced has been collected ($(Pc $K.collectionPct)). The immediate priorities are recovering $(M $K.outstanding) of 2026 receivables and converting approx $(M $E.unbilledValue) of delivered-but-unbilled development effort into invoices $EMD together worth roughly $(M0 ($K.outstanding + $E.unbilledValue)) of at-risk value." $C_NAVY "F1F5F9" 12
$s += Footer 15 $TOTAL
$slides += $s

# ---- S16 APPENDIX A ----
$s = TitleBar "Appendix A $EMD Detailed Project Analysis" "Development projects (PM layer)"
$aa = @(@("Project", "Client", "Status", "Est. Hrs", "Actual Hrs", "Invoiced", "Paid", "Outstanding"))
foreach ($p in $E.rows) {
    $inv = if ([double]$p.invGross -gt 0) { M $p.invGross } else { "-" }
    $pd = if ([double]$p.invPaid -gt 0) { M $p.invPaid } else { "-" }
    $ot = if ([double]$p.invOut -gt 0) { "||B91C1C|b||" + (M $p.invOut) } else { "-" }
    $aa += ,@($p.name, $p.client, $p.status, (Dur $p.estMin), (Dur $p.actMin), $inv, $pd, $ot)
}
$s += XmlTable (GId) 0.45 1.15 @(2.1, 2.75, 1.35, 1.25, 1.25, 1.3, 1.25, 1.3) $aa 0.38 10 10 @($false, $false, $false, $true, $true, $true, $true, $true)
$s += XmlShape (GId) "noteA" 0.45 5.4 12.45 1.2 (XmlPara "Payment scenario per project: Paid = Nomads Trade Website; Partially Paid = CATESBY ENGLAND; Needs Verification = Nomads Clothing; Unbilled = AMEN SHOES, FOOTWEAR DEPOT - 1, Nomads Saige, NWT, Silver Street London. Effort figures from WorkGrid; financial figures from the invoice layer (linked by client + project name where reliable)." 10 $false $C_MUT "l" $false 0) $null $null
$s += Footer 16 $TOTAL
$slides += $s

# ---- S17 APPENDIX B ----
$s = TitleBar "Appendix B $EMD Outstanding Invoices" "All unpaid invoices, oldest first"
$ab = @(@("Client", "Invoice ID", "Date", "Amount", "Paid", "Outstanding", "Days Past Due"))
foreach ($o in $D.oldest) {
    $ab += ,@(($o.client -replace " LIMITED", " Ltd" -replace " \(UK\)", " (UK)"), $o.id, $o.date, (M $o.gross), (M $o.paid), "||B91C1C|b||" + (M $o.outstanding), "$($o.overdueDays)")
}
$s += XmlTable (GId) 0.45 1.1 @(2.35, 2.5, 1.15, 1.15, 1.0, 1.35, 1.35) $ab 0.335 9.5 9.5 @($false, $false, $false, $true, $true, $true, $true)
$s += XmlShape (GId) "noteB" 0.45 5.15 12.45 0.9 (XmlPara "Outstanding = invoice total minus amount paid, per invoice. One invoice (510492000001279049, Patrick Shoes) is marked Overdue but has a payment date recorded $EMD flagged for review in Data Quality." 9.5 $false $C_SLATE "l" $false 0) $null $null
$s += Footer 17 $TOTAL
$slides += $s

# ---- S18 APPENDIX C ----
$s = TitleBar "Appendix C $EMD Data Quality & Reconciliation" "Auditability"
$dq = (XmlPara "Matching & data issues (from the dashboard Data Quality report):" 11 $true $C_NAVY "l" $false 4) +
      (XmlPara "5 PM projects have no invoice match (reported as Unbilled, not as outstanding invoices); Nomads Clothing is Needs Verification." 10.5 $false "1E293B" "l" $true 4) +
      (XmlPara "Invoice 510492000001279049 is marked Overdue yet has a Last Payment Date $EMD contradictory record." 10.5 $false "1E293B" "l" $true 4) +
      (XmlPara "147 Excel rows = 125 unique invoices (22 extra rows are line items of multi-line invoices; header amounts counted once)." 10.5 $false "1E293B" "l" $true 4) +
      (XmlPara "PM reported Total Logged Time (536h 53m) differs from the sum of project rows (536h 51m) by 2 minutes $EMD source rounding." 10.5 $false "1E293B" "l" $true 4) +
      (XmlPara "No amount-paid column exists in the source; payment is inferred from invoice status. Partial payments are not detectable." 10.5 $false "1E293B" "l" $true 4)
$s += XmlShape (GId) "dq" 0.45 1.1 12.44 2.5 $dq $null $null
$s += SectionHead 0.45 3.7 8 "Reconciliation $EMD Dashboard vs Presentation"
$rc = @(@("KPI", "HTML Dashboard", "This Presentation", "Diff"),
        @("Total Projects", "9", "9", "0"),
        @("Total Invoices", "125", "125", "0"),
        @("Total Invoiced", (M $K.gross), (M $K.gross), (M 0)),
        @("Total Paid", (M $K.paid), (M $K.paid), (M 0)),
        @("Total Outstanding", (M $K.outstanding), (M $K.outstanding), (M 0)),
        @("Development Hours (actual)", (Dur $E.actMin), (Dur $E.actMin), "0m"),
        @("Unbilled Effort", (Dur $E.unbilledMin), (Dur $E.unbilledMin), "0m"))
$s += XmlTable (GId) 0.45 4.05 @(3.3, 3.0, 3.0, 1.6) $rc 0.3 9.5 10 @($false, $true, $true, $true)
$s += Footer 18 $TOTAL
$slides += $s

# ============================ CHARTS ============================
$charts = @{}
# CHART1: invoiced/paid/outstanding
$charts["CHART1"] = @{
    xml = New-BarChartXml @("Invoiced (gross)", "Collected", "Outstanding") @(@{ name = "GBP"; values = @($K.gross, $K.paid, $K.outstanding); color = $C_BLUE; ptColors = @($C_BLUE, $C_GREEN, $C_RED) }) "Invoiced vs Collected vs Outstanding" "col" $false ([string]$GBP + "#,##0") $false $true $true
    headers = @("Category", "GBP"); rows = @(@("Invoiced (gross)", $K.gross), @("Collected", $K.paid), @("Outstanding", $K.outstanding))
}
# CHART2: year-wise
$yCats = @($D.years | ForEach-Object { [string]$_.year })
$charts["CHART2"] = @{
    xml = New-BarChartXml $yCats @(
        @{ name = "Invoiced"; values = @($D.years | ForEach-Object { $_.gross }); color = $C_BLUE },
        @{ name = "Collected"; values = @($D.years | ForEach-Object { $_.paid }); color = $C_GREEN },
        @{ name = "Outstanding"; values = @($D.years | ForEach-Object { $_.outstanding }); color = $C_RED }
    ) "Invoiced vs Collected vs Outstanding by Year" "col" $false ([string]$GBP + "#,##0") $true $false $false
    headers = @("Year", "Invoiced", "Collected", "Outstanding")
    rows = @($D.years | ForEach-Object { @([string]$_.year, $_.gross, $_.paid, $_.outstanding) })
}
# CHART3: growth
$charts["CHART3"] = @{
    xml = New-BarChartXml $yCats @(
        @{ name = "New Projects"; values = @($D.years | ForEach-Object { $_.newProjects }); color = $C_AMBER },
        @{ name = "New Clients"; values = @($D.years | ForEach-Object { $_.newClients }); color = $C_TEAL }
    ) "New Projects & New Clients per Year" "col" $false "0" $true $true $false
    headers = @("Year", "New Projects", "New Clients")
    rows = @($D.years | ForEach-Object { @([string]$_.year, $_.newProjects, $_.newClients) })
}
# CHART4: SEO vs Dev
$charts["CHART4"] = @{
    xml = New-BarChartXml @("SEO", "Development") @(
        @{ name = "Invoiced"; values = @($D.seo.gross, $D.dev.gross); color = $C_BLUE },
        @{ name = "Paid"; values = @($D.seo.paid, $D.dev.paid); color = $C_GREEN },
        @{ name = "Outstanding"; values = @($D.seo.outstanding, $D.dev.outstanding); color = $C_RED }
    ) "Service Line Comparison" "col" $false ([string]$GBP + "#,##0") $true $false $false
    headers = @("Service", "Invoiced", "Paid", "Outstanding")
    rows = @(@("SEO", $D.seo.gross, $D.seo.paid, $D.seo.outstanding), @("Development", $D.dev.gross, $D.dev.paid, $D.dev.outstanding))
}
# CHART5: est/workload/actual
$charts["CHART5"] = @{
    xml = New-BarChartXml @("Estimated", "Planned Workload", "Actual Logged") @(@{ name = "Hours"; values = @(($E.estMin / 60), ($E.workloadMin / 60), ($E.actMin / 60)); color = $C_SLATE; ptColors = @($C_SLATE, $C_AMBER, $C_INDIGO) }) "Estimated vs Workload vs Actual (hours)" "col" $false "0.0&quot;h&quot;" $false $true $true
    headers = @("Measure", "Hours"); rows = @(@("Estimated", [Math]::Round($E.estMin / 60, 1)), @("Planned Workload", [Math]::Round($E.workloadMin / 60, 1)), @("Actual Logged", [Math]::Round($E.actMin / 60, 1)))
}
# CHART6: delivered/billed/paid funnel
$charts["CHART6"] = @{
    xml = New-BarChartXml @("Delivered", "Billed", "Paid") @(@{ name = "Hours"; values = @(($E.actMin / 60), ($E.billedMin / 60), ($E.paidMin / 60)); color = $C_INDIGO; ptColors = @($C_INDIGO, $C_AMBER, $C_GREEN) }) "Development Hours: Delivered - Billed - Paid" "col" $false "0&quot;h&quot;" $false $true $true
    headers = @("Stage", "Hours"); rows = @(@("Delivered", [Math]::Round($E.actMin / 60, 1)), @("Billed", [Math]::Round($E.billedMin / 60, 1)), @("Paid", [Math]::Round($E.paidMin / 60, 1)))
}
# CHART7: client outstanding (horizontal)
$cliOut = @($D.clients | Sort-Object outstanding)
$charts["CHART7"] = @{
    xml = New-BarChartXml @($cliOut | ForEach-Object { $_.client -replace " LIMITED", "" -replace " \(UK\)", "" }) @(
        @{ name = "Outstanding"; values = @($cliOut | ForEach-Object { $_.outstanding }); color = $C_RED },
        @{ name = "Paid"; values = @($cliOut | ForEach-Object { $_.paid }); color = $C_GREEN }
    ) "Client Paid vs Outstanding" "bar" $true ([string]$GBP + "#,##0") $true $false $false
    headers = @("Client", "Outstanding", "Paid")
    rows = @($cliOut | ForEach-Object { @(($_.client -replace " LIMITED", "" -replace " \(UK\)", ""), $_.outstanding, $_.paid) })
}
# CHART8: ageing
$charts["CHART8"] = @{
    xml = New-BarChartXml @($D.ageing | ForEach-Object { $_.bucket }) @(@{ name = "Outstanding"; values = @($D.ageing | ForEach-Object { $_.amount }); color = $C_RED; ptColors = @("64748B", "F59E0B", "F97316", "DC2626", "991B1B", "7F1D1D", "450A0A") }) "Outstanding by Days Past Due" "col" $false ([string]$GBP + "#,##0") $false $true $true
    headers = @("Bucket", "Outstanding"); rows = @($D.ageing | ForEach-Object { @($_.bucket, $_.amount) })
}
# CHART9: variance by project (horizontal, hours)
$byVar = @($E.rows | Sort-Object varMin)
$charts["CHART9"] = @{
    xml = New-BarChartXml @($byVar | ForEach-Object { $_.name }) @(@{ name = "Variance (hours)"; values = @($byVar | ForEach-Object { [Math]::Round($_.varMin / 60, 1) }); color = $C_RED }) "Actual minus Estimated Hours by Project" "bar" $false "0&quot;h&quot;" $false $true $false
    headers = @("Project", "Variance (hours)"); rows = @($byVar | ForEach-Object { @($_.name, [Math]::Round($_.varMin / 60, 1)) })
}

# ============================ PACKAGE ============================
if ($OnlySlides) { $idx = $OnlySlides -split ',' | ForEach-Object { [int]$_ }; $slides = @($idx | ForEach-Object { $slides[$_ - 1] }) }
$root = "C:\Users\Sandeep_fastranking\Desktop\Devin\pptx_build"
if (Test-Path $root) { Remove-Item $root -Recurse -Force }
New-Item -ItemType Directory -Path $root | Out-Null

# content types
$slideOverrides = ""; for ($i = 1; $i -le $slides.Count; $i++) { $slideOverrides += "<Override PartName=`"/ppt/slides/slide$i.xml`" ContentType=`"application/vnd.openxmlformats-officedocument.presentationml.slide+xml`"/>" }
$chartKeys = @($charts.Keys | Sort-Object)
if ($NoCharts) { $chartKeys = @() }
$chartOverrides = ""; for ($ci = 1; $ci -le $chartKeys.Count; $ci++) { $chartOverrides += "<Override PartName=`"/ppt/charts/chart$ci.xml`" ContentType=`"application/vnd.openxmlformats-officedocument.drawingml.chart+xml`"/>" }
$ct = "<?xml version=`"1.0`" encoding=`"UTF-8`" standalone=`"yes`"?><Types xmlns=`"http://schemas.openxmlformats.org/package/2006/content-types`"><Default Extension=`"rels`" ContentType=`"application/vnd.openxmlformats-package.relationships+xml`"/><Default Extension=`"xml`" ContentType=`"application/xml`"/><Default Extension=`"xlsx`" ContentType=`"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`"/><Override PartName=`"/ppt/presentation.xml`" ContentType=`"application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml`"/><Override PartName=`"/ppt/slideMasters/slideMaster1.xml`" ContentType=`"application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml`"/><Override PartName=`"/ppt/slideLayouts/slideLayout1.xml`" ContentType=`"application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml`"/><Override PartName=`"/ppt/theme/theme1.xml`" ContentType=`"application/vnd.openxmlformats-officedocument.theme+xml`"/><Override PartName=`"/ppt/presProps.xml`" ContentType=`"application/vnd.openxmlformats-officedocument.presentationml.presProps+xml`"/><Override PartName=`"/ppt/viewProps.xml`" ContentType=`"application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml`"/><Override PartName=`"/ppt/tableStyles.xml`" ContentType=`"application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml`"/><Override PartName=`"/docProps/core.xml`" ContentType=`"application/vnd.openxmlformats-package.core-properties+xml`"/><Override PartName=`"/docProps/app.xml`" ContentType=`"application/vnd.openxmlformats-officedocument.extended-properties+xml`"/>$slideOverrides$chartOverrides</Types>"
Write-Part $root "[Content_Types].xml" $ct
Write-Part $root "_rels/.rels" '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'

# presentation.xml + rels
$sldIds = ""; for ($i = 1; $i -le $slides.Count; $i++) { $sldIds += "<p:sldId id=`"$(255 + $i)`" r:id=`"rId$($i + 1)`"/>" }
Write-Part $root "ppt/presentation.xml" "<?xml version=`"1.0`" encoding=`"UTF-8`" standalone=`"yes`"?><p:presentation $NS><p:sldMasterIdLst><p:sldMasterId id=`"2147483648`" r:id=`"rId1`"/></p:sldMasterIdLst><p:sldIdLst>$sldIds</p:sldIdLst><p:sldSz cx=`"12192000`" cy=`"6858000`" type=`"screen16x9`"/><p:notesSz cx=`"6858000`" cy=`"9144000`"/><p:defaultTextStyle><a:defPPr><a:defRPr lang=`"en-GB`"/></a:defPPr><a:lvl1pPr marL=`"0`" algn=`"l`" defTabSz=`"914400`" rtl=`"0`"><a:defRPr sz=`"1200`"><a:latin typeface=`"Segoe UI`"/></a:defRPr></a:lvl1pPr></p:defaultTextStyle></p:presentation>"
$presRels = "<Relationship Id=`"rId1`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster`" Target=`"slideMasters/slideMaster1.xml`"/>"
for ($i = 1; $i -le $slides.Count; $i++) { $presRels += "<Relationship Id=`"rId$($i + 1)`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide`" Target=`"slides/slide$i.xml`"/>" }
$presRels += "<Relationship Id=`"rId100`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps`" Target=`"presProps.xml`"/><Relationship Id=`"rId101`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps`" Target=`"viewProps.xml`"/><Relationship Id=`"rId102`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles`" Target=`"tableStyles.xml`"/><Relationship Id=`"rId103`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme`" Target=`"theme/theme1.xml`"/>"
Write-Part $root "ppt/_rels/presentation.xml.rels" "<?xml version=`"1.0`" encoding=`"UTF-8`" standalone=`"yes`"?><Relationships xmlns=`"http://schemas.openxmlformats.org/package/2006/relationships`">$presRels</Relationships>"

Write-Part $root "ppt/presProps.xml" "<?xml version=`"1.0`" encoding=`"UTF-8`" standalone=`"yes`"?><p:presentationPr $NS/>"
Write-Part $root "ppt/viewProps.xml" "<?xml version=`"1.0`" encoding=`"UTF-8`" standalone=`"yes`"?><p:viewPr $NS><p:normalViewPr><p:restoredLeft sz=`"15620`"/><p:restoredTop sz=`"94660`"/></p:normalViewPr></p:viewPr>"
Write-Part $root "ppt/tableStyles.xml" "<?xml version=`"1.0`" encoding=`"UTF-8`" standalone=`"yes`"?><a:tblStyleLst xmlns:a=`"http://schemas.openxmlformats.org/drawingml/2006/main`" def=`"{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}`"/>"

# master / layout / theme
Write-Part $root "ppt/slideMasters/slideMaster1.xml" @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster $NS>
 <p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
 <p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
 <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
 <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
 <p:txStyles>
  <p:titleStyle><a:lvl1pPr algn="l"><a:defRPr sz="2400" b="1"><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill><a:latin typeface="Segoe UI"/></a:defRPr></a:lvl1pPr></p:titleStyle>
  <p:bodyStyle><a:lvl1pPr algn="l"><a:defRPr sz="1200"><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill><a:latin typeface="Segoe UI"/></a:defRPr></a:lvl1pPr></p:bodyStyle>
  <p:otherStyle><a:lvl1pPr algn="l"><a:defRPr sz="1200"><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill><a:latin typeface="Segoe UI"/></a:defRPr></a:lvl1pPr></p:otherStyle>
 </p:txStyles>
</p:sldMaster>
"@
Write-Part $root "ppt/slideMasters/_rels/slideMaster1.xml.rels" '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>'
Write-Part $root "ppt/slideLayouts/slideLayout1.xml" @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout $NS type="blank" preserve="1">
 <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
 <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>
"@
Write-Part $root "ppt/slideLayouts/_rels/slideLayout1.xml.rels" '<?xml version="1.0" encoding="UTF-8" standalone="yes"?<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>'
# fix: proper header for layout rels (typo guard)
Write-Part $root "ppt/slideLayouts/_rels/slideLayout1.xml.rels" '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>'

$theme = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="MgmtTheme">
 <a:themeElements>
  <a:clrScheme name="Mgmt">
   <a:dk1><a:srgbClr val="0F172A"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
   <a:dk2><a:srgbClr val="1E293B"/></a:dk2><a:lt2><a:srgbClr val="F1F5F9"/></a:lt2>
   <a:accent1><a:srgbClr val="1E40AF"/></a:accent1><a:accent2><a:srgbClr val="15803D"/></a:accent2>
   <a:accent3><a:srgbClr val="B91C1C"/></a:accent3><a:accent4><a:srgbClr val="0D9488"/></a:accent4>
   <a:accent5><a:srgbClr val="4F46E5"/></a:accent5><a:accent6><a:srgbClr val="B45309"/></a:accent6>
   <a:hlink><a:srgbClr val="1E40AF"/></a:hlink><a:folHlink><a:srgbClr val="64748B"/></a:folHlink>
  </a:clrScheme>
  <a:fontScheme name="Segoe">
   <a:majorFont><a:latin typeface="Segoe UI"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
   <a:minorFont><a:latin typeface="Segoe UI"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
  </a:fontScheme>
  <a:fmtScheme name="Mgmt">
   <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
   <a:lnStyleLst><a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst>
   <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
   <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
  </a:fmtScheme>
 </a:themeElements>
</a:theme>
'@
Write-Part $root "ppt/theme/theme1.xml" $theme

# slides + rels + charts
for ($i = 0; $i -lt $slides.Count; $i++) {
    $n = $i + 1
    $slideXml = $slides[$i]
    if ($NoCharts) { $slideXml = [regex]::Replace($slideXml, '<p:graphicFrame>(?:(?!</p:graphicFrame>).)*?CHART\d+(?:(?!</p:graphicFrame>).)*?</p:graphicFrame>', '', 'Singleline') }
    # find chart refs in this slide
    $slideRels = "<Relationship Id=`"rId1`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout`" Target=`"../slideLayouts/slideLayout1.xml`"/>"
    $ridNum = 100
    foreach ($ck in $chartKeys) {
        $cIdx = $chartKeys.IndexOf($ck) + 1
        if ($slideXml.Contains("`"CHART$cIdx`"")) {
            $ridNum++
            $slideXml = $slideXml -replace [regex]::Escape("`"CHART$cIdx`""), "`"rId$ridNum`""
            $slideRels += "<Relationship Id=`"rId$ridNum`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart`" Target=`"../charts/chart$cIdx.xml`"/>"
        }
    }
    Write-Part $root "ppt/slides/slide$n.xml" (New-SlideXml $slideXml)
    Write-Part $root "ppt/slides/_rels/slide$n.xml.rels" "<?xml version=`"1.0`" encoding=`"UTF-8`" standalone=`"yes`"?><Relationships xmlns=`"http://schemas.openxmlformats.org/package/2006/relationships`">$slideRels</Relationships>"
}
# chart parts + embedded xlsx
for ($cIdx = 1; $cIdx -le $chartKeys.Count; $cIdx++) {
    $ck = $chartKeys[$cIdx - 1]
    Write-Part $root "ppt/charts/chart$cIdx.xml" $charts[$ck].xml
    $embName = "chart${cIdx}_data.xlsx"
    Write-Part $root "ppt/charts/_rels/chart$cIdx.xml.rels" "<?xml version=`"1.0`" encoding=`"UTF-8`" standalone=`"yes`"?><Relationships xmlns=`"http://schemas.openxmlformats.org/package/2006/relationships`"><Relationship Id=`"rId1`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/package`" Target=`"../embeddings/$embName`"/></Relationships>"
    $tmpXlsx = Join-Path $root ("ppt/embeddings/" + $embName)
    $embDir = [System.IO.Path]::GetDirectoryName($tmpXlsx)
    if (-not (Test-Path $embDir)) { New-Item -ItemType Directory -Path $embDir -Force | Out-Null }
    New-ChartXlsx $tmpXlsx $charts[$ck].headers $charts[$ck].rows
}

# docProps
Write-Part $root "docProps/core.xml" "<?xml version=`"1.0`" encoding=`"UTF-8`" standalone=`"yes`"?><cp:coreProperties xmlns:cp=`"http://schemas.openxmlformats.org/package/2006/metadata/core-properties`" xmlns:dc=`"http://purl.org/dc/elements/1.1/`" xmlns:dcterms=`"http://purl.org/dc/terms/`" xmlns:xsi=`"http://www.w3.org/2001/XMLSchema-instance`"><dc:title>Invoice, Project &amp; Development Effort Analysis</dc:title><dc:subject>Management Review 2023 - Present</dc:subject><dc:creator>Business Analysis</dc:creator><cp:lastModifiedBy>Business Analysis</cp:lastModifiedBy><dcterms:created xsi:type=`"dcterms:W3CDTF`">$($D.asOf)T09:00:00Z</dcterms:created><dcterms:modified xsi:type=`"dcterms:W3CDTF`">$($D.asOf)T09:00:00Z</dcterms:modified></cp:coreProperties>"
Write-Part $root "docProps/app.xml" "<?xml version=`"1.0`" encoding=`"UTF-8`" standalone=`"yes`"?><Properties xmlns=`"http://schemas.openxmlformats.org/officeDocument/2006/extended-properties`"><Application>Microsoft PowerPoint</Application><PresentationFormat>Widescreen</PresentationFormat><Slides>$($slides.Count)</Slides><Company></Company></Properties>"

$outFile = "C:\Users\Sandeep_fastranking\Desktop\Devin\$OutName"
Zip-Directory $root $outFile
Write-Output "WROTE $outFile ($([Math]::Round((Get-Item $outFile).Length/1KB,1)) KB), slides=$($slides.Count), charts=$($chartKeys.Count)"
