<#
  PELNY CYKL 0.00G - orkiestrator jednego oddechu Katedry.
  --------------------------------------------------------------------------
  Jeden flow od zmiany w glownej Katedrze az do dystrybucji:
     [1] build glownej apki (weryfikacja integralnosci)
     [1b] build STUDIOW -> public/apps/<nazwa> (Story, Music, App, Games)
          Buildy jada dalej z distro, wiec Katedra na USB ma wszystkie studia.
          Do 2026-09-11 kopiowano je RECZNIE i lezaly z sierpnia przy zrodlach
          z wrzesnia - dokladnie ten rozjazd, ktory ma tu nie wracac.
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
    [switch]$Deploy,
    [switch]$SkipStudia
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

# [1b] Build studiow -> public/apps ------------------------------------------
# Kazde studio buduje z base './', wiec jego dist/ wchodzi 1:1 pod /apps/<nazwa>.
# Katalogi: nowa nazwa TeO_*_Studio, a gdy jej nie ma - stara (*_V2), bo
# TeO_Music_V2 bywa zablokowany przez otwarty serwer dev i jeszcze nie przemianowany.
# Fashion tu NIE MA: chodzi na wlasnym Expressie, nie ma statycznego buildu.
if (-not $SkipStudia) {
    Write-Host "`n[1b/3] Build studiow -> public/apps..." -ForegroundColor Magenta
    $studia = @(
        @{ nazwa='story'; katalogi=@('TeO_Story_Studio','TeO_Story_V2') },
        @{ nazwa='music'; katalogi=@('TeO_Music_Studio','TeO_Music_V2') },
        @{ nazwa='app';   katalogi=@('TeO_App_Studio','TeO_App_V2') },
        @{ nazwa='games'; katalogi=@('TeO_Games_Studio','TeO_Game_Studio') }
    )
    foreach ($s in $studia) {
        $src = $null
        foreach ($k in $s.katalogi) { $p = Join-Path $AppRoot $k; if (Test-Path $p) { $src = $p; break } }
        if (-not $src) { Write-Host "  - $($s.nazwa): brak katalogu ($($s.katalogi -join ' / ')) - pomijam." -ForegroundColor Yellow; continue }
        Push-Location $src
        try {
            # Bez 2>&1: w PS 5.1 kazde ostrzezenie Vite na stderr staloby sie bledem terminalnym.
            npm run build | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Build $($s.nazwa) nie powiodl sie (kod $LASTEXITCODE)." }
        } finally { Pop-Location }
        $dst = Join-Path $Root ("public\apps\" + $s.nazwa)
        # /MIR: build to calosc - stare hashe assetow maja zniknac, nie zalegac.
        & robocopy (Join-Path $src 'dist') $dst /MIR /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
        if ($LASTEXITCODE -ge 8) { throw "robocopy $($s.nazwa) -> public/apps kod $LASTEXITCODE" }
        Write-Host "  OK - $($s.nazwa) z $(Split-Path -Leaf $src) -> public/apps/$($s.nazwa)" -ForegroundColor Green
    }
}

# [2] Miniaturyzacja ---------------------------------------------------------
Write-Host "`n[2/3] Miniaturyzacja (ZIP + mirror + pendrive)..." -ForegroundColor Magenta
$mini = Join-Path $PSScriptRoot 'Miniaturyzator.ps1'
# Splat HASZTABLICA, nie tablica: tablica idzie POZYCYJNIE i Miniaturyzator dostawal
# $Version='-Version', $DriveLetter='V_ZERO' - stad mirror 'TeO_Genesis_-Version_USB'
# i 'Dysk V_ZERO: niedostepny'. Zmierzone 2026-09-11 na zywym cyklu.
$miniArgs = @{ Version = $Version }
if ($SkipUsb) { $miniArgs.SkipUsb = $true }
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
