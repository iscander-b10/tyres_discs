# Проверка meta/snapshot через API Gateway после деплоя.
param(
    [string]$GatewayBase = "https://d5d25m71caep28urshcb.y3q8o1jq.apigw.yandexcloud.net",
    [string]$StoreId = "ElistaIvanor"
)

$ErrorActionPreference = "Stop"
$GatewayBase = $GatewayBase.TrimEnd('/')

Write-Host "GET meta..."
$metaUrl = "$GatewayBase/v2/catalog/$StoreId/meta"
curl.exe -sS -w "`nHTTP:%{http_code} SIZE:%{size_download}`n" $metaUrl

Write-Host ""
Write-Host "GET snapshot (head via curl -I / size)..."
$snapUrl = "$GatewayBase/v2/catalog/$StoreId/snapshot"
curl.exe -sS -o NUL -w "HTTP:%{http_code} SIZE:%{size_download}`n" $snapUrl

Write-Host ""
Write-Host "Expect: meta HTTP 200 JSON with storeId/version; snapshot HTTP 200 size >> 0."
Write-Host "If 404 — ещё не было успешного sync (invoke Timer / function)."
