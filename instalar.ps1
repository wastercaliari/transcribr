# TranscriBR - instalador autonomo (Windows 10/11)
# Pode ser executado varias vezes: so completa o que falta.
param([switch]$SkipSystem)   # -SkipSystem: nao mexe em energia/inicio automatico e nao inicia o bot (uso em testes)

$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = $PSScriptRoot
Set-Location $root

function Say($msg, $color = 'White') { Write-Host $msg -ForegroundColor $color }
function Step($n, $title) { Say "`n[$n/8] $title" 'Cyan' }
function Ok($msg) { Say "  OK  $msg" 'Green' }
function Warn($msg) { Say "  !!  $msg" 'Yellow' }
function Fail($msg) { Say "`n  ERRO: $msg" 'Red'; Say "  Rode diagnostico.bat e envie o arquivo diagnostico.txt para pedir ajuda." 'Yellow'; exit 1 }
# Executa via cmd para que avisos no stderr nao virem erros vermelhos do PowerShell 5.1
function Run($cmdline) { & cmd.exe /c "$cmdline 2>&1" | Out-Host }
function Refresh-Path { $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') }
function Has($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Test-RealPython {
    if (-not (Has 'py')) { return $false }
    $out = & py -3 --version 2>&1
    return ($LASTEXITCODE -eq 0 -and "$out" -match 'Python 3')
}
function Winget-Install($id) {
    if (-not (Has 'winget')) { return $false }
    & winget install -e --id $id --silent --accept-source-agreements --accept-package-agreements | Out-Host
    Refresh-Path
    return $true
}
function Download-Run($url, $file, $arglist) {
    $out = Join-Path $env:TEMP $file
    Say "  Baixando $file ..."
    Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
    if ($file -like '*.msi') { Start-Process msiexec.exe -ArgumentList "/i `"$out`" /qn /norestart" -Verb RunAs -Wait }
    else { Start-Process $out -ArgumentList $arglist -Verb RunAs -Wait }
    Refresh-Path
}
function Get-EnvValue($name) {
    if (-not (Test-Path .env)) { return '' }
    $line = Get-Content .env | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
    if ($line) { return ($line -replace "^$name=", '').Trim() } else { return '' }
}
function Set-EnvValue($name, $value) {
    $lines = @(); if (Test-Path .env) { $lines = @(Get-Content .env) }
    $found = $false
    $lines = $lines | ForEach-Object { if ($_ -match "^$name=") { $found = $true; "$name=$value" } else { $_ } }
    if (-not $found) { $lines += "$name=$value" }
    Set-Content -Path .env -Value $lines -Encoding ASCII
}
function Clean($s) { if ($null -eq $s) { return '' }; return (($s.Trim().Trim('"').Trim("'")) -replace '^Bot\s+', '').Trim() }

Clear-Host
Say '========================================================' 'Cyan'
Say '  TranscriBR - Instalador do servidor 24/7' 'Cyan'
Say '  Leva de 5 a 15 minutos. Nao feche esta janela.' 'Cyan'
Say '========================================================' 'Cyan'

# ---------- 1. Ambiente ----------
Step 1 'Verificando o computador'
if ($root -match '\\Temp\\|\.zip|\\Rar\$') { Fail 'Voce abriu o instalador de dentro do zip. Clique com o botao direito no zip, "Extrair tudo", e rode de novo.' }
$os = (Get-CimInstance Win32_OperatingSystem).Caption
$ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
$cpu = (Get-CimInstance Win32_Processor | Select-Object -First 1).Name
Ok "$os | RAM $ramGB GB | $cpu"
$lowRam = $ramGB -lt 3.5
if ($lowRam) { Warn 'Pouca memoria: o Whisper local sera evitado se houver chaves Groq/Gemini.' }
$freeGB = [math]::Round((Get-PSDrive ($root.Substring(0, 1))).Free / 1GB, 1)
if ($freeGB -lt 3) { Warn "Pouco espaco em disco ($freeGB GB livres). Sao necessarios ~3 GB." }
try { Invoke-WebRequest -Uri 'https://discord.com' -UseBasicParsing -TimeoutSec 15 | Out-Null; Ok 'Internet ok' }
catch { Fail 'Sem acesso a internet (nao consegui abrir discord.com). Conecte e rode de novo.' }

# ---------- 2. Node.js ----------
Step 2 'Node.js'
if (-not (Has 'node')) {
    Winget-Install 'OpenJS.NodeJS.LTS' | Out-Null
    if (-not (Has 'node')) { Download-Run 'https://nodejs.org/dist/v22.11.0/node-v22.11.0-x64.msi' 'node-lts.msi' '' }
}
if (-not (Has 'node')) { Fail 'Nao consegui instalar o Node.js. Instale manualmente em https://nodejs.org (versao LTS) e rode de novo.' }
Ok ("Node " + (& node --version))

# ---------- 3. Python ----------
Step 3 'Python'
if (-not (Test-RealPython)) {
    Winget-Install 'Python.Python.3.12' | Out-Null
    if (-not (Test-RealPython)) { Download-Run 'https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe' 'python-312.exe' '/quiet InstallAllUsers=0 PrependPath=1 Include_launcher=1' }
}
if (-not (Test-RealPython)) { Fail 'Nao consegui instalar o Python. Instale o Python 3.12 em https://www.python.org/downloads (marque "Add python.exe to PATH") e rode de novo.' }
Ok ((& py -3 --version) 2>&1)

# ---------- 4. Configuracao (.env) ----------
Step 4 'Configuracao do bot'
if (-not (Test-Path .env) -or (Get-EnvValue 'DISCORD_BOT_TOKEN') -eq '' -or (Get-EnvValue 'DISCORD_BOT_TOKEN') -match 'cole_o_token') {
    Say '  Cole cada valor e aperte Enter. Deixe em branco o que nao tiver (so o token do Discord e obrigatorio).' 'Gray'
    $tokenOk = $false
    while (-not $tokenOk) {
        $token = Clean (Read-Host '  Token do bot do Discord')
        if (-not $token) { Warn 'O token e obrigatorio.'; continue }
        try {
            $me = Invoke-RestMethod -Uri 'https://discord.com/api/v10/users/@me' -Headers @{ Authorization = "Bot $token" } -TimeoutSec 20
            Ok "Token valido: bot $($me.username)"
            $botId = $me.id; $tokenOk = $true
        } catch {
            if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) { Warn 'Token invalido. Copie de novo em discord.com/developers > Bot > Reset Token.' }
            else { Warn 'Nao consegui validar o token agora (rede). Vou aceitar assim mesmo.'; $tokenOk = $true }
        }
    }
    $groq = Clean (Read-Host '  Chave da Groq (opcional)')
    if ($groq) {
        try { Invoke-RestMethod -Uri 'https://api.groq.com/openai/v1/models' -Headers @{ Authorization = "Bearer $groq" } -TimeoutSec 20 | Out-Null; Ok 'Chave Groq valida' }
        catch { Warn 'A chave da Groq parece invalida (continuando mesmo assim).' }
    }
    $gem = Clean (Read-Host '  Chave do Gemini (opcional, necessaria para /resumo)')
    if ($gem) {
        try { Invoke-RestMethod -Uri "https://generativelanguage.googleapis.com/v1beta/models?key=$gem" -TimeoutSec 20 | Out-Null; Ok 'Chave Gemini valida' }
        catch { Warn 'A chave do Gemini parece invalida (continuando mesmo assim).' }
    }
    $hook = Clean (Read-Host '  URL do webhook do canal (opcional)')
    Set-Content -Path .env -Value @("DISCORD_BOT_TOKEN=$token", "GROQ_API_KEY=$groq", "GEMINI_API_KEY=$gem", "TRANSCRIBR_WEBHOOK_URL=$hook", ("STT_ORDER=" + $(if ($groq) { 'groq,local,gemini' } else { 'local,gemini' }))) -Encoding ASCII
    Ok 'Arquivo .env criado'
} else {
    Ok 'Arquivo .env ja existe (mantido)'
}
$hasCloud = ((Get-EnvValue 'GROQ_API_KEY') -ne '') -or ((Get-EnvValue 'GEMINI_API_KEY') -ne '')
if ($lowRam -and $hasCloud) { Set-EnvValue 'STT_ORDER' 'groq,gemini'; Warn 'STT_ORDER ajustado para groq,gemini (pouca RAM).' }
elseif (-not $hasCloud) { Set-EnvValue 'STT_ORDER' 'local'; Warn 'Sem chaves de API: usando somente o Whisper local.' }
elseif ((Get-EnvValue 'GROQ_API_KEY') -ne '' -and (Get-EnvValue 'STT_ORDER') -eq 'local,groq,gemini') { Set-EnvValue 'STT_ORDER' 'groq,local,gemini'; Ok 'STT_ORDER atualizado: Groq (mais preciso) primeiro, Whisper local de reserva.' }

# ---------- 5. Dependencias do bot ----------
Step 5 'Dependencias do bot (npm)'
$npmOk = $false
foreach ($try in 1..2) {
    Run 'npm install --omit=dev --no-audit --no-fund --loglevel=error'
    if ($LASTEXITCODE -eq 0 -and (Test-Path 'node_modules\discord.js')) { $npmOk = $true; break }
    Warn 'npm falhou, tentando de novo...'
}
if (-not $npmOk) { Fail 'Nao consegui instalar as dependencias do bot (npm install).' }
Ok 'Dependencias instaladas'

# ---------- 6. Whisper local ----------
Step 6 'Whisper local (voz para texto offline)'
$order = Get-EnvValue 'STT_ORDER'
if ($order -notmatch 'local') {
    Warn 'Whisper local desativado na configuracao; pulando.'
} else {
    $py = Join-Path $root '.venv\Scripts\python.exe'
    if (Test-Path $py) { & $py --version 2>&1 | Out-Null; if ($LASTEXITCODE -ne 0) { Remove-Item -Recurse -Force .venv } }
    if (-not (Test-Path $py)) { Run 'py -3 -m venv .venv' }
    if (-not (Test-Path $py)) { Fail 'Nao consegui criar o ambiente Python (.venv).' }
    Run "`"$py`" -m pip install --upgrade pip --quiet"
    Run "`"$py`" -m pip install faster-whisper numpy --progress-bar off"
    $test = { & $py -c "import ctranslate2, faster_whisper, numpy; print('imports ok')" 2>&1 }
    $r = & $test
    if ($LASTEXITCODE -ne 0) {
        Warn 'O Whisper nao carregou (provavel falta do Visual C++). Instalando o runtime...'
        if (-not (Winget-Install 'Microsoft.VCRedist.2015+.x64')) { }
        $r = & $test
        if ($LASTEXITCODE -ne 0) {
            Download-Run 'https://aka.ms/vs/17/release/vc_redist.x64.exe' 'vc_redist.x64.exe' '/install /quiet /norestart'
            $r = & $test
        }
    }
    if ($LASTEXITCODE -eq 0) {
        Say '  Baixando o modelo Whisper "small" (~460 MB, so na primeira vez)...' 'Gray'
        Run "`"$py`" -c `"from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8'); print('modelo ok')`""
        if ($LASTEXITCODE -eq 0) { Ok 'Whisper local funcionando' } else { $LASTEXITCODE = 1 }
    }
    if ($LASTEXITCODE -ne 0) {
        if ($hasCloud) {
            Set-EnvValue 'STT_ORDER' 'groq,gemini'
            Warn 'O Whisper local nao funciona neste computador. Usarei Groq/Gemini (STT_ORDER ajustado).'
        } else {
            Fail 'O Whisper local nao funciona neste computador e nao ha chaves Groq/Gemini. Crie uma chave gratis da Groq (console.groq.com/keys), coloque em GROQ_API_KEY no .env e rode de novo.'
        }
    }
}

# ---------- 7. Energia e inicio automatico ----------
Step 7 'Energia e inicio automatico'
if ($SkipSystem) { Warn 'Pulado (-SkipSystem).' }
else {
    & powercfg /change standby-timeout-ac 0 | Out-Null
    & powercfg /change hibernate-timeout-ac 0 | Out-Null
    & powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0 | Out-Null
    & powercfg /setdcvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0 | Out-Null
    & powercfg /setactive SCHEME_CURRENT | Out-Null
    Ok 'Suspensao desativada (inclusive ao fechar a tampa)'
    $startup = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
    Set-Content -Path (Join-Path $startup 'TranscriBR.bat') -Value @('@echo off', "start `"`" /min `"$root\iniciar_servidor.bat`"") -Encoding ASCII
    & schtasks /delete /tn 'TranscriBR Servidor' /f 2>&1 | Out-Null
    Ok 'Inicia sozinho quando voce entrar no Windows'
}

# ---------- 8. Iniciar e verificar ----------
Step 8 'Iniciando o bot'
if ($SkipSystem) { Warn 'Pulado (-SkipSystem).' }
else {
    $log = Join-Path $root 'logs\bot.log'
    $before = 0; if (Test-Path $log) { $before = (Get-Content $log).Count }
    Start-Process -FilePath (Join-Path $root 'iniciar_servidor.bat') -WindowStyle Minimized
    $online = $false
    foreach ($i in 1..60) {
        Start-Sleep -Seconds 2
        if (Test-Path $log) {
            $new = @(Get-Content $log | Select-Object -Skip $before)
            if ($new -match 'servidor online') { $online = $true; break }
            if ($new -match 'token do bot est') { break }
        }
    }
    if ($online) {
        Ok 'Bot online no Discord!'
        $guilds = (Get-Content $log | Select-Object -Skip $before | Where-Object { $_ -match 'Servidores:' } | Select-Object -Last 1)
        if ($guilds -match 'Servidores:\s*$') {
            Warn 'O bot ainda nao esta em nenhum servidor. Convide pelo link abaixo:'
            if ($botId) { Say "  https://discord.com/oauth2/authorize?client_id=$botId&scope=bot%20applications.commands&permissions=1125376" 'White' }
        }
    } else {
        Warn 'O bot nao confirmou que ficou online. Abra a janela do bot (barra de tarefas) ou rode diagnostico.bat.'
    }
}

Say "`n========================================================" 'Green'
Say '  INSTALACAO CONCLUIDA' 'Green'
Say '  - Entre numa call de voz e fale: as falas vao para o canal "transcribr-".' 'Green'
Say '  - Comandos: /transcrever  /parar  /resumo  /status' 'Green'
Say '  - Dica: ative o login automatico (Win+R, netplwiz) para voltar sozinho apos queda de energia.' 'Green'
Say '========================================================' 'Green'
