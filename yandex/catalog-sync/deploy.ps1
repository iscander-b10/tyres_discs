# Сборка zip и создание версии Cloud Function catalog-sync.
# Требуется: yc CLI, npm, заполненные ID ниже (или параметры).
param(
    [string]$FunctionId = "",
    [string]$FunctionName = "catalog-sync",
    [string]$Runtime = "nodejs20",
    [int]$Memory = 1024,
    [int]$Timeout = 300
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent $Root)
$Yc = Join-Path (Split-Path -Parent $RepoRoot) ".tools\yc\yc.exe"
if (-not (Test-Path $Yc)) { $Yc = "yc" }

Write-Host "Build catalog-sync..."
Push-Location $Root
try {
    if (-not (Test-Path "node_modules")) {
        npm install
    }
    npm run pack
} finally {
    Pop-Location
}

$Zip = Join-Path $Root "catalog-sync.zip"
if (-not (Test-Path $Zip)) {
    throw "catalog-sync.zip not found"
}

if (-not $FunctionId) {
    Write-Host "FunctionId не задан — создайте функцию и передайте -FunctionId d4e..."
    Write-Host "Zip готов: $Zip"
    Write-Host "Пример:"
    Write-Host "  yc serverless function version create --function-id <ID> --runtime $Runtime --entrypoint index.handler --memory ${Memory}m --execution-timeout ${Timeout}s --source-path `"$Zip`""
    exit 0
}

Write-Host "Publish version to function $FunctionId ..."
& $Yc serverless function version create `
    --function-id $FunctionId `
    --runtime $Runtime `
    --entrypoint index.handler `
    --memory "${Memory}m" `
    --execution-timeout "${Timeout}s" `
    --source-path $Zip

Write-Host "Done. Invoke manually:"
Write-Host "  yc serverless function invoke --id $FunctionId --data '{`"slot`":`"08:00`"}'"
Write-Host "Or: .\verify.ps1"
