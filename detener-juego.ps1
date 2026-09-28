$ErrorActionPreference = 'Stop'
$client = [System.Net.Sockets.TcpClient]::new()
try {
    $client.Connect('127.0.0.1', 8765)
    $stream = $client.GetStream()
    $request = [System.Text.Encoding]::ASCII.GetBytes("GET /__shutdown HTTP/1.1`r`nHost: 127.0.0.1`r`nConnection: close`r`n`r`n")
    $stream.Write($request, 0, $request.Length)
    $stream.Flush()
    $stream.ReadTimeout = 3000
    $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
    $status = $reader.ReadLine()
    while ($null -ne ($header = $reader.ReadLine()) -and $header.Length -gt 0) { }
    if ($status -notmatch '200') { Write-Output 'El servidor ya estaba detenido.' }
} catch {
    Write-Output 'El servidor ya estaba detenido.'
} finally {
    $client.Close()
}
