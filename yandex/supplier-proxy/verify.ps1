# Проверка прокси поставщиков после деплоя apigw.yaml
$Gateway = "https://d5d25m71caep28urshcb.y3q8o1jq.apigw.yandexcloud.net"
$ErrorActionPreference = "Continue"

function Test-Proxy {
    param([string]$Name, [string]$Url, [int]$MinSize, [string]$ContentPattern = "")

    $tmp = [IO.Path]::GetTempFileName()
    try {
        $meta = curl.exe -sS -w "%{http_code} %{size_download}" -o $tmp $Url --max-time 120
        $parts = $meta -split " "
        $code = [int]$parts[0]
        $size = [int]$parts[1]
        $head = if (Test-Path $tmp) { (Get-Content $tmp -TotalCount 3) -join "`n" } else { "" }

        $ok = ($code -eq 200) -and ($size -ge $MinSize)
        if ($ContentPattern -and $head -notmatch $ContentPattern) { $ok = $false }

        $status = if ($ok) { "OK" } else { "FAIL" }
        Write-Host "$status $Name HTTP=$code SIZE=$size"
        if (-not $ok) {
            Write-Host "  URL: $Url"
            if ($head) { Write-Host "  HEAD: $($head.Substring(0, [Math]::Min(120, $head.Length)))..." }
        }
        return $ok
    } finally {
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    }
}

$allOk = $true
$allOk = (Test-Proxy "b2b" "$Gateway/b2b/export_data/M35753.json" 1000000) -and $allOk
$allOk = (Test-Proxy "z34" "$Gateway/z34/xml?h=50696139f497e7ed3f10c1201237058d44295f11" 1000000 "xml") -and $allOk
$allOk = (Test-Proxy "vershina" "$Gateway/vershina/custom_export/export?export_format=XML&user_link=15fc4109&export_stocks%5B%5D=%D0%9A%D1%80%D0%B0%D1%81%D0%BD%D0%BE%D0%B4%D0%B0%D1%80&export_stocks%5B%5D=%D0%A1%D1%82%D0%B0%D0%B2%D1%80%D0%BE%D0%BF%D0%BE%D0%BB%D1%8C&export_category%5B%5D=tyres" 1000000 "xml") -and $allOk

if (-not $allOk) {
    Write-Host "`nSome checks failed. Deploy apigw.yaml first: .\deploy.ps1"
    exit 1
}
Write-Host "`nAll supplier proxy checks passed."
