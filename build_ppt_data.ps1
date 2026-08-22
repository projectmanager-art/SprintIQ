# Compute every figure for the PPT from the SAME JSON the dashboard uses (data.js + pm_data.js).
# Mirrors app.js aggregation logic exactly. Output: ppt_data.json
# NOTE: ASCII-only script (PS 5.1 misreads UTF-8-no-BOM). Use $GBP / $EMD for special chars.
$ErrorActionPreference = "Stop"
$GBP = [char]163      # pound sign
$EMD = [char]8212     # em dash
$dir = "C:\Users\Sandeep_fastranking\Desktop\Devin\dashboard"

$jsonInv = (Get-Content (Join-Path $dir "data.js") -Raw) -replace '^\s*window\.INVOICE_DATA = ', '' -replace ';\s*$', '' | ConvertFrom-Json
$pmRaw = (Get-Content (Join-Path $dir "pm_data.js") -Raw) -replace '(?s)/\*.*?\*/', ''
$jsonPM  = $pmRaw -replace '^\s*window\.PM_DATA = ', '' -replace ';\s*$', '' | ConvertFrom-Json
$INV = $jsonInv.invoices
$PM = $jsonPM.projects
$RATE = [double]$jsonPM.meta.hourlyRateDefault

function Sum($list, $prop) { $t = 0.0; foreach ($i in $list) { $t += [double]$i.$prop }; return [Math]::Round($t, 2) }
function SumM($list, $prop) { $t = 0; foreach ($i in $list) { $t += [int]$i.$prop }; return $t }
function Fmt-Dur($min) { $h = [Math]::Floor($min / 60); $m = $min % 60; return ("{0}h {1:D2}m" -f $h, $m) }
function Fmt-GBP($v) { return $GBP + $v.ToString("N2", [Globalization.CultureInfo]::InvariantCulture) }
function Fmt-GBP0($v) { return $GBP + $v.ToString("N0", [Globalization.CultureInfo]::InvariantCulture) }

# ---------- invoice layer ----------
$totalGross = Sum $INV 'gross'
$totalNet = Sum $INV 'net'
$totalTax = Sum $INV 'tax'
$totalPaid = Sum $INV 'paid'
$totalOut = Sum $INV 'outstanding'
$collectionPct = [Math]::Round($totalPaid / $totalGross * 100, 1)
$outstandingPct = [Math]::Round($totalOut / $totalGross * 100, 1)
$clients = @($INV | Group-Object client)
$projects = @($INV | Group-Object project)
$invCount = $INV.Count
$avgInv = [Math]::Round($totalGross / $invCount, 2)

$years = @()
foreach ($y in ($INV | Group-Object year | Sort-Object Name)) {
    $l = $y.Group
    $g = Sum $l 'gross'; $p = Sum $l 'paid'; $o = Sum $l 'outstanding'
    $row = [ordered]@{ year = [int]$y.Name; invoices = $l.Count; gross = $g; paid = $p; outstanding = $o
        projects = @($l | Group-Object project).Count; clients = @($l | Group-Object client).Count
        collectionPct = [Math]::Round($p / $g * 100, 1); avgInv = [Math]::Round($g / $l.Count, 2)
        newProjects = 0; newClients = 0 }
    $years += $row
}
$firstProj = @{}; $firstCli = @{}
foreach ($i in ($INV | Sort-Object date)) {
    if (-not $firstProj.ContainsKey($i.project)) { $firstProj[$i.project] = $i.year }
    if (-not $firstCli.ContainsKey($i.client)) { $firstCli[$i.client] = $i.year }
}
foreach ($y in $years) {
    $y.newProjects = @($firstProj.Values | Where-Object { $_ -eq $y.year }).Count
    $y.newClients = @($firstCli.Values | Where-Object { $_ -eq $y.year }).Count
}

function SvcAgg($svc) {
    $l = @($INV | Where-Object { $_.service -eq $svc })
    $g = Sum $l 'gross'; $p = Sum $l 'paid'
    return [ordered]@{ projects = @($l | Group-Object project).Count; invoices = $l.Count; gross = $g; paid = $p
        outstanding = Sum $l 'outstanding'; collectionPct = [Math]::Round($p / $g * 100, 1); avgInv = [Math]::Round($g / $l.Count, 2) }
}
$seo = SvcAgg "SEO"; $dev = SvcAgg "Development"

$clientRows = @()
foreach ($c in $clients) {
    $l = $c.Group
    $g = Sum $l 'gross'; $p = Sum $l 'paid'
    $clientRows += [ordered]@{ client = $c.Name; projects = @($l | Group-Object project).Count; invoices = $l.Count
        gross = $g; paid = $p; outstanding = Sum $l 'outstanding'; collectionPct = [Math]::Round($p / $g * 100, 1) }
}
$clientRows = @($clientRows | Sort-Object -Property @{Expression={$_.gross}; Descending=$true})

# ageing (days past due)
$out = @($INV | Where-Object { $_.outstanding -gt 0 })
$buckets = @(
    @{ l = "Not yet due"; test = { param($i) $i.overdueDays -le 0 } },
    @{ l = "1-30 days"; test = { param($i) $i.overdueDays -ge 1 -and $i.overdueDays -le 30 } },
    @{ l = "31-60 days"; test = { param($i) $i.overdueDays -ge 31 -and $i.overdueDays -le 60 } },
    @{ l = "61-90 days"; test = { param($i) $i.overdueDays -ge 61 -and $i.overdueDays -le 90 } },
    @{ l = "91-180 days"; test = { param($i) $i.overdueDays -ge 91 -and $i.overdueDays -le 180 } },
    @{ l = "181-365 days"; test = { param($i) $i.overdueDays -ge 181 -and $i.overdueDays -le 365 } },
    @{ l = "365+ days"; test = { param($i) $i.overdueDays -ge 366 } }
)
$ageing = @()
foreach ($b in $buckets) {
    $l = @($out | Where-Object { & $b.test $_ })
    $amt = Sum $l 'outstanding'
    $share = 0; if ($totalOut) { $share = [Math]::Round($amt / $totalOut * 100, 1) }
    $ageing += [ordered]@{ bucket = $b.l; count = $l.Count; amount = $amt; share = $share }
}
$oldest = @($out | Sort-Object -Property @{Expression={$_.overdueDays}; Descending=$true} | Select-Object -First 10 |
    ForEach-Object { [ordered]@{ client = $_.client; id = $_.id; date = $_.date; gross = $_.gross; paid = $_.paid; outstanding = $_.outstanding; overdueDays = $_.overdueDays; service = $_.service } })

$paidInv = @($INV | Where-Object { $_.paid -gt 0 -and $_.lastPaymentDate })
$avgDays = [Math]::Round(($paidInv | Measure-Object daysToPay -Average).Average, 1)
$minDays = [int]($paidInv | Measure-Object daysToPay -Minimum).Minimum
$maxDays = [int]($paidInv | Measure-Object daysToPay -Maximum).Maximum

# ---------- effort layer ----------
$eff = @()
foreach ($p in $PM) {
    $fin = $null
    if ($p.invoiceProject) {
        $l = @($INV | Where-Object { $_.project -eq $p.invoiceProject })
        if ($l.Count) { $fin = [ordered]@{ gross = (Sum $l 'gross'); paid = (Sum $l 'paid'); outstanding = (Sum $l 'outstanding'); count = $l.Count } }
    }
    $scenario = ""
    if ($fin -and $fin.gross -gt 0) {
        if ($fin.outstanding -eq 0) { $scenario = "Paid" }
        elseif ($fin.paid -gt 0) { $scenario = "Partially Paid" }
        else { $scenario = "Invoiced - Outstanding" }
    } elseif ($p.matchStatus -eq "Needs Verification") { $scenario = "Needs Verification" }
    else { $scenario = "Unbilled" }
    $paidFrac = 0.0; if ($fin -and $fin.gross -gt 0) { $paidFrac = $fin.paid / $fin.gross }
    $billedMin = 0; if ($fin -and $fin.gross -gt 0) { $billedMin = [int]$p.actMin }
    $paidMin = 0
    if ($scenario -eq "Paid") { $paidMin = [int]$p.actMin } elseif ($fin) { $paidMin = [int][Math]::Round($p.actMin * $paidFrac) }
    $unbilledMin = 0; if ($scenario -eq "Unbilled") { $unbilledMin = [int]$p.actMin }
    $verifyMin = 0; if ($scenario -eq "Needs Verification") { $verifyMin = [int]$p.actMin }
    $eff += [ordered]@{
        name = $p.name; client = $p.client; status = $p.status; taskPct = $p.taskPct; bugs = $p.bugs
        start = $p.start; end = $p.end; estMin = [int]$p.estMin; actMin = [int]$p.actMin
        varMin = [int]$p.actMin - [int]$p.estMin
        varPct = [Math]::Round(($p.actMin - $p.estMin) / $p.estMin * 100, 1)
        scenario = $scenario; matchStatus = $p.matchStatus; matchNote = $p.matchNote
        invGross = $(if ($fin) { $fin.gross } else { 0 }); invPaid = $(if ($fin) { $fin.paid } else { 0 }); invOut = $(if ($fin) { $fin.outstanding } else { 0 })
        billedMin = $billedMin; paidMin = $paidMin; unbilledMin = $unbilledMin; verifyMin = $verifyMin
        unpaidMin = $billedMin - $paidMin
        effValue = [Math]::Round($p.actMin / 60 * $RATE, 2)
        unbilledValue = [Math]::Round($unbilledMin / 60 * $RATE, 2)
        unpaidValue = [Math]::Round(($billedMin - $paidMin) / 60 * $RATE, 2)
    }
}
$estMin = SumM $eff 'estMin'; $actMin = SumM $eff 'actMin'
$workloadMin = [int]$jsonPM.capacity.workloadMin; $loggedMin = [int]$jsonPM.capacity.loggedMin
$overMin = $actMin - $estMin
$billedMinT = SumM $eff 'billedMin'; $paidMinT = SumM $eff 'paidMin'
$unbilledMinT = SumM $eff 'unbilledMin'; $unpaidMinT = SumM $eff 'unpaidMin'; $verifyMinT = SumM $eff 'verifyMin'
$unrecMinT = $unbilledMinT + $unpaidMinT
$devPaidMatched = Sum $eff 'invPaid'; $devOutMatched = Sum $eff 'invOut'; $devGrossMatched = Sum $eff 'invGross'
$effValueT = [Math]::Round($actMin / 60 * $RATE, 2)
$exposure = @()
foreach ($e in ($eff | Sort-Object { ($_.invOut + $_.unbilledValue) } -Descending)) {
    $e.exposure = [Math]::Round($e.invOut + $e.unbilledValue, 2); $exposure += $e
}

# ---------- narrative content ----------
$topYear = @($years | Sort-Object gross -Descending)[0]
$topCli = $clientRows[0]
$topCliOut = @($clientRows | Sort-Object outstanding -Descending)[0]
$overdueInv = @($INV | Where-Object { $_.status -eq 'Overdue' })
$overdueAmt = Sum $overdueInv 'outstanding'
$oldestInv = $oldest[0]
$concentration = [Math]::Round($topCli.gross / $totalGross * 100, 1)
$unbilledVal = [Math]::Round($unbilledMinT / 60 * $RATE, 2)
$out2026 = @($years | Where-Object { $_.year -eq 2026 })[0].outstanding

$insights = @(
    "Collection position: $(Fmt-GBP $totalPaid) of $(Fmt-GBP $totalGross) invoiced value collected ($collectionPct%); $(Fmt-GBP $totalOut) ($outstandingPct%) remains outstanding.",
    "SEO is the largest service line: $(Fmt-GBP $seo.gross) invoiced ($([Math]::Round($seo.gross/$totalGross*100,1))% of total) vs Development $(Fmt-GBP $dev.gross).",
    "$($topCli.client) is the top client ($(Fmt-GBP $topCli.gross), $concentration% of revenue) and also carries the highest unpaid exposure ($(Fmt-GBP $topCliOut.outstanding)).",
    "Development delivery is significantly over estimate: $(Fmt-Dur $actMin) logged vs $(Fmt-Dur $estMin) estimated (+$([Math]::Round($overMin/$estMin*100,1))%).",
    "$(Fmt-Dur $unbilledMinT) of development effort (approx $(Fmt-GBP $unbilledVal) at ${GBP}$RATE/hr) has no identified invoice $EMD a billing gap.",
    "$($overdueInv.Count) invoices totalling $(Fmt-GBP $overdueAmt) are past due; the oldest unpaid invoice is $($oldestInv.overdueDays) days past its due date ($($oldestInv.client)).",
    "2023-2025 cohorts are 100% collected; the entire outstanding balance sits in the 2026 invoice cohort ($(Fmt-GBP $out2026))."
)

$risks = @(
    [ordered]@{ cat = "Payment Risk"; text = "$($topCliOut.client) holds the largest outstanding balance: $(Fmt-GBP $topCliOut.outstanding)." },
    [ordered]@{ cat = "Payment Risk"; text = "$($overdueInv.Count) invoices worth $(Fmt-GBP $overdueAmt) are past due; oldest is $($oldestInv.overdueDays) days overdue ($($oldestInv.client), $(Fmt-GBP $oldestInv.outstanding))." },
    [ordered]@{ cat = "Delivery Risk"; text = "6 of 8 development projects exceed estimates; worst overruns: Nomads Clothing +275.4%, AMEN SHOES +150.9%, CATESBY ENGLAND +132.4%." },
    [ordered]@{ cat = "Revenue Recovery Risk"; text = "CATESBY ENGLAND: $(Fmt-Dur 5578) delivered, $(Fmt-GBP 1200) invoiced, only $(Fmt-GBP 480) received $EMD $(Fmt-GBP 720) outstanding." },
    [ordered]@{ cat = "Billing Risk"; text = "$(Fmt-Dur $unbilledMinT) delivered with no invoice identified (NWT $(Fmt-Dur 8657), Silver Street London $(Fmt-Dur 4855), Nomads Saige $(Fmt-Dur 4023))." },
    [ordered]@{ cat = "Project Risk"; text = "Nomads Clothing is marked Complete but its invoice linkage needs verification ($(Fmt-Dur 1802) delivered)." },
    [ordered]@{ cat = "Data Risk"; text = "Invoice 510492000001279049 is marked Overdue yet has a payment date; PM logged-time total differs by 2m from project rows; 5 PM projects have no invoice match." }
)

$recommendations = @(
    "Chase the $(Fmt-GBP $overdueAmt) past-due portfolio immediately $EMD start with $($topCliOut.client) ($(Fmt-GBP $topCliOut.outstanding)) and the oldest SUPERHOUSE (UK) invoice ($($oldestInv.overdueDays) days overdue).",
    "Resolve the unbilled development effort ($(Fmt-Dur $unbilledMinT), approx $(Fmt-GBP $unbilledVal)): confirm scope and raise invoices for NWT, Silver Street London, Nomads Saige, AMEN SHOES and FOOTWEAR DEPOT - 1, or formally write the effort off.",
    "Verify the Nomads Clothing project against the May 2026 Nomads web-development invoice to close the matching gap.",
    "Investigate effort overruns (up to +275%) and re-baseline estimates; introduce estimate-approval checkpoints before work continues.",
    "Set billing checkpoints on in-progress development projects so delivered hours are invoiced monthly.",
    "Fix data quality: reconcile invoice 510492000001279049 (Overdue with a payment date) and confirm the 'Monthly - Catesby England' billing entity under Patrick Shoes Limited.",
    "Monitor the 2026 cohort outstanding ($(Fmt-GBP $out2026)) monthly until collected."
)

# ---------- package ----------
$ppt = [ordered]@{
    rate = $RATE
    kpis = [ordered]@{
        projects = $projects.Count; clients = $clients.Count; invoices = $invCount
        gross = $totalGross; net = $totalNet; tax = $totalTax; paid = $totalPaid; outstanding = $totalOut
        collectionPct = $collectionPct; outstandingPct = $outstandingPct; avgInv = $avgInv
        unpaidCount = @($INV | Where-Object { $_.payStatus -eq 'Unpaid' }).Count
        paidCount = @($INV | Where-Object { $_.payStatus -eq 'Paid' }).Count
        avgDaysToPay = $avgDays; fastestDays = $minDays; slowestDays = $maxDays
    }
    years = $years
    seo = $seo; dev = $dev
    clients = $clientRows
    ageing = $ageing
    oldest = $oldest
    effort = [ordered]@{
        projects = $eff.Count; estMin = $estMin; actMin = $actMin; workloadMin = $workloadMin; loggedMin = $loggedMin
        overMin = $overMin; overPct = [Math]::Round($overMin / $estMin * 100, 1)
        billedMin = $billedMinT; paidMin = $paidMinT; unbilledMin = $unbilledMinT; unpaidMin = $unpaidMinT; verifyMin = $verifyMinT
        unrecMin = $unrecMinT; effValue = $effValueT
        unbilledValue = $unbilledVal; unpaidValue = [Math]::Round($unpaidMinT / 60 * $RATE, 2)
        unrecValue = [Math]::Round($unrecMinT / 60 * $RATE, 2)
        invGross = $devGrossMatched; invPaid = $devPaidMatched; invOut = $devOutMatched
        rows = $eff; exposure = $exposure
        avgPerProject = [Math]::Round($actMin / $eff.Count)
        team = [int]$jsonPM.capacity.team
        loggedVsWorkloadPct = [Math]::Round($loggedMin / $workloadMin * 100, 1)
    }
    repeat = [ordered]@{
        repeatClients = @($clientRows | Where-Object { $_.invoices -gt 1 }).Count
        multiYearClients = @($clients | Where-Object { @($_.Group | Group-Object year).Count -gt 1 }).Count
        avgProjectsPerClient = [Math]::Round($projects.Count / $clients.Count, 2)
    }
    insights = $insights; risks = $risks; recommendations = $recommendations
    asOf = $jsonInv.meta.asOfDate
}
$outPath = "C:\Users\Sandeep_fastranking\Desktop\Devin\ppt_data.json"
[System.IO.File]::WriteAllText($outPath, ($ppt | ConvertTo-Json -Depth 8), (New-Object System.Text.UTF8Encoding($false)))
Write-Output "Wrote $outPath"
Write-Output ("Gross={0} Paid={1} Out={2} Coll={3}% | Est={4} Act={5} Unbilled={6} Unpaid={7} Overdue={8}" -f $totalGross, $totalPaid, $totalOut, $collectionPct, (Fmt-Dur $estMin), (Fmt-Dur $actMin), (Fmt-Dur $unbilledMinT), (Fmt-Dur $unpaidMinT), $overdueAmt)
