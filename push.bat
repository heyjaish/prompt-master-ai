@echo off
cd /d "D:\AI MASTER PROMPT\prompt-master-ai"
"C:\Program Files\Git\bin\git.exe" add -A
"C:\Program Files\Git\bin\git.exe" commit -m "feat: Firebase Google auth + Firestore database"
"C:\Program Files\Git\bin\git.exe" push origin main
echo DONE
