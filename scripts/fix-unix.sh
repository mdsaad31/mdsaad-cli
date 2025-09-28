#!/bin/bash

# MDSAAD CLI - Installation Fix Script for macOS/Linux
# This script helps fix PATH issues with global npm installations

echo "🔧 MDSAAD CLI Installation Fix Tool"
echo "========================================="
echo

# Check if npm is installed
echo "[1/5] Checking npm installation..."
if ! command -v npm &> /dev/null; then
    echo "❌ ERROR: npm is not installed"
    echo "Please install Node.js from: https://nodejs.org/"
    exit 1
fi
echo "✅ npm is installed ($(npm --version))"

# Get npm prefix
echo
echo "[2/5] Getting npm global directory..."
NPM_PREFIX=$(npm config get prefix)
echo "📁 NPM Global Directory: $NPM_PREFIX"

# Check if mdsaad is installed
echo
echo "[3/5] Checking MDSAAD CLI installation..."
if ! npm list -g mdsaad-cli &> /dev/null; then
    echo "📦 MDSAAD CLI not found. Installing..."
    if npm install -g mdsaad-cli; then
        echo "✅ MDSAAD CLI installed successfully"
    else
        echo "❌ Installation failed. Try with sudo: sudo npm install -g mdsaad-cli"
        exit 1
    fi
else
    echo "✅ MDSAAD CLI is already installed"
fi

# Check and fix PATH
echo
echo "[4/5] Checking PATH configuration..."
BIN_DIR="$NPM_PREFIX/bin"

if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    echo "🛤️ Adding npm bin directory to PATH..."
    
    # Determine shell and config file
    SHELL_NAME=$(basename "$SHELL")
    case "$SHELL_NAME" in
        "bash")
            CONFIG_FILE="$HOME/.bashrc"
            ;;
        "zsh")
            CONFIG_FILE="$HOME/.zshrc"
            ;;
        "fish")
            CONFIG_FILE="$HOME/.config/fish/config.fish"
            echo "set -gx PATH $BIN_DIR \$PATH" >> "$CONFIG_FILE"
            echo "✅ Added to $CONFIG_FILE"
            ;;
        *)
            CONFIG_FILE="$HOME/.profile"
            ;;
    esac
    
    if [[ "$SHELL_NAME" != "fish" ]]; then
        # Check if PATH export already exists
        if ! grep -q "export PATH.*$NPM_PREFIX" "$CONFIG_FILE" 2>/dev/null; then
            echo "export PATH=\"$BIN_DIR:\$PATH\"" >> "$CONFIG_FILE"
            echo "✅ Added to $CONFIG_FILE"
        else
            echo "✅ PATH already configured in $CONFIG_FILE"
        fi
    fi
    
    # Apply to current session
    export PATH="$BIN_DIR:$PATH"
    
    echo "🔄 Please run 'source $CONFIG_FILE' or restart your terminal"
else
    echo "✅ NPM bin directory is already in PATH"
fi

# Test installation
echo
echo "[5/5] Testing MDSAAD CLI..."
if command -v mdsaad &> /dev/null; then
    echo "✅ MDSAAD CLI is working perfectly!"
    echo
    echo "🎉 You can now use commands like:"
    echo "  mdsaad --version"
    echo "  mdsaad ai 'Hello World'"
    echo "  mdsaad weather London"
    echo "  mdsaad calc '2+2'"
    
    # Test version
    echo
    echo "Current version: $(mdsaad --version 2>/dev/null || echo 'Unable to get version')"
else
    echo "⚠️ Command still not found, but you can use:"
    echo "  npx mdsaad-cli --version"
    echo "  npx mdsaad-cli ai 'Hello World'"
    echo
    echo "After restarting your terminal, you should be able to use 'mdsaad' directly"
fi

echo
echo "========================================="
echo "Fix process completed!"
echo "========================================="
echo
echo "💡 If you still have issues:"
echo "   1. Restart your terminal"
echo "   2. Try: npx mdsaad-cli --version"
echo "   3. Check: echo \$PATH | grep npm"
echo "   4. Report issues: https://github.com/mdsaad31/mdsaad-cli/issues"
echo