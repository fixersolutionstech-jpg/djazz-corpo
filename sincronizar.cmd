@echo off
rem Leva os registos da Sheet para The DJAZZ\Corpo (Corpo.xlsx + Resumo_semana.md). Resultado em ponte.log
cd /d "%~dp0"
echo === %date% %time% >> ponte.log
"C:\Users\Edson Adolfo\AppData\Local\Programs\Python\Python314\python.exe" -X utf8 ponte.py sincronizar >> ponte.log 2>&1
