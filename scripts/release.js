#!/usr/bin/env node

/**
 * Release automation script for mdsaad CLI
 * Handles version management, testing, building, and publishing
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');
const semver = require('semver');

class ReleaseManager {
  constructor() {
    this.packagePath = path.join(__dirname, '..', 'package.json');
    this.changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  }

  async validateEnvironment() {
    console.log(chalk.blue('🔍 Validating release environment...'));
    
    // Check if we're on main branch
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
      if (branch !== 'main') {
        throw new Error(`Must be on main branch (currently on: ${branch})`);
      }
    } catch (error) {
      throw new Error('Failed to check Git branch: ' + error.message);
    }

    // Check for uncommitted changes
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
      if (status) {
        throw new Error('There are uncommitted changes in the working directory');
      }
    } catch (error) {
      throw new Error('Failed to check Git status: ' + error.message);
    }

    // Check if npm is logged in
    try {
      execSync('npm whoami', { encoding: 'utf8' });
    } catch (error) {
      throw new Error('Not logged into npm. Run: npm login');
    }

    console.log(chalk.green('✅ Environment validation passed'));
  }

  async runTests() {
    console.log(chalk.blue('🧪 Running comprehensive test suite...'));
    
    try {
      // Run linting
      console.log(chalk.cyan('  - Running ESLint...'));
      execSync('npm run lint', { stdio: 'inherit' });
      
      // Check code formatting
      console.log(chalk.cyan('  - Checking code formatting...'));
      execSync('npm run format:check', { stdio: 'inherit' });
      
      // Run all tests
      console.log(chalk.cyan('  - Running test suite...'));
      execSync('npm run test:ci', { stdio: 'inherit' });
      
      // Security audit
      console.log(chalk.cyan('  - Running security audit...'));
      execSync('npm run security:audit', { stdio: 'inherit' });
      
      console.log(chalk.green('✅ All tests passed'));
    } catch (error) {
      throw new Error('Tests failed. Please fix issues before releasing.');
    }
  }

  async updateVersion(versionType) {
    console.log(chalk.blue(`📦 Updating version (${versionType})...`));
    
    const packageJson = await fs.readJSON(this.packagePath);
    const oldVersion = packageJson.version;
    const newVersion = semver.inc(oldVersion, versionType);
    
    if (!newVersion) {
      throw new Error(`Invalid version type: ${versionType}`);
    }
    
    packageJson.version = newVersion;
    await fs.writeJSON(this.packagePath, packageJson, { spaces: 2 });
    
    console.log(chalk.green(`✅ Version updated: ${oldVersion} → ${newVersion}`));
    return { oldVersion, newVersion };
  }

  async updateChangelog(oldVersion, newVersion) {
    console.log(chalk.blue('📝 Updating changelog...'));
    
    const changelog = await fs.readFile(this.changelogPath, 'utf8');
    const today = new Date().toISOString().split('T')[0];
    
    // Find the unreleased section and update it
    const unreleasedPattern = /## \[Unreleased\]/;
    if (!unreleasedPattern.test(changelog)) {
      // Add a new release section at the top
      const newSection = `## [${newVersion}] - ${today}

### Added
- Release version ${newVersion}

## [Unreleased]

`;
      const updatedChangelog = changelog.replace(
        /^(# Changelog.*?\n\n)/m,
        `$1${newSection}`
      );
      await fs.writeFile(this.changelogPath, updatedChangelog);
    } else {
      // Replace unreleased with the new version
      const updatedChangelog = changelog.replace(
        /## \[Unreleased\]/,
        `## [${newVersion}] - ${today}`
      );
      await fs.writeFile(this.changelogPath, updatedChangelog);
    }
    
    console.log(chalk.green('✅ Changelog updated'));
  }

  async createGitTag(version) {
    console.log(chalk.blue('🏷️ Creating Git tag...'));
    
    try {
      // Stage changes
      execSync('git add package.json CHANGELOG.md', { stdio: 'inherit' });
      
      // Commit changes
      execSync(`git commit -m "chore: release version ${version}"`, { stdio: 'inherit' });
      
      // Create tag
      execSync(`git tag -a v${version} -m "Release version ${version}"`, { stdio: 'inherit' });
      
      console.log(chalk.green(`✅ Git tag v${version} created`));
    } catch (error) {
      throw new Error('Failed to create Git tag: ' + error.message);
    }
  }

  async publishToNpm() {
    console.log(chalk.blue('🚀 Publishing to npm...'));
    
    try {
      // Build the package
      execSync('npm run build', { stdio: 'inherit' });
      
      // Publish to npm
      execSync('npm publish --access public', { stdio: 'inherit' });
      
      console.log(chalk.green('✅ Package published to npm'));
    } catch (error) {
      throw new Error('Failed to publish to npm: ' + error.message);
    }
  }

  async pushToGit() {
    console.log(chalk.blue('📤 Pushing to Git repository...'));
    
    try {
      // Push commits
      execSync('git push origin main', { stdio: 'inherit' });
      
      // Push tags
      execSync('git push origin --tags', { stdio: 'inherit' });
      
      console.log(chalk.green('✅ Changes pushed to Git repository'));
    } catch (error) {
      throw new Error('Failed to push to Git: ' + error.message);
    }
  }

  async generateReleaseNotes(version) {
    console.log(chalk.blue('📋 Generating release notes...'));
    
    try {
      // Get commits since last tag
      const commits = execSync(
        'git log $(git describe --tags --abbrev=0)..HEAD --oneline',
        { encoding: 'utf8' }
      ).trim();
      
      const releaseNotes = `# Release Notes - v${version}

## Changes
${commits.split('\n').map(line => `- ${line}`).join('\n')}

## Installation
\`\`\`bash
npm install -g mdsaad-cli@${version}
\`\`\`

## Documentation
- [README](https://github.com/mdsaad/mdsaad-cli#readme)
- [API Reference](https://github.com/mdsaad/mdsaad-cli/blob/main/docs/API.md)
- [Security Guide](https://github.com/mdsaad/mdsaad-cli/blob/main/TASK-19-SECURITY.md)
`;
      
      await fs.writeFile(path.join(__dirname, '..', 'RELEASE_NOTES.md'), releaseNotes);
      console.log(chalk.green('✅ Release notes generated'));
    } catch (error) {
      console.log(chalk.yellow('⚠️ Could not generate release notes:', error.message));
    }
  }

  async release(versionType = 'patch') {
    try {
      console.log(chalk.magenta('🚀 Starting release process...\n'));
      
      // Validate environment
      await this.validateEnvironment();
      
      // Run tests
      await this.runTests();
      
      // Update version
      const { oldVersion, newVersion } = await this.updateVersion(versionType);
      
      // Update changelog
      await this.updateChangelog(oldVersion, newVersion);
      
      // Create Git tag
      await this.createGitTag(newVersion);
      
      // Generate release notes
      await this.generateReleaseNotes(newVersion);
      
      // Publish to npm
      await this.publishToNpm();
      
      // Push to Git
      await this.pushToGit();
      
      console.log(chalk.green('\n🎉 Release completed successfully!'));
      console.log(chalk.cyan(`📦 Version ${newVersion} has been published`));
      console.log(chalk.white(`🔗 Install with: npm install -g mdsaad-cli@${newVersion}`));
      
    } catch (error) {
      console.error(chalk.red('\n❌ Release failed:'), error.message);
      console.log(chalk.yellow('💡 Please fix the issues and try again.'));
      process.exit(1);
    }
  }
}

// Command-line interface
async function main() {
  const args = process.argv.slice(2);
  const versionType = args[0] || 'patch';
  
  if (!['patch', 'minor', 'major'].includes(versionType)) {
    console.error(chalk.red('❌ Invalid version type. Use: patch, minor, or major'));
    process.exit(1);
  }
  
  console.log(chalk.blue(`🎯 Releasing ${versionType} version...\n`));
  
  const releaseManager = new ReleaseManager();
  await releaseManager.release(versionType);
}

// Only run if this script is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('❌ Release script failed:'), error.message);
    process.exit(1);
  });
}

module.exports = ReleaseManager;