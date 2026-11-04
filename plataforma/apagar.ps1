# Apaga lectortie, el servidor y su base. No toca ledkid.com ni su MySQL ni el tunel.
# Clic derecho, Ejecutar con PowerShell. Si no tiene permisos, los pide solo.
$yo = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $yo.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  exit
}

Stop-ScheduledTask -TaskName LectortieServidor -ErrorAction SilentlyContinue
Disable-ScheduledTask -TaskName LectortieServidor | Out-Null
Get-Process lectortie -ErrorAction SilentlyContinue | Stop-Process -Force
Stop-Service postgresql-x64-18 -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$servidor = Get-Process lectortie -ErrorAction SilentlyContinue
$base = (Get-Service postgresql-x64-18).Status
if (-not $servidor -and $base -eq 'Stopped') {
  Write-Host "lectortie apagado, el servidor y la base." -ForegroundColor Green
} else {
  Write-Host "Algo quedo prendido. Servidor $([bool]$servidor), base $base." -ForegroundColor Yellow
}
Start-Sleep -Seconds 6
