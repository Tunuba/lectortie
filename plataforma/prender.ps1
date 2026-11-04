# Prende lectortie, la base y el servidor. Clic derecho, Ejecutar con PowerShell.
# Si no tiene permisos, los pide solo. Al final dice si respondio, aqui y en el dominio.
$yo = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $yo.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  exit
}

Start-Service postgresql-x64-18
for ($i = 0; $i -lt 20; $i++) {
  if (Get-NetTCPConnection -State Listen -LocalPort 5433 -ErrorAction SilentlyContinue) { break }
  Start-Sleep -Seconds 1
}
Enable-ScheduledTask -TaskName LectortieServidor | Out-Null
Start-ScheduledTask -TaskName LectortieServidor

$local = $false
for ($i = 0; $i -lt 30 -and -not $local; $i++) {
  Start-Sleep -Seconds 1
  try { Invoke-WebRequest http://127.0.0.1:8097/api/salud -UseBasicParsing -TimeoutSec 3 | Out-Null; $local = $true } catch {}
}
if (-not $local) {
  Write-Host "El servidor no arranco. Mira plataforma\servidor.log." -ForegroundColor Red
} else {
  try {
    Invoke-WebRequest https://lectortie.ledkid.com/api/salud -UseBasicParsing -TimeoutSec 20 | Out-Null
    Write-Host "lectortie prendido, ya abre en https://lectortie.ledkid.com" -ForegroundColor Green
  } catch {
    Write-Host "Prendido en esta computadora, pero el dominio no responde todavia." -ForegroundColor Yellow
    Write-Host "Si estas en la red de la U, conecta WARP igual que para ledkid.com, y espera unos segundos." -ForegroundColor Yellow
  }
}
Start-Sleep -Seconds 8
