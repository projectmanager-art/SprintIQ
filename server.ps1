$root = "C:\Users\Sandeep_fastranking\Desktop\Devin\dashboard"
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
while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $path = $ctx.Request.Url.LocalPath.TrimStart("/")
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
