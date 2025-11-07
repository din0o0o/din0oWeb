@echo off
cd /d "%~dp0"
git add . && git commit -m "Quick update" && git push
echo.
echo Changes pushed to GitHub!
pause
