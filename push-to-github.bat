@echo off
echo ======================================
echo    Push changes to GitHub
echo ======================================
echo.

cd /d "%~dp0"

echo Checking git status...
git status
echo.

set /p commit_message="Enter commit message: "

if "%commit_message%"=="" (
    echo Error: Commit message cannot be empty!
    pause
    exit /b 1
)

echo.
echo Adding files...
git add .

echo Committing changes...
git commit -m "%commit_message%"

echo Pushing to GitHub...
git push

echo.
echo ======================================
echo    Done! Changes pushed to GitHub
echo ======================================
echo.
pause
