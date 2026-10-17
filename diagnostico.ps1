# Gera diagnostico.txt com o estado da instalacao (sem expor chaves) para pedir ajuda.
$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
Set-Location $root
$out = New-Object System.Collections.Generic.List[string]
function L($t) { $out.Add($t); Write-Host $t }
function Check($name, [scriptblock]$sb) { try { L ("{0,-28} {1}" -f $name, (& $sb)) } catch { L ("{0,-28} ERRO: {1}" -f $name, $_.Exception.Message) } }
function EnvVal($n) { if (-not (Test-Path .env)) { return '' }; $l = Get-Content .env | Where-Object { $_ -match "^$n=" } | Select-Object -First 1; if ($l) { ($l -replace "^$n=", '').Trim() } else { '' } }

L "=== DIAGNOSTICO TRANSCRIBR $(Get-Date) ==="
Check 'Windows'            { (Get-CimInstance Win32_OperatingSystem).Caption }
Check 'Pasta'              { $root }
Check 'Caminho com espaco' { if ($root -match ' ') { 'SIM (ok, mas prefira C:\TranscriBR)' } else { 'nao' } }
Check 'RAM (GB)'           { [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1) }
Check 'CPU'                { (Get-CimInstance Win32_Processor | Select-Object -First 1).Name }
Check 'Disco livre (GB)'   { [math]::Round((Get-PSDrive ($root.Substring(0, 1))).Free / 1GB, 1) }
Check 'Internet'           { Invoke-WebRequest 'https://discord.com' -UseBasicParsing -TimeoutSec 15 | Out-Null; 'ok' }
Check 'Node'               { & node --version }
Check 'npm'                { & npm --version }
Check 'Python (py -3)'     { (& py -3 --version) 2>&1 }
Check 'dependencias bot'   { if (Test-Path 'node_modules\discord.js') { 'ok' } else { 'FALTANDO (rode instalar_servidor.bat)' } }
Check '.venv'              { if (Test-Path '.venv\Scripts\python.exe') { 'ok' } else { 'FALTANDO' } }
Check 'Whisper (imports)'  { (& '.venv\Scripts\python.exe' -c "import ctranslate2, faster_whisper; print('ok')") 2>&1 | Out-String }
Check 'Porta 8765 (Whisper)' { try { Invoke-WebRequest 'http://127.0.0.1:8765/' -UseBasicParsing -TimeoutSec 3 | Out-Null; 'respondendo' } catch { 'sem resposta' } }
Check 'Arquivo .env'       { if (Test-Path .env) { 'existe' } else { 'FALTANDO' } }
Check 'STT_ORDER'          { EnvVal 'STT_ORDER' }
Check 'Chave Groq'         { if (EnvVal 'GROQ_API_KEY') { 'preenchida' } else { 'vazia' } }
Check 'Chave Gemini'       { if (EnvVal 'GEMINI_API_KEY') { 'preenchida' } else { 'vazia' } }
Check 'Webhook'            { if (EnvVal 'TRANSCRIBR_WEBHOOK_URL') { 'preenchido' } else { 'vazio' } }
Check 'Token do Discord'   {
    $t = EnvVal 'DISCORD_BOT_TOKEN'
    if (-not $t) { return 'VAZIO' }
    try { $me = Invoke-RestMethod 'https://discord.com/api/v10/users/@me' -Headers @{ Authorization = "Bot $t" } -TimeoutSec 20; "valido (bot $($me.username))" } catch { 'INVALIDO ou sem rede' }
}
Check 'Inicio automatico'  { if (Test-Path (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup\TranscriBR.bat')) { 'configurado' } else { 'nao configurado' } }
Check 'Bot rodando (node)' { if (Get-Process node -ErrorAction SilentlyContinue) { 'sim' } else { 'nao' } }
L ''
L '--- Ultimas 40 linhas de logs\bot.log ---'
if (Test-Path 'logs\bot.log') { Get-Content 'logs\bot.log' -Tail 40 | ForEach-Object { L $_ } } else { L '(sem log ainda)' }

$out | Set-Content -Path (Join-Path $root 'diagnostico.txt') -Encoding UTF8
Write-Host "`nSalvo em diagnostico.txt (nao contem chaves). Envie esse arquivo para pedir ajuda." -ForegroundColor Green
