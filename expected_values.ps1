# Independently compute expected filter-test values from raw CSV
$rows = Import-Csv "C:\Users\Sandeep_fastranking\Desktop\Devin\extracted\Sheet1.csv"
$groups = $rows | Group-Object -Property "Invoice ID"

function InvList($pred) {
    $res = @()
    foreach ($g in $groups) {
        $f = $g.Group[0]
        if (& $pred $f) { $res += $f }
    }
    return $res
}

# 2025
$l2025 = InvList({ param($f) $f.'Invoice Date' -like '2025-*' })
$g2025 = ($l2025 | Measure-Object -Property Total -Sum).Sum
Write-Output ("2025: invoices={0} gross={1}" -f $l2025.Count, [Math]::Round($g2025,2))

# SUPERHOUSE
$sh = InvList({ param($f) $f.'Customer Name' -like 'SUPERHOUSE*' })
$shGross = ($sh | Measure-Object -Property Total -Sum).Sum
$shPaid = ($sh | Where-Object { $_.'Invoice Status' -eq 'Closed' } | Measure-Object -Property Total -Sum).Sum
Write-Output ("SUPERHOUSE: invoices={0} gross={1} paid={2} out={3}" -f $sh.Count, [Math]::Round($shGross,2), [Math]::Round($shPaid,2), [Math]::Round($shGross-$shPaid,2))

# Development service 2026
$dev26 = InvList({ param($f) $f.'Item Name' -eq 'Web Development' -and $f.'Invoice Date' -like '2026-*' })
$dev26Gross = ($dev26 | Measure-Object -Property Total -Sum).Sum
Write-Output ("Dev 2026: invoices={0} gross={1}" -f $dev26.Count, [Math]::Round($dev26Gross,2))

# SEO only
$seo = InvList({ param($f) $f.'Item Name' -match 'SEO' })
$seoGross = ($seo | Measure-Object -Property Total -Sum).Sum
Write-Output ("SEO all: invoices={0} gross={1}" -f $seo.Count, [Math]::Round($seoGross,2))

# Overdue only
$ov = InvList({ param($f) $f.'Invoice Status' -eq 'Overdue' })
$ovGross = ($ov | Measure-Object -Property Total -Sum).Sum
Write-Output ("Overdue: invoices={0} gross={1}" -f $ov.Count, [Math]::Round($ovGross,2))

# Month 2026-08
$m8 = InvList({ param($f) $f.'Invoice Date' -like '2026-08-*' })
$m8Gross = ($m8 | Measure-Object -Property Total -Sum).Sum
Write-Output ("2026-08: invoices={0} gross={1}" -f $m8.Count, [Math]::Round($m8Gross,2))
