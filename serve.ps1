param(
  [int]$Port = 8080
)
Add-Type -AssemblyName System.Net.HttpListener -ErrorAction SilentlyContinue

$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$Port/  (Ctrl+C to stop)"

$mime = @{
  ".html"="text/html; charset=utf-8"; ".htm"="text/html; charset=utf-8"
  ".js"="application/javascript"; ".css"="text/css"
  ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".gif"="image/gif"
  ".svg"="image/svg+xml"; ".json"="application/json"; ".pdf"="application/pdf"
  ".fbx"="application/octet-stream"; ".obj"="text/plain"; ".mtl"="text/plain"
  ".blend"="application/octet-stream"; ".blend1"="application/octet-stream"; ".stl"="application/octet-stream"
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    try {
      $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
      if ($path -eq "/") { $path = "/Ecrin Wrap.dc.html" }
      $fsPath = Join-Path $root ($path.TrimStart("/"))
      $fsPath = [System.IO.Path]::GetFullPath($fsPath)
      if (-not $fsPath.StartsWith([System.IO.Path]::GetFullPath($root))) {
        $res.StatusCode = 403; $res.Close(); continue
      }
      if (Test-Path $fsPath -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($fsPath).ToLower()
        $ct = $mime[$ext]; if (-not $ct) { $ct = "application/octet-stream" }
        $res.ContentType = $ct
        $bytes = [System.IO.File]::ReadAllBytes($fsPath)
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $res.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
        $res.OutputStream.Write($msg, 0, $msg.Length)
      }
    } catch {
      $res.StatusCode = 500
    } finally {
      $res.Close()
    }
  }
} finally {
  $listener.Stop()
}
