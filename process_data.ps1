# Process extracted Sheet1.csv -> dashboard/data.js (invoice-level model + source totals)
$csvPath = "C:\Users\Sandeep_fastranking\Desktop\Devin\extracted\Sheet1.csv"
$outPath = "C:\Users\Sandeep_fastranking\Desktop\Devin\dashboard\data.js"
$today = [DateTime]"2026-08-19"

$rows = Import-Csv $csvPath
Write-Output "Raw data rows: $($rows.Count)"

# --- helpers ---
function Parse-Date($s) {
    if ([string]::IsNullOrWhiteSpace($s)) { return $null }
    $d = [DateTime]::MinValue
    if ([DateTime]::TryParseExact($s.Trim(), "yyyy-MM-dd", $null, [Globalization.DateTimeStyles]::None, [ref]$d)) { return $d }
    return $null
}
function Num($s) {
    if ([string]::IsNullOrWhiteSpace($s)) { return 0.0 }
    $n = 0.0
    [double]::TryParse($s, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$n) | Out-Null
    return $n
}
function Normalize-Client($name) {
    $n = $name.Trim() -replace '\s+', ' '
    switch -Regex ($n.ToUpper()) {
        'PATRICK SHOES' { return "Patrick Shoes Limited" }
        'NOMADS CLOTHING' { return "NOMADS CLOTHING LIMITED" }
        'BRIGGS INDUSTRIAL FOOTWEAR' { return "BRIGGS INDUSTRIAL FOOTWEAR LIMITED" }
        'SUPERHOUSE' { return "SUPERHOUSE (UK) LIMITED" }
        default { return $n }
    }
}
function Classify-Service($itemName) {
    $t = $itemName.Trim().ToLower()
    if ($t -match 'seo|search engine') { return "SEO" }
    if ($t -match 'web development|development|website') { return "Development" }
    if ($t -match 'design') { return "Design" }
    if ($t -match 'hosting') { return "Hosting" }
    if ($t -match 'maintenance|support') { return "Maintenance/Support" }
    if ([string]::IsNullOrWhiteSpace($t)) { return "Unclassified" }
    return "Other"
}

# --- group raw rows by Invoice ID (multi-line invoices appear once per line item) ---
$groups = $rows | Group-Object -Property "Invoice ID"
Write-Output "Unique invoices: $($groups.Count)"

$rawGrossSum = 0.0
foreach ($r in $rows) { $rawGrossSum += (Num $r.Total) }

$invoices = @()
foreach ($g in $groups) {
    $first = $g.Group[0]
    $id = $g.Name.Trim()
    $invDate = Parse-Date $first.'Invoice Date'
    $dueDate = Parse-Date $first.'Due Date'
    $lastPay = Parse-Date $first.'Last Payment Date'
    $status = $first.'Invoice Status'.Trim()
    $clientRaw = $first.'Customer Name'.Trim()
    $client = Normalize-Client $clientRaw
    $net = [Math]::Round((Num $first.SubTotal), 2)
    $gross = [Math]::Round((Num $first.Total), 2)
    $tax = [Math]::Round($gross - $net, 2)
    $recurrence = $first.'Recurrence Name'.Trim()
    $attention = $first.'Billing Attention'.Trim()
    $payTerms = $first.'Payment Terms'.Trim()

    # line items
    $items = @()
    $itemNames = @()
    $lineSum = 0.0
    foreach ($r in $g.Group) {
        $in = $r.'Item Name'.Trim()
        $ip = [Math]::Round((Num $r.'Item Price'), 2)
        $it = [Math]::Round((Num $r.'Item Total'), 2)
        $lineSum += $it
        $items += @{ name = $in; price = $ip; total = $it }
        if ($in -and $itemNames -notcontains $in) { $itemNames += $in }
    }
    $lineSum = [Math]::Round($lineSum, 2)

    # service (from line items; if mixed -> Mixed)
    $services = @($itemNames | ForEach-Object { Classify-Service $_ } | Select-Object -Unique)
    if ($services.Count -eq 1) { $service = $services[0] } else { $service = "Mixed" }

    # project derivation
    if ($service -eq "Development") {
        $project = "$client - Web Development"
    } elseif ($recurrence -match '(?i)catesby') {
        $project = "Catesby England - SEO (Monthly Retainer)"
    } elseif ($service -eq "SEO") {
        $project = "$client - SEO (Monthly Retainer)"
    } else {
        $project = "$client - $service"
    }

    # payment / outstanding
    $flags = @()
    if ($status -eq 'Closed') {
        $paid = $gross; $outstanding = 0.0; $payStatus = "Paid"
        if (-not $lastPay) { $flags += "Closed invoice missing Last Payment Date" }
    } elseif ($status -eq 'Overdue') {
        $paid = 0.0; $outstanding = $gross; $payStatus = "Unpaid"
        if ($lastPay) { $flags += "Status is Overdue but a Last Payment Date ($($lastPay.ToString('yyyy-MM-dd'))) exists - needs review" }
    } elseif ($status -eq 'Open') {
        $paid = 0.0; $outstanding = $gross; $payStatus = "Unpaid"
    } else {
        $paid = 0.0; $outstanding = $gross; $payStatus = "Unknown"
        $flags += "Unrecognised invoice status '$status'"
    }

    if (-not $invDate) { $flags += "Missing/invalid invoice date" }
    if (-not $dueDate) { $flags += "Missing/invalid due date" }
    if ($gross -le 0) { $flags += "Non-positive invoice total" }
    if ([Math]::Abs($lineSum - $net) -gt 0.01) { $flags += "Line items sum ($lineSum) does not equal SubTotal ($net)" }
    if ($g.Count -gt 1) { $flags += "Multi-line invoice ($($g.Count) line items)" }
    if ([string]::IsNullOrWhiteSpace($attention)) { $flags += "Missing Billing Attention" }
    if ($recurrence -match '(?i)catesby' -and $client -ne 'Catesby England') {
        $flags += "Recurrence name references 'Catesby England' but invoice is billed to $client"
    }

    $daysToPay = $null
    if ($lastPay -and $invDate) { $daysToPay = [int]($lastPay - $invDate).TotalDays }
    $ageDays = $null; $overdueDays = $null
    if ($outstanding -gt 0 -and $invDate) { $ageDays = [int]($today - $invDate).TotalDays }
    if ($outstanding -gt 0 -and $dueDate) { $overdueDays = [int]($today - $dueDate).TotalDays }

    $invoices += [ordered]@{
        id = $id
        date = $(if ($invDate) { $invDate.ToString("yyyy-MM-dd") } else { "" })
        year = $(if ($invDate) { $invDate.Year } else { 0 })
        month = $(if ($invDate) { $invDate.ToString("yyyy-MM") } else { "" })
        client = $client
        clientRaw = $clientRaw
        project = $project
        service = $service
        status = $status
        payStatus = $payStatus
        dueDate = $(if ($dueDate) { $dueDate.ToString("yyyy-MM-dd") } else { "" })
        net = $net
        tax = $tax
        gross = $gross
        paid = $paid
        outstanding = $outstanding
        lastPaymentDate = $(if ($lastPay) { $lastPay.ToString("yyyy-MM-dd") } else { "" })
        payYear = $(if ($lastPay) { $lastPay.Year } else { 0 })
        payMonth = $(if ($lastPay) { $lastPay.ToString("yyyy-MM") } else { "" })
        daysToPay = $daysToPay
        ageDays = $ageDays
        overdueDays = $overdueDays
        lineCount = $g.Count
        itemNames = $itemNames
        recurrence = $recurrence
        attention = $attention
        flags = $flags
    }
}

$invoices = $invoices | Sort-Object { $_.date }, { $_.id }

# --- independent source totals (for reconciliation, computed straight from raw CSV) ---
$uniqGross = 0.0; $uniqNet = 0.0; $uniqTax = 0.0
foreach ($g in $groups) { $uniqGross += (Num $g.Group[0].Total); $uniqNet += (Num $g.Group[0].SubTotal) }
$uniqTax = $uniqGross - $uniqNet
$clients = @($invoices | ForEach-Object { $_.client } | Select-Object -Unique)
$projects = @($invoices | ForEach-Object { $_.project } | Select-Object -Unique)
$paidSum = 0.0; $outSum = 0.0
foreach ($i in $invoices) { $paidSum += $i.paid; $outSum += $i.outstanding }

$source = [ordered]@{
    rawRows = $rows.Count
    uniqueInvoices = $groups.Count
    rawGrossSumAllRows = [Math]::Round($rawGrossSum, 2)
    uniqueInvoiceGross = [Math]::Round($uniqGross, 2)
    uniqueInvoiceNet = [Math]::Round($uniqNet, 2)
    uniqueInvoiceTax = [Math]::Round($uniqTax, 2)
    paidTotal = [Math]::Round($paidSum, 2)
    outstandingTotal = [Math]::Round($outSum, 2)
    uniqueClients = $clients.Count
    derivedProjects = $projects.Count
}

$meta = [ordered]@{
    generatedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm")
    sourceFile = "Invoice Analysis..xlsx (Sheet1)"
    asOfDate = $today.ToString("yyyy-MM-dd")
    currency = "GBP"
    assumptions = @(
        "Invoice-level amounts (SubTotal/Total) are repeated on every line-item row of a multi-line invoice; invoices are therefore de-duplicated by Invoice ID and counted once.",
        "Invoice Value = 'Total' column (gross, incl. 20% VAT). Net (ex-VAT) and VAT are shown separately in the Financial Overview.",
        "No 'Amount Paid' column exists in the source. Payment is inferred from Invoice Status: 'Closed' = paid in full (paid amount = invoice Total, payment date = Last Payment Date); 'Open'/'Overdue' = unpaid. Partially-paid invoices cannot be detected from this dataset.",
        "Overdue classification uses the source 'Invoice Status' field together with the Due Date (payment terms: Net 5). Ageing is measured in days past the Due Date as of $($today.ToString('yyyy-MM-dd')).",
        "No explicit 'Project' column exists. Projects are derived: one-off 'Web Development' invoices form a '<Client> - Web Development' project; recurring SEO invoices form '<Client> - SEO (Monthly Retainer)'. Invoices with recurrence 'Monthly - Catesby England' (billed to Patrick Shoes Limited) are treated as a separate project.",
        "Currency is assumed GBP throughout (all customers are UK limited companies; VAT charged at 20%).",
        "Payment receipts are attributed to the month of 'Last Payment Date' for paid invoices."
    )
}

$json = @{
    meta = $meta
    source = $source
    invoices = $invoices
} | ConvertTo-Json -Depth 6 -Compress

[System.IO.File]::WriteAllText($outPath, "window.INVOICE_DATA = $json;", (New-Object System.Text.UTF8Encoding($false)))

Write-Output "---- SOURCE TOTALS ----"
$source.GetEnumerator() | ForEach-Object { Write-Output ("{0}: {1}" -f $_.Key, $_.Value) }
Write-Output "Wrote $outPath ($([Math]::Round((Get-Item $outPath).Length/1KB,1)) KB)"
