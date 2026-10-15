@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem Rode DEPOIS de renomear o repositorio no GitHub para "plataforma-argos".
rem Aponta o git deste PC para o novo endereco e publica o site de novo.
git remote set-url origin https://github.com/ya-H2K/plataforma-argos.git
echo  Repositorio: & git remote get-url origin
call enviar-site-github.bat sem-pausa
echo.
echo  Novo endereco do site (em 1 a 3 minutos): https://ya-h2k.github.io/plataforma-argos/
pause
