# Деплой спецификации API Gateway в Yandex Cloud.
# Требуется: yc init (или профиль с доступом к folder с gateway).
param(
    [string]$GatewayId = "d5d25m71caep28urshcb"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Spec = Join-Path $PSScriptRoot "apigw.yaml"
$Yc = Join-Path (Split-Path -Parent $Root) ".tools\yc\yc.exe"

if (-not (Test-Path $Yc)) {
    $Yc = "yc"
}

Write-Host "Gateway: $GatewayId"
Write-Host "Spec:    $Spec"
Write-Host "CLI:     $Yc"

& $Yc serverless api-gateway update $GatewayId --spec $Spec
Write-Host "Done. Verify with:"
Write-Host 'curl.exe -w "\nSIZE:%{size_download}\n" "https://d5d25m71caep28urshcb.y3q8o1jq.apigw.yandexcloud.net/z34/xml?h=50696139f497e7ed3f10c1201237058d44295f11" -o NUL'
