$root = Join-Path $PSScriptRoot "dashboard"
$listener = $null
$bound = $null
try {
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://+:8765/")
    $listener.Start()
    $bound = "http://+:8765/"
    Write-Output "Serving $root on all interfaces at http://<your-pc-ip>:8765/ (also http://localhost:8765/)"
} catch {
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:8765/")
    $listener.Start()
    $bound = "http://localhost:8765/"
    Write-Output "Serving $root at http://localhost:8765/ only. Run PowerShell as Administrator if you need phone access."
}
$mime = @{ ".html" = "text/html; charset=utf-8"; ".css" = "text/css"; ".js" = "application/javascript"; ".json" = "application/json"; ".png" = "image/png" }

function Send-Json($ctx, $obj, $status = 200) {
    $ctx.Response.StatusCode = $status
    $ctx.Response.ContentType = "application/json; charset=utf-8"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Compress -Depth 10))
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $ctx.Response.Close()
}

function Send-Error($ctx, $msg, $status = 400) {
    Send-Json $ctx @{ ok = $false; error = $msg } $status
}

function Get-SheetCsv($id, $gid) {
    # Public/export endpoint works for "Anyone with the link" Google Sheets.
    $gidParam = if ($gid) { "&gid=$gid" } else { "" }
    $url = "https://docs.google.com/spreadsheets/d/$id/export?format=csv&id=$id$gidParam"
    $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -MaximumRedirection 10 -TimeoutSec 30
    if ($resp.StatusCode -ne 200) { throw "Google returned HTTP $($resp.StatusCode)" }
    return $resp.Content
}

function Get-SheetsList($id) {
    $sheets = @()
    # If a Google Sheets API key is configured in the environment, use it for proper metadata.
    $apiKey = $env:SPRINTIQ_GOOGLE_API_KEY
    if ($apiKey) {
        try {
            $apiUrl = "https://sheets.googleapis.com/v4/spreadsheets/$($id)?fields=sheets.properties.title%2Csheets.properties.sheetId&key=$apiKey"
            $resp = Invoke-RestMethod -Uri $apiUrl -TimeoutSec 20
            $sheets = $resp.sheets | ForEach-Object { @{ gid = [string]$_.properties.sheetId; title = $_.properties.title } }
            return $sheets
        } catch {
            # fall through to public feed attempt
        }
    }
    # Fallback: try the legacy public worksheets feed (no API key, public sheets only).
    try {
        $feedUrl = "https://spreadsheets.google.com/feeds/worksheets/$($id)/public/full?alt=json"
        $resp = Invoke-RestMethod -Uri $feedUrl -TimeoutSec 20
        $sheets = $resp.feed.entry | ForEach-Object { @{ gid = [string]$_.id.'$t'.Split('/')[-1]; title = $_.title.'$t' } }
    } catch {
        # Feed failed; return empty so the client uses the active/default sheet.
    }
    return $sheets
}

function Route-ApiSheets($ctx, $path, $query) {
    try {
        $id = $query['id']
        $gid = $query['gid']
        if (-not $id) { throw "Missing spreadsheet id" }
        if ($path -eq 'api/sheets/list') {
            $sheets = Get-SheetsList $id
            Send-Json $ctx @{ ok = $true; id = $id; sheets = $sheets; apiKeyConfigured = !!$env:SPRINTIQ_GOOGLE_API_KEY }
            return
        }
        if ($path -eq 'api/sheets/export') {
            $csv = Get-SheetCsv $id $gid
            Send-Json $ctx @{ ok = $true; id = Mask-Id $id; gid = ($gid -as [string]); csv = $csv }
            return
        }
        throw "Unknown API action"
    } catch {
        Send-Error $ctx $_.Exception.Message 502
    }
}

function Mask-Id($id) {
    if ($id.Length -le 8) { return '********' }
    return $id.Substring(0, 4) + '****' + $id.Substring($id.Length - 4)
}

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $path = $ctx.Request.Url.LocalPath.TrimStart("/")
    $query = $ctx.Request.Url.Query
    $queryObj = @{}
    if ($query) {
        $query.TrimStart("?").Split('&') | Where-Object { $_ } | ForEach-Object {
            $kv = $_.Split('=', 2)
            $k = [System.Web.HttpUtility]::UrlDecode($kv[0])
            $v = if ($kv.Length -gt 1) { [System.Web.HttpUtility]::UrlDecode($kv[1]) } else { '' }
            $queryObj[$k] = $v
        }
    }

    # API routes for Google Sheets proxy
    if ($path -like 'api/sheets/*') {
        Route-ApiSheets $ctx $path $queryObj
        continue
    }

    if (-not $path) { $path = "index.html" }
    $file = Join-Path $root $path
    try {
        if (Test-Path $file -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($file)
            $ext = [System.IO.Path]::GetExtension($file).ToLower()
            $ctx.Response.ContentType = $(if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" })
            $ctx.Response.ContentLength64 = $bytes.Length
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $ctx.Response.StatusCode = 404
        }
    } catch {}
    $ctx.Response.Close()
}
