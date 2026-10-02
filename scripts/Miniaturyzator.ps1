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
    # _OtakOs_AI: CAŁY poza distro, a do paczki wraca tylko BIAŁA LISTA (krok 1a niżej).
    # 2026-10-02: czarna lista przepuściła kuznia-soup (venv z PyTorch CUDA + cache HF),
    # python312 i assety3d (dzieła 3D Suwerena) — distro 6,2 GB, ZIP 322 MB > limit GitHub.
    # Każde nowe środowisko w _OtakOs_AI wpadałoby tak samo; biała lista tego nie przepuści.
    '_OtakOs_AI',
    '_OtakOs_Aula','_OtakOs_Build','_OtakOs_Components',
    '_OtakOs_Klocki','_OtakOs_Kroniki','_OtakOs_Move','_OtakOs_Muzyka',
    '_OtakOs_Sonic','_OtakOs_Wymiar',
    # TeO_Arcade_Forge: narzędzia deweloperskie (silniki UE, RealityScan, skanery).
    # NIE należą do pobieralnej Katedry (użytkownik instaluje je osobno, jak Whisper/
    # XTTS). Bez tego distro rosło do 1.1GB (ZIP 406MB > limit GitHub 100MB). Małe
    # skrypty/docs (ue_scripts, forge_plugins, *.md) zostają — ważą grosze.
    'TeO_Arcade_Forge\ElectricDreamsEnv','TeO_Arcade_Forge\Twinmotion2026.1','TeO_Arcade_Forge\GENESIS_OVERRIDE 5.8',
    'TeO_Arcade_Forge\RealityScan_2.2','TeO_Arcade_Forge\OtakOS','TeO_Arcade_Forge\GENESIS_OVERRIDE',
    # 2026-09-21: distro urosło do 643 MB (ZIP 143 MB > limit GitHub 100 MB). Winni:
    # projekt Unreal Suwerena (258 MB) i cache analizy kodu graphify (39 MB) — nie są Katedrą.
    'TeO_Arcade_Forge\MojProjekt','graphify-out'
)
# Dołap dynamicznie wszelkie inne _OtakOs_* (na wypadek nowych) — dane i dzieła Suwerena.
$xdDynamic = Get-ChildItem $Source -Directory -Filter '_OtakOs_*' -ErrorAction SilentlyContinue |
             ForEach-Object { $_.Name }
$XD = ($xdStatic + $xdDynamic) | Select-Object -Unique

# Pliki-sekrety / śmieci — NIGDY do distro. (.env.example ZOSTAJE — to szablon.)
$XF = @(
    '.env','.env.local','.env.development','.env.production','.env.*.local',
    '.anthropic_key.env','media_secrets.json','*.key','*.pem',
    '*.log','*.bak','*.tmp','dev_server.log','.eve.example.txt',
    # narzędzie deweloperskie MCP (289 MB) — leżało w _OtakOs_AIin obok whispera, nie do distro
    'codebase-memory-mcp.exe'
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

# ── 1a. _OtakOs_AI — BIAŁA LISTA ──────────────────────────────────────────────
# bin/ (whisper-cli + DLL, ~20 MB — karaoke/STT), workflows/ (grafy ComfyUI) i małe pliki
# z korzenia (voice_server.py, requirements-voice.txt — Głos Suwerena instaluje się sam).
# Modele, głosy, środowiska (kuznia-soup, python312, voice_env) i dzieła (assety3d) — NIE.
$AiSrc = Join-Path $Source '_OtakOs_AI'
$AiDst = Join-Path $Stage '_OtakOs_AI'
if (Test-Path $AiSrc) {
    foreach ($sub in @('bin', 'workflows')) {
        $z = Join-Path $AiSrc $sub
        if (-not (Test-Path $z)) { continue }
        $rcAi = @($z, (Join-Path $AiDst $sub), '/E', '/NFL','/NDL','/NJH','/NJS','/NP','/R:1','/W:1', '/MAX:104857600')
        foreach($f in $XF){ $rcAi += '/XF'; $rcAi += $f }
        & robocopy @rcAi | Out-Null
        if ($LASTEXITCODE -ge 8) { throw "robocopy _OtakOs_AI\$sub nie powiódł się (kod $LASTEXITCODE)" }
    }
    $rcRoot = @($AiSrc, $AiDst, '/LEV:1', '/NFL','/NDL','/NJH','/NJS','/NP','/R:1','/W:1', '/MAX:5242880')
    foreach($f in $XF){ $rcRoot += '/XF'; $rcRoot += $f }
    & robocopy @rcRoot | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy _OtakOs_AI (pliki) nie powiódł się (kod $LASTEXITCODE)" }
    $global:LASTEXITCODE = 0
    Ok "_OtakOs_AI: tylko bin, workflows i małe pliki z korzenia (modele, środowiska i dzieła zostają u Suwerena)."
}

# Najcięższe katalogi distro (2 poziomy) — gdy paczka puchnie, widać od razu, co ją puchnie.
function NajciezszeKatalogi([string]$Dir, [int]$Ile = 15) {
    Get-ChildItem $Dir -Directory -Recurse -Depth 1 -Force -ErrorAction SilentlyContinue | ForEach-Object {
        $b = (Get-ChildItem $_.FullName -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
        [pscustomobject]@{ MB = [math]::Round($b / 1MB, 1); Katalog = $_.FullName.Substring($Dir.Length).TrimStart('\') }
    } | Sort-Object MB -Descending | Select-Object -First $Ile
}

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
if ($sizeMB -gt 1500) {
    Warn "Distro waży $sizeMB MB — podejrzanie dużo (21.09 było ~640 MB). Najcięższe katalogi:"
    NajciezszeKatalogi $Stage | ForEach-Object { Write-Host ("      {0,8} MB  {1}" -f $_.MB, $_.Katalog) -ForegroundColor Yellow }
}

# ── 2b. wersja.json → do paczki (Aktualizator w Katedrze wie, co ma) ──────────
# Numer z daty i godziny miniaturyzacji: „2026.10.02.1430" — rośnie z każdą paczką,
# Aktualizator porównuje go po cyfrach. Zmiany = ostatnie commity głównej Katedry.
Step "2b/5 wersja.json (numer, commit, zmiany)"
$Utf8 = New-Object System.Text.UTF8Encoding($false)   # BEZ BOM — JSON z BOM-em psuje JSON.parse
$teraz  = Get-Date
$numer  = $teraz.ToString('yyyy.MM.dd.HHmm')
$commit = ''
try { $commit = (& git -C $Source rev-parse --short HEAD 2>$null) } catch { }
$zmiany = @()
try {
    $log = & git -C $Source log -25 --no-merges "--format=%cs%x09%h%x09%s" 2>$null
    foreach ($l in $log) { $p = $l -split "`t", 3; if ($p.Count -eq 3) { $zmiany += [ordered]@{ data = $p[0]; ref = $p[1]; tytul = $p[2] } } }
} catch { Warn "Brak gita w źródle — wersja.json bez listy zmian." }
$wersja = [ordered]@{
    wersja = $Version; numer = $numer; data = $teraz.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'); commit = "$commit"
    katalogWPaczce = $DistName; zmiany = $zmiany
}
[System.IO.File]::WriteAllText((Join-Path $Stage 'wersja.json'), ($wersja | ConvertTo-Json -Depth 5), $Utf8)
Ok "wersja.json: $Version $numer ($commit)"

# ── 3. ZIP → strona otakos.wtf ───────────────────────────────────────────────
# ⚠️ NIE Compress-Archive: w PowerShell 5.1 zapisuje ścieżki z „\" — Windows to zniesie,
# ale Termux/Linux/Mac rozpakują płaskie pliki „TeO_Genesis_V_ZERO\wiesio-bridge.js".
# Budujemy zip sami, każdą ścieżkę z „/" (standard ZIP).
if (-not $NoZip) {
    Step "3/5 Pakowanie ZIP → otakos.wtf"
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zipTmp = Join-Path $env:TEMP "$DistName.zip"
    if (Test-Path $zipTmp) { Remove-Item $zipTmp -Force }
    $zipStream = [System.IO.File]::Open($zipTmp, [System.IO.FileMode]::CreateNew)
    $archiwum  = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        Get-ChildItem $Stage -Recurse -File -Force | ForEach-Object {
            $rel = $_.FullName.Substring($Stage.Length).TrimStart('\','/').Replace('\','/')
            [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archiwum, $_.FullName, "$DistName/$rel", [System.IO.Compression.CompressionLevel]::Optimal)
        }
    } finally { $archiwum.Dispose(); $zipStream.Dispose() }
    $zipMB  = [math]::Round((Get-Item $zipTmp).Length / 1MB, 2)
    # GitHub odrzuca pliki > 100 MB (push pada na pre-receive hook). Stop ZANIM paczka trafi na stronę.
    if ($zipMB -gt 95) {
        Warn "ZIP ma $zipMB MB — GitHub przyjmie najwyżej 100 MB. Nie kopiuję go na stronę. Najcięższe katalogi distro:"
        NajciezszeKatalogi $Stage | ForEach-Object { Write-Host ("      {0,8} MB  {1}" -f $_.MB, $_.Katalog) -ForegroundColor Yellow }
        throw "ZIP $zipMB MB > 95 MB — dopisz winne katalogi do wykluczeń (xdStatic) i odpal ponownie."
    }
    $sha256 = (Get-FileHash $zipTmp -Algorithm SHA256).Hash.ToLower()
    # wersja.json STRONY = to samo + paczka, suma i rozmiar (Aktualizator węzła sprawdza sumę przed podmianą kodu).
    $wersjaWeb = [ordered]@{}
    foreach ($k in $wersja.Keys) { $wersjaWeb[$k] = $wersja[$k] }
    $wersjaWeb.paczka = 'V_ZERO_archive.zip'
    $wersjaWeb.sha256 = $sha256
    $wersjaWeb.bajtow = (Get-Item $zipTmp).Length
    $jsonWeb = $wersjaWeb | ConvertTo-Json -Depth 5
    foreach($sub in @('public','dist')){
        $dstDir = Join-Path $WebDir $sub
        if (Test-Path $dstDir) {
            Copy-Item $zipTmp (Join-Path $dstDir 'V_ZERO_archive.zip') -Force
            [System.IO.File]::WriteAllText((Join-Path $dstDir 'wersja.json'), $jsonWeb, $Utf8)
            Ok "$sub\V_ZERO_archive.zip ($zipMB MB) + wersja.json ($numer, sha256 $($sha256.Substring(0,12))…)"
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


# ── 6. Studia ŹRÓDŁOWE obok Katedry (te bez statycznego buildu) ──────────────
# Story/Music/App/Games jadą w distro jako buildy w public/apps (most serwuje je
# pod /apps/…). Fashion chodzi na własnym Expressie (tsx server.ts) i buildu na
# moście NIE MA — więc na pendrive jedzie jego ŹRÓDŁO, obok Katedry, pod nazwą,
# którą zna LAUNCH_APPS mostu. Bez node_modules (npm install na maszynie
# docelowej), bez danych instancji (marki, logo, narysowane kreacje — cudze
# portfolio) i bez sekretów — tym samym sitem, co Katedra.
Step "6/6 Studia źródłowe (Fashion) obok Katedry"
$studiaZrodlowe = @(
    @{ nazwa = 'TeO_Fashion_Studio'; kandydaci = @('TeO_Fashion_Studio', 'OtakOs_Fashion\otakos-fashion-__-0.00g-app') }
)
# /XD i /XF robocopy dopasowuja NAZWY (nie sciezki wzgledne) - 'OtakOs_Fashion\marki.json'
# nie wykluczalo niczego i marki Suwerena wjechaly na pendrive. Gole nazwy dzialaja.
$xdStudio = @('node_modules', '.git', 'dist', '.vite', '.claude', 'logo', 'ofirmowane', 'kadry')
$xfStudio = $XF + @('marki.json', 'wizualizacje.json', 'obroty.json', 'kreacje.json')
foreach ($s in $studiaZrodlowe) {
    $src = $null
    foreach ($k in $s.kandydaci) { $p = Join-Path $AppRoot $k; if (Test-Path $p) { $src = $p; break } }
    if (-not $src) { Warn "$($s.nazwa): brak katalogu źródłowego — pomijam."; continue }
    $cele = @((Join-Path (Split-Path -Parent $UsbLocal) $s.nazwa))
    if (-not $SkipUsb -and (Test-Path "${DriveLetter}:\")) { $cele += "${DriveLetter}:\$($s.nazwa)" }
    foreach ($cel in $cele) {
        $rc6 = @($src, $cel, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:1', '/W:1', '/XD') + $xdStudio + @('/XF') + $xfStudio
        & robocopy @rc6 | Out-Null
        if ($LASTEXITCODE -ge 8) { Warn "robocopy $($s.nazwa) -> $cel kod $LASTEXITCODE" } else { Ok "$($s.nazwa) -> $cel" }
    }
}

Write-Host "`n🏛️ MINIATURYZACJA $Version ZAKOŃCZONA." -ForegroundColor Green
Info "Distro:   $fileCount plików / $sizeMB MB"
Info "ZIP:      $WebDir\public\V_ZERO_archive.zip (+ wersja.json $numer)"
Info "Mirror:   $UsbLocal"
if (-not $SkipUsb) { Info "Pendrive: $DriveDst" }
Write-Host "  ➜ Pamiętaj: stronę otakos.wtf trzeba zdeployować osobno (push repo / rebuild)." -ForegroundColor DarkGray




