<#
  PELNY CYKL 0.00G - orkiestrator jednego oddechu Katedry.
  --------------------------------------------------------------------------
  Jeden flow od zmiany w glownej Katedrze az do dystrybucji:
     [1] build glownej apki (weryfikacja integralnosci)
     [2] Miniaturyzacja  (staging -> ZIP otakos.wtf -> mirror -> pendrive)
     [3] Deploy strony    (opcjonalnie: commit + push web ZIP)

  Zmieniasz main -> odpalasz to -> reszta dzieje sie sama.

  Uzycie:
    powershell -ExecutionPolicy Bypass -File scripts\PelnyCykl.ps1
    ...\PelnyCykl.ps1 -Version V_ZERO            # domyslnie
    ...\PelnyCykl.ps1 -SkipUsb                    # bez pendrive I:
    ...\PelnyCykl.ps1 -Deploy                      # + push strony otakos.wtf
#>
param(
    [string]$Version = 'V_ZERO',
    [switch]$SkipUsb,
    [switch]$Deploy
)
$ErrorActionPreference = 'Stop'
$Root    = Split-Path -Parent $PSScriptRoot     # ...\TeO_Genesis
$AppRoot = Split-Path -Parent $Root             # ...\ToO APP
$Web     = Join-Path $AppRoot 'katedra-otakos_-v_zero'

Write-Host "`n=== PELNY CYKL 0.00G - edycja $Version ===" -ForegroundColor Cyan

# [1] Build glownej Katedry --------------------------------------------------
Write-Host "`n[1/3] Build glownej Katedry..." -ForegroundColor Magenta
Push-Location $Root
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Build glownej apki nie powiodl sie (kod $LASTEXITCODE)." }
} finally { Pop-Location }
Write-Host "  OK - build zielony." -ForegroundColor Green

# [2] Miniaturyzacja ---------------------------------------------------------
Write-Host "`n[2/3] Miniaturyzacja (ZIP + mirror + pendrive)..." -ForegroundColor Magenta
$mini = Join-Path $PSScriptRoot 'Miniaturyzator.ps1'
$miniArgs = @('-Version', $Version)
if ($SkipUsb) { $miniArgs += '-SkipUsb' }
& $mini @miniArgs

# [3] Deploy strony otakos.wtf ----------------------------------------------
Write-Host "`n[3/3] Deploy strony otakos.wtf..." -ForegroundColor Magenta
if ($Deploy) {
    Push-Location $Web
    try {
        git add public/V_ZERO_archive.zip
        git commit -m "chore: pelny cykl - aktualizacja V_ZERO_archive.zip ($Version)"
        if ($?) { git push origin main }
    } finally { Pop-Location }
    Write-Host "  OK - strona wypchnieta (hosting przebuduje)." -ForegroundColor Green
} else {
    Write-Host "  Pominieto. ZIP gotowy: $Web\public\V_ZERO_archive.zip" -ForegroundColor DarkGray
    Write-Host "  Aby opublikowac: dodaj flage -Deploy." -ForegroundColor DarkGray
}

Write-Host "`n=== CYKL 0.00G ZAKONCZONY ===" -ForegroundColor Green
Write-Host "  main -> build -> miniaturyzacja$(if($Deploy){' -> deploy'}) : jeden oddech." -ForegroundColor Cyan
