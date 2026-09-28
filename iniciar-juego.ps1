$ErrorActionPreference = 'Stop'
$port = 8765
$url = "http://127.0.0.1:$port/"
$serverScript = Join-Path $PSScriptRoot 'servidor-local.ps1'

function Test-GameServer {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $attempt = $client.BeginConnect('127.0.0.1', $port, $null, $null)
        if (-not $attempt.AsyncWaitHandle.WaitOne(200)) { return $false }
        $client.EndConnect($attempt)
        return $true
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

if (-not (Test-GameServer)) {
    $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$serverScript`""
    Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -WindowStyle Hidden -ArgumentList $arguments
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 200
        if (Test-GameServer) { $ready = $true; break }
    }
    if (-not $ready) {
        Write-Error 'No se pudo iniciar el servidor local del juego.'
        exit 1
    }
}

Start-Process $url
