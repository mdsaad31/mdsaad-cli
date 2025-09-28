@echo off
title MDSAAD CLI - Installation Fix Tool
color 0A

echo.
echo ===============================================
echo   MDSAAD CLI - Installation Fix Tool
echo ===============================================
echo.

REM Check if npm is installed
echo [1/5] Checking npm installation...
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: npm is not installed or not in PATH
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo After installation, restart this script.
    echo.
    pause
    exit /b 1
)
echo ✅ npm is installed

REM Get npm prefix
echo.
echo [2/5] Getting npm global directory...
for /f "tokens=*" %%i in ('npm config get prefix') do set NPM_PREFIX=%%i
echo 📁 NPM Global Directory: %NPM_PREFIX%

REM Check if mdsaad is installed
echo.
echo [3/5] Checking MDSAAD CLI installation...
npm list -g mdsaad-cli >nul 2>&1
if errorlevel 1 (
    echo 📦 MDSAAD CLI not found. Installing...
    npm install -g mdsaad-cli
    if errorlevel 1 (
        echo ❌ Installation failed. Try running as Administrator.
        pause
        exit /b 1
    )
    echo ✅ MDSAAD CLI installed successfully
) else (
    echo ✅ MDSAAD CLI is already installed
)

REM Check if npm directory is in PATH
echo.
echo [4/5] Checking PATH configuration...
echo %PATH% | find /i "%NPM_PREFIX%" >nul
if errorlevel 1 (
    echo 🛤️ Adding npm directory to PATH...
    
    REM Add to user PATH (doesn't require admin rights)
    for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v PATH 2^>nul') do set "CURRENT_PATH=%%B"
    if defined CURRENT_PATH (
        setx PATH "%CURRENT_PATH%;%NPM_PREFIX%" >nul
    ) else (
        setx PATH "%NPM_PREFIX%" >nul
    )
    
    if errorlevel 1 (
        echo ⚠️ Could not update PATH automatically.
        echo Please add this directory to your PATH manually: %NPM_PREFIX%
        echo.
        echo Instructions:
        echo 1. Press Win + R, type "sysdm.cpl" and press Enter
        echo 2. Click "Environment Variables"
        echo 3. Under "User variables", find and edit "Path"
        echo 4. Add: %NPM_PREFIX%
        echo 5. Click OK and restart your terminal
    ) else (
        echo ✅ PATH updated successfully
        echo 🔄 Please restart your terminal for changes to take effect
    )
) else (
    echo ✅ NPM directory is already in PATH
)

REM Test installation
echo.
echo [5/5] Testing MDSAAD CLI...
"%NPM_PREFIX%\mdsaad.cmd" --version 2>nul
if errorlevel 1 (
    echo ⚠️ Direct command test failed, but you can use:
    echo.
    echo   npx mdsaad-cli --version
    echo   npx mdsaad-cli ai "Hello World"
    echo.
    echo After restarting your terminal, you should be able to use:
    echo   mdsaad --version
) else (
    echo ✅ MDSAAD CLI is working perfectly!
    echo.
    echo You can now use commands like:
    echo   mdsaad --version
    echo   mdsaad ai "Hello World"
    echo   mdsaad weather London
    echo   mdsaad calc "2+2"
)

echo.
echo ===============================================
echo   Fix process completed!
echo ===============================================
echo.
echo 💡 If you still have issues:
echo    1. Restart your terminal/command prompt
echo    2. Try: npx mdsaad-cli --version
echo    3. Report issues at: https://github.com/mdsaad31/mdsaad-cli/issues
echo.

pause