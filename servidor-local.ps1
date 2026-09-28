$ErrorActionPreference = 'Stop'
$root = (Get-Item -LiteralPath $PSScriptRoot).FullName.TrimEnd('\')
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 8765)
$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.css' = 'text/css; charset=utf-8'
    '.js' = 'text/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.glb' = 'model/gltf-binary'
    '.gltf' = 'model/gltf+json'
    '.wasm' = 'application/wasm'
    '.png' = 'image/png'
    '.jpg' = 'image/jpeg'
    '.svg' = 'image/svg+xml'
}

try {
    $listener.Start()
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
            $requestLine = $reader.ReadLine()
            if ([string]::IsNullOrWhiteSpace($requestLine)) { continue }
            while ($null -ne ($headerLine = $reader.ReadLine()) -and $headerLine.Length -gt 0) { }

            $parts = $requestLine.Split(' ')
            $method = $parts[0]
            $status = '200 OK'
            $body = [byte[]]@()
            $contentType = 'application/octet-stream'
            $shutdownRequested = $parts.Length -gt 1 -and $parts[1].StartsWith('/__shutdown')
            if ($shutdownRequested) {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Servidor detenido')
                $contentType = 'text/plain; charset=utf-8'
            } elseif ($method -notin @('GET', 'HEAD') -or $parts.Length -lt 2) {
                $status = '405 Method Not Allowed'
                $body = [System.Text.Encoding]::UTF8.GetBytes('Method Not Allowed')
                $contentType = 'text/plain; charset=utf-8'
            } else {
                $requestUri = [Uri]::new("http://127.0.0.1:8765$($parts[1])")
                $relative = [Uri]::UnescapeDataString($requestUri.AbsolutePath.TrimStart('/'))
                if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
                $relative = $relative.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
                $file = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $relative))
                $prefix = $root + [System.IO.Path]::DirectorySeparatorChar
                if (-not $file.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase) -and $file -ne (Join-Path $root 'index.html')) {
                    $status = '403 Forbidden'
                    $body = [System.Text.Encoding]::UTF8.GetBytes('Forbidden')
                    $contentType = 'text/plain; charset=utf-8'
                } elseif (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
                    $status = '404 Not Found'
                    $body = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
                    $contentType = 'text/plain; charset=utf-8'
                } else {
                    $extension = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
                    if ($mimeTypes.ContainsKey($extension)) { $contentType = $mimeTypes[$extension] }
                    if ($method -eq 'GET') { $body = [System.IO.File]::ReadAllBytes($file) }
                }
            }

            $responseHeader = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nConnection: close`r`nCache-Control: no-cache`r`n`r`n"
            $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($responseHeader)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            if ($body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
            $stream.Flush()
            if ($shutdownRequested) { break }
        } catch {
            # Ignore clients that close a local request early and keep serving the game.
        } finally {
            $client.Close()
        }
    }
} finally {
    $listener.Stop()
}
