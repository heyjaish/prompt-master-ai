@echo off
cd /d "D:\AI MASTER PROMPT\prompt-master-ai"
"C:\Program Files\Git\bin\git.exe" rm --cached test-api.js
"C:\Program Files\Git\bin\git.exe" add -A
"C:\Program Files\Git\bin\git.exe" commit -m "security: remove test-api.js with hardcoded API key"
"C:\Program Files\Git\bin\git.exe" push origin main
echo DONE
