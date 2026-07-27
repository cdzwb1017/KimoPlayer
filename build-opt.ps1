# KiomPlayer Extremely Compressed Package Tool
param(
    [string]$Version
)
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrEmpty($Version)) {
    # Try to read default version from package.json
    $packageJsonPath = Join-Path $PSScriptRoot "package.json"
    if (Test-Path $packageJsonPath) {
        try {
            $packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
            $Version = $packageJson.version
        } catch {
            $Version = ""
        }
    }
}

$versionSuffix = if ($Version) { "-$Version" } else { "" }
$safeExeName = "KiomPlayer${versionSuffix}-safe.exe"
$ultraExeName = "KiomPlayer${versionSuffix}-ultra.exe"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  KiomPlayer Extreme Compression Build Pipeline" -ForegroundColor Cyan
if ($Version) {
    Write-Host "  Target Version: $Version" -ForegroundColor Cyan
}
Write-Host "==========================================" -ForegroundColor Cyan

# Create output directory
$distExeDir = Join-Path $PSScriptRoot "dist-exe"
if (-not (Test-Path $distExeDir)) {
    New-Item -ItemType Directory -Path $distExeDir | Out-Null
    Write-Host "[1/5] Created output directory 'dist-exe' successfully." -ForegroundColor Green
} else {
    Write-Host "[1/5] Output directory 'dist-exe' already exists." -ForegroundColor Green
}

# 1. Frontend Build
Write-Host "`n[2/5] Building frontend static assets..." -ForegroundColor Yellow
npm run build
Write-Host "[2/5] Frontend build completed!" -ForegroundColor Green

# 2. Rust/Tauri Build
Write-Host "`n[3/5] Compiling Rust binary (Tauri Release)..." -ForegroundColor Yellow
npx tauri build
Write-Host "[3/5] Tauri build completed!" -ForegroundColor Green

# Locate output EXE
$targetExe = Join-Path $PSScriptRoot "src-tauri\target\release\KiomPlayer.exe"
if (-not (Test-Path $targetExe)) {
    $exeList = Get-ChildItem -Path "src-tauri\target\release" -Filter "*.exe" | Sort-Object LastWriteTime -Descending
    if ($exeList.Count -ge 1) {
        $targetExe = $exeList[0].FullName
    } else {
        throw "Failed to locate compiled .exe in src-tauri/target/release!"
    }
}

Write-Host "`nLocated compiled executable: $targetExe" -ForegroundColor Cyan

# Terminate running instances to prevent file lock issues
Get-Process -Name "*KiomPlayer*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Copy Scheme B (Safe optimized version)
$safeExe = Join-Path $distExeDir $safeExeName
Copy-Item -Path $targetExe -Destination $safeExe -Force
$safeSize = (Get-Item $safeExe).Length / 1MB
Write-Host "[4/5] Scheme B (Safe Optimized) generated! Size: $( "{0:N2}" -f $safeSize ) MB ($safeExeName)" -ForegroundColor Green

# 3. UPX Compression
Write-Host "`n[5/5] Preparing UPX compression..." -ForegroundColor Yellow

$upxPath = Join-Path $PSScriptRoot "upx.exe"
if (-not (Test-Path $upxPath)) {
    $sysUpx = Get-Command upx -ErrorAction SilentlyContinue
    if ($sysUpx) {
        $upxPath = $sysUpx.Source
        Write-Host "Detected system-wide UPX: $upxPath" -ForegroundColor Cyan
    } else {
        $upxVersion = "4.2.4"
        $upxUrl = "https://github.com/upx/upx/releases/download/v$upxVersion/upx-$upxVersion-win64.zip"
        $zipPath = Join-Path $PSScriptRoot "upx.zip"
        $extractDir = Join-Path $PSScriptRoot "upx-temp"
        
        Write-Host "UPX not found. Downloading official UPX v$upxVersion..." -ForegroundColor Cyan
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $upxUrl -OutFile $zipPath -UseBasicParsing
            Write-Host "Downloaded successfully. Extracting..." -ForegroundColor Cyan
            Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force
            
            $tempExe = Get-ChildItem -Path $extractDir -Filter "upx.exe" -Recurse | Select-Object -First 1
            if ($tempExe) {
                Copy-Item -Path $tempExe.FullName -Destination $upxPath -Force
                Write-Host "Extracted upx.exe to project root." -ForegroundColor Green
            } else {
                throw "upx.exe not found in extracted archive."
            }
        } catch {
            Write-Host "Failed to download UPX automatically. Error: $_" -ForegroundColor Red
            Write-Host "You can manually place 'upx.exe' in project root and re-run this script." -ForegroundColor Yellow
            Write-Host "`nPipeline completed partially: Scheme B is generated." -ForegroundColor Yellow
            exit
        } finally {
            if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
            if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
        }
    }
}

# Copy for compression
$ultraExe = Join-Path $distExeDir $ultraExeName
Copy-Item -Path $targetExe -Destination $ultraExe -Force

Write-Host "Running UPX on $ultraExeName..." -ForegroundColor Cyan
& $upxPath --best $ultraExe

if (Test-Path $ultraExe) {
    $ultraSize = (Get-Item $ultraExe).Length / 1MB
    Write-Host "`n[5/5] Scheme A (Ultra Compressed) generated! Size: $( "{0:N2}" -f $ultraSize ) MB ($ultraExeName)" -ForegroundColor Green
    
    $saved = (($safeSize - $ultraSize) / $safeSize) * 100
    Write-Host "Compression stats: Ultra version is $( "{0:N2}" -f $saved )% smaller than safe version!" -ForegroundColor Cyan
} else {
    Write-Host "UPX compression failed!" -ForegroundColor Red
}

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "  🎉 All build and compression tasks completed!" -ForegroundColor Green
Write-Host "  Outputs are located in: $distExeDir" -ForegroundColor Green
Write-Host "  1. Scheme A (Ultra Compressed): $ultraExeName" -ForegroundColor Green
Write-Host "  2. Scheme B (Safe Optimized):   $safeExeName" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
