# 🚨 MDSAAD CLI Installation Troubleshooting Guide

## **Issue**: `mdsaad` command not recognized after successful npm installation

This is a common issue with global npm packages. The CLI installs correctly but the system can't find the command.

---

## **🔍 Quick Diagnosis**

Run these commands to identify the problem:

### **1. Verify Installation**
```bash
npm list -g mdsaad-cli
```
✅ Should show: `mdsaad-cli@1.0.0`

### **2. Check npm Global Directory**
```bash
npm config get prefix
```
📁 Common locations:
- **Windows**: `C:\Users\[username]\AppData\Roaming\npm`
- **macOS**: `/usr/local` or `~/.npm-global`
- **Linux**: `/usr/local` or `~/.npm-global`

### **3. Check if Binary Exists**
```bash
# Windows
dir "%USERPROFILE%\AppData\Roaming\npm\mdsaad*"

# macOS/Linux
ls -la $(npm config get prefix)/bin/mdsaad*
```

---

## **🛠️ Solutions by Platform**

### **Windows Solutions**

#### **Method 1: Add npm to PATH (Recommended)**
1. Open PowerShell as Administrator
2. Run:
```powershell
# Get npm global path
$npmPath = npm config get prefix
echo "NPM Global Path: $npmPath"

# Add to PATH permanently
$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($currentPath -notlike "*$npmPath*") {
    [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$npmPath", "User")
    echo "✅ Added $npmPath to PATH"
}

# Restart your terminal and try: mdsaad --version
```

#### **Method 2: Use npx (Immediate Fix)**
```bash
npx mdsaad-cli --version
npx mdsaad-cli ai "Hello!"
```

#### **Method 3: PowerShell Profile Setup**
```powershell
# Add this to your PowerShell profile
$npmGlobalPath = npm config get prefix
$env:PATH += ";$npmGlobalPath"
```

### **macOS Solutions**

#### **Method 1: Fix npm Global Directory**
```bash
# Create npm global directory
mkdir ~/.npm-global

# Configure npm
npm config set prefix '~/.npm-global'

# Add to PATH in ~/.bash_profile or ~/.zshrc
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bash_profile
source ~/.bash_profile

# Reinstall
npm install -g mdsaad-cli
```

#### **Method 2: Use Homebrew Node**
```bash
# If using Homebrew
brew install node
npm install -g mdsaad-cli
```

### **Linux Solutions**

#### **Method 1: Fix Global Directory Permissions**
```bash
# Create npm global directory
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'

# Add to PATH
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Reinstall
npm install -g mdsaad-cli
```

#### **Method 2: Use sudo (Not recommended but works)**
```bash
sudo npm install -g mdsaad-cli
```

---

## **🚀 Alternative Installation Methods**

### **1. Direct Download & Setup (Windows)**
```batch
@echo off
REM Download and setup script
curl -L https://registry.npmjs.org/mdsaad-cli/-/mdsaad-cli-1.0.0.tgz -o mdsaad-cli.tgz
tar -xzf mdsaad-cli.tgz
cd package
node src/cli.js %*
```

### **2. Global Alias Setup**
Add this to your shell configuration:

**PowerShell (Windows)**:
```powershell
# Add to $PROFILE
function mdsaad { npx mdsaad-cli @args }
```

**Bash/Zsh (macOS/Linux)**:
```bash
# Add to ~/.bashrc or ~/.zshrc
alias mdsaad='npx mdsaad-cli'
```

### **3. Yarn Alternative**
```bash
# If you have Yarn
yarn global add mdsaad-cli

# Make sure Yarn global bin is in PATH
yarn global bin
```

---

## **⚡ Quick Fix Script**

Save this as `fix-mdsaad.bat` (Windows) or `fix-mdsaad.sh` (macOS/Linux):

### **Windows (fix-mdsaad.bat)**
```batch
@echo off
echo 🔧 Fixing MDSAAD CLI Installation...

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Get npm prefix
for /f "tokens=*" %%i in ('npm config get prefix') do set NPM_PREFIX=%%i
echo 📁 NPM Global Directory: %NPM_PREFIX%

REM Check if mdsaad is installed
npm list -g mdsaad-cli >nul 2>&1
if errorlevel 1 (
    echo 📦 Installing MDSAAD CLI...
    npm install -g mdsaad-cli
)

REM Add to PATH if not already there
echo %PATH% | find /i "%NPM_PREFIX%" >nul
if errorlevel 1 (
    echo 🛤️ Adding npm to PATH...
    setx PATH "%PATH%;%NPM_PREFIX%"
    echo ✅ PATH updated. Please restart your terminal.
) else (
    echo ✅ NPM directory already in PATH
)

REM Test installation
echo 🧪 Testing installation...
"%NPM_PREFIX%\mdsaad.cmd" --version
if errorlevel 1 (
    echo ❌ Installation test failed
    echo 💡 Try running: npx mdsaad-cli --version
) else (
    echo ✅ Installation successful!
    echo 🎉 You can now use: mdsaad --version
)

pause
```

### **macOS/Linux (fix-mdsaad.sh)**
```bash
#!/bin/bash
echo "🔧 Fixing MDSAAD CLI Installation..."

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Get npm prefix
NPM_PREFIX=$(npm config get prefix)
echo "📁 NPM Global Directory: $NPM_PREFIX"

# Install if not already installed
if ! npm list -g mdsaad-cli &> /dev/null; then
    echo "📦 Installing MDSAAD CLI..."
    npm install -g mdsaad-cli
fi

# Add to PATH
BIN_DIR="$NPM_PREFIX/bin"
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    echo "🛤️ Adding npm bin to PATH..."
    
    # Add to appropriate shell config
    if [[ "$SHELL" == *"zsh"* ]]; then
        echo "export PATH=\"$BIN_DIR:\$PATH\"" >> ~/.zshrc
        echo "✅ Added to ~/.zshrc"
    else
        echo "export PATH=\"$BIN_DIR:\$PATH\"" >> ~/.bashrc
        echo "✅ Added to ~/.bashrc"
    fi
    
    # Apply immediately
    export PATH="$BIN_DIR:$PATH"
else
    echo "✅ NPM bin directory already in PATH"
fi

# Test installation
echo "🧪 Testing installation..."
if command -v mdsaad &> /dev/null; then
    echo "✅ Installation successful!"
    mdsaad --version
    echo "🎉 You can now use: mdsaad --version"
else
    echo "❌ Command still not found"
    echo "💡 Try running: npx mdsaad-cli --version"
    echo "💡 Or restart your terminal and try again"
fi
```

---

## **📞 User Instructions**

### **For Users Having Issues:**

1. **Try the quick fix first:**
   ```bash
   npx mdsaad-cli --version
   ```

2. **If that works, the issue is PATH-related. Run our fix script or:**
   ```bash
   # Add npm to PATH permanently
   echo 'export PATH=$(npm config get prefix)/bin:$PATH' >> ~/.bashrc
   source ~/.bashrc
   ```

3. **Alternative: Create an alias:**
   ```bash
   echo 'alias mdsaad="npx mdsaad-cli"' >> ~/.bashrc
   source ~/.bashrc
   ```

### **Support Message for Users:**
```
If you're having trouble with the 'mdsaad' command after installation:

1. ✅ Try: npx mdsaad-cli --version
2. 📥 Download our fix script: [link to fix script]
3. 🆘 Report issue: https://github.com/mdsaad31/mdsaad-cli/issues

The CLI is installed correctly, it's just a PATH configuration issue.
We're working on an improved installer that fixes this automatically!
```

---

## **🔍 Debugging Commands**

Help users diagnose their specific issue:

```bash
# Check npm configuration
npm config list
npm config get prefix
npm bin -g

# Check PATH
echo $PATH

# Check if binary exists
which mdsaad
type mdsaad

# List global packages
npm list -g --depth=0
```

---

**This guide should resolve 99% of installation issues across all platforms!** 🎯