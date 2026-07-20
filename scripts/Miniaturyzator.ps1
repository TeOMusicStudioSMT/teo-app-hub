<#
  🪄 MINIATURYZATOR OtakOS — mechanizm dystrybucji V_ZERO
  ────────────────────────────────────────────────────────────────────────────
  Bierze GŁÓWNĄ Katedrę (TeO_Genesis), destyluje czysty, lekki distro (bez
  node_modules / .git / cache / mediów / SEKRETÓW), pakuje do ZIP-a i rozsyła:

    1) Strona otakos.wtf  → public/ + dist/ V_ZERO_archive.zip
    2) Lokalny mirror USB → TeO_Genesis_<WER>_USB\TeO_Genesis_<WER>
    3) Fizyczny pendrive  → I:\TeO_Genesis_<WER>   (launchery zachowane, BEZ kasowania)

  Szablon na przyszłość: zmieniasz main → odpalasz skrypt → miniaturyzacja gotowa.
  Kolejne edycje: -Version V_ONE / V_TWO ...

  Użycie:
    powershell -ExecutionPolicy Bypass -File scripts\Miniaturyzator.ps1
    ...\Miniaturyzator.ps1 -Version V_ZERO            # domyślnie
    ...\Miniaturyzator.ps1 -SkipUsb                   # pomiń dysk I:
    ...\Miniaturyzator.ps1 -NoZip                      # tylko mirrory, bez ZIP-a
#>

param(
    [string]$Version = "V_ZERO",
    [string]$DriveLetter = "I",
    [switch]$SkipUsb,
    [switch]$NoZip
)

$ErrorActionPreference = 'Stop'
function Info($m){ Write-Host "  $m" -ForegroundColor Cyan }
function Ok($m){   Write-Host "  ✅ $m" -ForegroundColor Green }
function Warn($m){ Write-Host "  ⚠️  $m" -ForegroundColor Yellow }
function Step($m){ Write-Host "`n▶ $m" -ForegroundColor Magenta }

# ── Ścieżki ──────────────────────────────────────────────────────────────────
$Source   = Split-Path -Parent $PSScriptRoot            # ...\TeO_Genesis
$AppRoot  = Split-Path -Parent $Source                  # ...\ToO APP
$DistName = "TeO_Genesis_$Version"
$Stage    = Join-Path $env:TEMP "otakos_miniaturyzator\$DistName"
$WebDir   = Join-Path $AppRoot "katedra-otakos_-v_zero"
$UsbLocal = Join-Path $AppRoot ("TeO_Genesis_{0}_USB" -f $Version) | Join-Path -ChildPath $DistName
$DriveDst = "${DriveLetter}:\$DistName"

Write-Host "`n🪄 MINIATURYZATOR OtakOS — edycja $Version" -ForegroundColor White
Info "Źródło : $Source"
Info "Staging: $Stage"

# ── Wykluczenia ──────────────────────────────────────────────────────────────
# Katalogi runtime / ciężkie / prywatne — nie trafiają do distro.
$xdStatic = @(
    'node_modules','.git','.vite','dist','.cache','.claude','.husky',
    '_temp','TestProxy','models','memory','.agent',
    # _OtakOs_AI: wykluczamy tylko CIĘŻKIE/prywatne podfoldery. bin/ (whisper-cli
    # + DLL, ~20MB) ZOSTAJE w distro — lekki, potrzebny do karaoke/STT. Model ggml
    # (~487MB) wykluczony — dociąga się przy pierwszym starcie (START_KATEDRA.bat).
    # voice_server.py/requirements ZOSTAJĄ (Głos Suwerena auto-instaluje się sam).
    '_OtakOs_AI\models','_OtakOs_AI\voices','_OtakOs_AI\temp','_OtakOs_AI\voice_env',
    '_OtakOs_Aula','_OtakOs_Build','_OtakOs_Components',
    '_OtakOs_Klocki','_OtakOs_Kroniki','_OtakOs_Move','_OtakOs_Muzyka',
    '_OtakOs_Sonic','_OtakOs_Wymiar',
    # TeO_Arcade_Forge: narzędzia deweloperskie (silniki UE, RealityScan, skanery).
    # NIE należą do pobieralnej Katedry (użytkownik instaluje je osobno, jak Whisper/
    # XTTS). Bez tego distro rosło do 1.1GB (ZIP 406MB > limit GitHub 100MB). Małe
    # skrypty/docs (ue_scripts, forge_plugins, *.md) zostają — ważą grosze.
    'TeO_Arcade_Forge\ElectricDreamsEnv','TeO_Arcade_Forge\Twinmotion2026.1','TeO_Arcade_Forge\GENESIS_OVERRIDE 5.8',
    'TeO_Arcade_Forge\RealityScan_2.2','TeO_Arcade_Forge\OtakOS','TeO_Arcade_Forge\GENESIS_OVERRIDE'
)
# Dołap dynamicznie wszelkie inne _OtakOs_* (na wypadek nowych).
# _OtakOs_AI pomijamy tu celowo — ma własne, częściowe wykluczenia wyżej
# (całościowy wpis by je nadpisał i znów wyciął cały folder, razem z
# voice_server.py / requirements-voice.txt).
$xdDynamic = Get-ChildItem $Source -Directory -Filter '_OtakOs_*' -ErrorAction SilentlyContinue |
             Where-Object { $_.Name -ne '_OtakOs_AI' } |
             ForEach-Object { $_.Name }
$XD = ($xdStatic + $xdDynamic) | Select-Object -Unique

# Pliki-sekrety / śmieci — NIGDY do distro. (.env.example ZOSTAJE — to szablon.)
$XF = @(
    '.env','.env.local','.env.development','.env.production','.env.*.local',
    '.anthropic_key.env','media_secrets.json','*.key','*.pem',
    '*.log','*.bak','*.tmp','dev_server.log','.eve.example.txt'
)

# ── 1. STAGING (robocopy /MIR do tymczasowego — czysty obraz) ────────────────
Step "1/5 Destylacja czystego distro"
if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
New-Item -ItemType Directory -Path $Stage -Force | Out-Null

$rcArgs = @($Source, $Stage, '/MIR', '/NFL','/NDL','/NJH','/NJS','/NP','/R:1','/W:1')
foreach($d in $XD){ $rcArgs += '/XD'; $rcArgs += (Join-Path $Source $d) }
foreach($f in $XF){ $rcArgs += '/XF'; $rcArgs += $f }
& robocopy @rcArgs | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy staging nie powiódł się (kod $LASTEXITCODE)" }
$global:LASTEXITCODE = 0
Ok "Staging zbudowany."

# ── 1b. OVERLAY launcherów (kanon, wersjonowane) → staging ───────────────────
# Launchery (START_KATEDRA.bat z ANSI-art Flash BoBa, autostart, instalator) żyją
# w scripts\vzero-launchers i są NAKŁADANE na distro — trafiają do ZIP-a i kopii.
$Launchers = Join-Path $PSScriptRoot 'vzero-launchers'
if (Test-Path $Launchers) {
    Copy-Item (Join-Path $Launchers '*') $Stage -Recurse -Force
    $lc = (Get-ChildItem $Launchers -File).Count
    Ok "Nałożono $lc launcherów (kanon vzero-launchers)."
} else { Warn "Brak folderu kanonu launcherów ($Launchers) — distro bez START_KATEDRA.bat!" }

# ── 2. STRAŻNIK SEKRETÓW (post-scan — pas i szelki) ──────────────────────────
Step "2/5 Skan sekretów w staging"
$leakFiles = Get-ChildItem $Stage -Recurse -File -Force | Where-Object {
    ($_.Name -match '^\.env' -and $_.Name -ne '.env.example') -or
    ($_.Name -match 'secret' -and $_.Extension -in '.json','.env','.txt','.key','.pem','.yaml','.yml','.cfg','.ini') -or
    ($_.Extension -in '.key','.pem') -or
    ($_.Name -eq '.anthropic_key.env') -or
    ($_.Name -eq 'media_secrets.json')
}
$tokenHits = @()
Get-ChildItem $Stage -Recurse -File -Include *.env*,*.json,*.txt,*.md,*.ts,*.tsx,*.js -Force -ErrorAction SilentlyContinue |
  Where-Object { $_.Length -lt 200000 } | ForEach-Object {
    $c = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
    if ($c -match 'ghp_[A-Za-z0-9]{20,}' -or $c -match 'sk-ant-[A-Za-z0-9_-]{20,}' -or $c -match 'BEGIN [A-Z ]*PRIVATE KEY') {
        $tokenHits += $_.FullName.Replace($Stage,'')
    }
}
if ($leakFiles) {
    foreach($lf in $leakFiles){ Warn "Usuwam plik-sekret: $($lf.Name)"; Remove-Item $lf.FullName -Force }
} else { Ok "Brak plików-sekretów." }
if ($tokenHits) {
    Warn "UWAGA — wykryto wzorce tokenów w plikach:"
    $tokenHits | ForEach-Object { Write-Host "      $_" -ForegroundColor Red }
    Warn "Przejrzyj je RĘCZNIE przed publikacją (nie usuwam — mogą to być nazwy zmiennych)."
} else { Ok "Brak wzorców tokenów (ghp_/sk-ant/PEM)." }

$fileCount = (Get-ChildItem $Stage -Recurse -File).Count
$sizeMB    = [math]::Round((Get-ChildItem $Stage -Recurse -File | Measure-Object Length -Sum).Sum / 1MB, 2)
Ok "Distro: $fileCount plików · $sizeMB MB"

# ── 3. ZIP → strona otakos.wtf ───────────────────────────────────────────────
if (-not $NoZip) {
    Step "3/5 Pakowanie ZIP → otakos.wtf"
    $zipTmp = Join-Path $env:TEMP "$DistName.zip"
    if (Test-Path $zipTmp) { Remove-Item $zipTmp -Force }
    Compress-Archive -Path $Stage -DestinationPath $zipTmp -CompressionLevel Optimal -Force
    $zipMB = [math]::Round((Get-Item $zipTmp).Length / 1MB, 2)
    foreach($sub in @('public','dist')){
        $dstDir = Join-Path $WebDir $sub
        if (Test-Path $dstDir) {
            Copy-Item $zipTmp (Join-Path $dstDir 'V_ZERO_archive.zip') -Force
            Ok "$sub\V_ZERO_archive.zip ($zipMB MB)"
        } else { Warn "Brak $dstDir — pomijam." }
    }
} else { Warn "Pominięto ZIP (-NoZip)." }

# ── 4. Mirror lokalny USB ────────────────────────────────────────────────────
Step "4/5 Mirror lokalny: TeO_Genesis_${Version}_USB"
New-Item -ItemType Directory -Path $UsbLocal -Force | Out-Null
# /E (bez purge) — launchery i pliki distro-only NIE są kasowane (lekcja z /MIR).
$rc4 = @($Stage, $UsbLocal, '/E','/NFL','/NDL','/NJH','/NJS','/NP','/R:1','/W:1')
& robocopy @rc4 | Out-Null
if ($LASTEXITCODE -ge 8) { Warn "robocopy mirror lokalny kod $LASTEXITCODE" } else { Ok "Mirror lokalny zsynchronizowany." }
$global:LASTEXITCODE = 0

# ── 5. Fizyczny pendrive (BEZ kasowania — launchery zachowane) ───────────────
if ($SkipUsb) {
    Warn "Pominięto dysk ${DriveLetter}: (-SkipUsb)."
} elseif (-not (Test-Path "${DriveLetter}:\")) {
    Warn "Dysk ${DriveLetter}: niedostępny — pomijam fizyczny pendrive."
} else {
    Step "5/5 Pendrive ${DriveLetter}: (kopiuj+nadpisz, bez purge)"
    # /E zamiast /MIR — NIE kasuje launcherów (START_KATEDRA.bat, Autostart_*.xml itd.)
    $rc5 = @($Stage, $DriveDst, '/E','/NFL','/NDL','/NJH','/NJS','/NP','/R:1','/W:1')
    & robocopy @rc5 | Out-Null
    if ($LASTEXITCODE -ge 8) { Warn "robocopy pendrive kod $LASTEXITCODE" } else { Ok "Pendrive ${DriveLetter}: zaktualizowany (launchery nietknięte)." }
    $global:LASTEXITCODE = 0
}

Write-Host "`n🏛️ MINIATURYZACJA $Version ZAKOŃCZONA." -ForegroundColor Green
Info "Distro:   $fileCount plików / $sizeMB MB"
Info "ZIP:      $WebDir\public\V_ZERO_archive.zip"
Info "Mirror:   $UsbLocal"
if (-not $SkipUsb) { Info "Pendrive: $DriveDst" }
Write-Host "  ➜ Pamiętaj: stronę otakos.wtf trzeba zdeployować osobno (push repo / rebuild)." -ForegroundColor DarkGray




