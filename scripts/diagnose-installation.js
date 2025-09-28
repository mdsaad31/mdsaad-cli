#!/usr/bin/env node

/**
 * Installation diagnostic and fix tool
 * Helps users resolve PATH and installation issues
 */

const { execSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

function runDiagnostics() {
    console.log('🔍 MDSAAD CLI Installation Diagnostics');
    console.log('=====================================\n');

    try {
        // 1. Check Node.js and npm
        console.log('📋 System Information:');
        console.log(`   OS: ${os.platform()} ${os.arch()}`);
        console.log(`   Node.js: ${process.version}`);
        
        try {
            const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
            console.log(`   npm: ${npmVersion}`);
        } catch (error) {
            console.log('   ❌ npm not found in PATH');
            return;
        }

        // 2. Check npm configuration
        console.log('\n📁 NPM Configuration:');
        const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
        console.log(`   Global Directory: ${npmPrefix}`);
        
        const npmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
        console.log(`   Global node_modules: ${npmRoot}`);

        // 3. Check if mdsaad-cli is installed
        console.log('\n📦 Package Installation:');
        try {
            execSync('npm list -g mdsaad-cli', { encoding: 'utf8', stdio: 'pipe' });
            console.log('   ✅ mdsaad-cli is installed globally');
        } catch (error) {
            console.log('   ❌ mdsaad-cli is not installed globally');
            console.log('   💡 Run: npm install -g mdsaad-cli');
            return;
        }

        // 4. Check binary files
        console.log('\n🔧 Binary Files:');
        const platform = os.platform();
        let binaryPath;
        
        if (platform === 'win32') {
            binaryPath = path.join(npmPrefix, 'mdsaad.cmd');
            const altBinary = path.join(npmPrefix, 'mdsaad');
            const psBinary = path.join(npmPrefix, 'mdsaad.ps1');
            
            console.log(`   Windows CMD: ${fs.existsSync(binaryPath) ? '✅' : '❌'} ${binaryPath}`);
            console.log(`   Shell Script: ${fs.existsSync(altBinary) ? '✅' : '❌'} ${altBinary}`);
            console.log(`   PowerShell: ${fs.existsSync(psBinary) ? '✅' : '❌'} ${psBinary}`);
        } else {
            binaryPath = path.join(npmPrefix, 'bin', 'mdsaad');
            console.log(`   Binary: ${fs.existsSync(binaryPath) ? '✅' : '❌'} ${binaryPath}`);
        }

        // 5. Check PATH
        console.log('\n🛤️  PATH Analysis:');
        const currentPath = process.env.PATH || '';
        const pathDirs = currentPath.split(platform === 'win32' ? ';' : ':');
        
        const expectedBinDir = platform === 'win32' ? npmPrefix : path.join(npmPrefix, 'bin');
        const isInPath = pathDirs.some(dir => path.resolve(dir) === path.resolve(expectedBinDir));
        
        console.log(`   Expected in PATH: ${expectedBinDir}`);
        console.log(`   Is in PATH: ${isInPath ? '✅' : '❌'}`);
        
        if (!isInPath) {
            console.log('\n🚨 ISSUE FOUND: npm bin directory is not in PATH');
            console.log('\n🔧 FIXES:');
            
            if (platform === 'win32') {
                console.log('   Windows Options:');
                console.log('   1. Restart your terminal (Windows may auto-add npm to PATH)');
                console.log('   2. Use npx: npx mdsaad-cli --version');
                console.log('   3. Add to PATH manually in System Settings');
                console.log(`   4. Run: setx PATH "%PATH%;${npmPrefix}"`);
            } else {
                console.log('   macOS/Linux Options:');
                console.log('   1. Add to shell config:');
                console.log(`      echo 'export PATH="${expectedBinDir}:$PATH"' >> ~/.bashrc`);
                console.log('   2. Reload: source ~/.bashrc');
                console.log('   3. Use npx: npx mdsaad-cli --version');
            }
        }

        // 6. Test command execution
        console.log('\n🧪 Command Test:');
        try {
            // Try direct execution
            if (fs.existsSync(binaryPath)) {
                const result = execSync(`"${binaryPath}" --version`, { 
                    encoding: 'utf8', 
                    timeout: 5000,
                    stdio: 'pipe'
                });
                console.log(`   ✅ Direct execution works: ${result.trim()}`);
            }
        } catch (error) {
            console.log('   ❌ Direct execution failed');
        }

        // Try through PATH
        try {
            const result = execSync('mdsaad --version', { 
                encoding: 'utf8', 
                timeout: 5000,
                stdio: 'pipe'
            });
            console.log(`   ✅ PATH execution works: ${result.trim()}`);
        } catch (error) {
            console.log('   ❌ PATH execution failed (expected if not in PATH)');
        }

        // 7. Summary and recommendations
        console.log('\n📊 Summary:');
        if (isInPath && fs.existsSync(binaryPath)) {
            console.log('   ✅ Installation appears to be working correctly');
            console.log('   💡 Try restarting your terminal if mdsaad command still doesn\'t work');
        } else {
            console.log('   ⚠️  Installation needs attention');
            console.log('   💡 Most likely cause: PATH configuration issue');
            console.log('   🎯 Quick fix: Use "npx mdsaad-cli" instead of "mdsaad"');
        }

    } catch (error) {
        console.error('❌ Diagnostic failed:', error.message);
    }

    console.log('\n=====================================');
    console.log('💬 Need help? https://github.com/mdsaad31/mdsaad-cli/issues');
    console.log('📖 Full guide: https://github.com/mdsaad31/mdsaad-cli/blob/main/INSTALLATION_TROUBLESHOOTING.md');
}

if (require.main === module) {
    runDiagnostics();
}

module.exports = { runDiagnostics };