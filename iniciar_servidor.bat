@echo off
title TranscriBR - Servidor 24/7
chcp 65001 > nul
cd /d "%~dp0"

rem Se algo estiver faltando (primeira vez ou pasta copiada), roda o instalador antes
if not exist node_modules\discord.js goto instalar
if not exist .env goto instalar
goto rodar

:instalar
echo Faltam componentes. Executando o instalador...
call "%~dp0instalar_servidor.bat"
exit /b

:rodar
echo [%date% %time%] Iniciando TranscriBR...
node bot.js
set CODE=%errorlevel%
rem 2 = erro de configuracao (token) e 3 = ja existe outro bot rodando: nao adianta reiniciar
if "%CODE%"=="2" goto parar
if "%CODE%"=="3" goto parar
echo [%date% %time%] Bot encerrou (codigo %CODE%). Reiniciando em 10 segundos...
timeout /t 10 /nobreak > nul
goto rodar

:parar
echo.
echo O bot parou por um erro de configuracao (veja a mensagem acima).
echo Corrija o arquivo .env ou rode instalar_servidor.bat, e abra este arquivo de novo.
pause
