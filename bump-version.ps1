# Version bump script
# Usage: .\bump-version.ps1 1.4.5

param(
    [Parameter(Mandatory=$true)]
    [string]$NewVersion
)

$ErrorActionPreference = "Stop"

Write-Host "[*] Updating version to $NewVersion ..." -ForegroundColor Cyan

# 1. package.json
(Get-Content package.json -Raw) -replace '"version":\s*"[^"]*"', "`"version`": `"$NewVersion`"" | Set-Content package.json -NoNewline -Encoding utf8
Write-Host "  [OK] package.json" -ForegroundColor Green

# 2. tauri.conf.json
(Get-Content src-tauri/tauri.conf.json -Raw) -replace '"version":\s*"[^"]*"', "`"version`": `"$NewVersion`"" | Set-Content src-tauri/tauri.conf.json -NoNewline -Encoding utf8
Write-Host "  [OK] src-tauri/tauri.conf.json" -ForegroundColor Green

# 3. Cargo.toml
(Get-Content src-tauri/Cargo.toml -Raw) -replace 'version\s*=\s*"[^"]*"', "version = `"$NewVersion`"" | Set-Content src-tauri/Cargo.toml -NoNewline -Encoding utf8
Write-Host "  [OK] src-tauri/Cargo.toml" -ForegroundColor Green

# 4. settings-page.js version display
(Get-Content src/features/settings-page.js -Raw) -replace '版本:\s*[\d.]+', "版本: $NewVersion" | Set-Content src/features/settings-page.js -NoNewline -Encoding utf8
Write-Host "  [OK] src/features/settings-page.js (version display)" -ForegroundColor Green

Write-Host ""
Write-Host "[Done] All version numbers updated to $NewVersion" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps (manual):" -ForegroundColor Yellow
Write-Host "  1. src/features/settings-page.js - add new version entry to changelogData" -ForegroundColor Yellow
Write-Host "  2. src/ui/update-announcement.js - update UPDATE_SEEN_KEY, title and content" -ForegroundColor Yellow
Write-Host "  3. Create CHANGELOG-v$NewVersion.md" -ForegroundColor Yellow
