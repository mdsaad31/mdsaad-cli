/**
 * ASCII Art Animation Service
 * Handles terminal animations and effects for ASCII art display
 */

const chalk = require('chalk');
const loggerService = require('./logger');

class AsciiAnimationService {
  constructor() {
    this.isAnimating = false;
    this.animationFrame = 0;
    this.animationSpeed = 100; // milliseconds
    this.currentAnimation = null;
    this.supportsAnsi = this.detectAnsiSupport();
  }

  /**
   * Detect if terminal supports ANSI escape codes
   */
  detectAnsiSupport() {
    // Check environment variables and terminal capabilities
    const term = process.env.TERM || '';
    const colorTerm = process.env.COLORTERM || '';
    
    if (process.platform === 'win32' && !process.env.WT_SESSION) {
      // Old Windows Command Prompt has limited support
      return false;
    }
    
    return (
      term.includes('color') ||
      term.includes('ansi') ||
      term.includes('xterm') ||
      colorTerm.includes('truecolor') ||
      colorTerm.includes('24bit') ||
      process.stdout.isTTY
    );
  }

  /**
   * Clear the terminal screen
   */
  clearScreen() {
    if (this.supportsAnsi) {
      process.stdout.write('\x1B[2J\x1B[H');
    } else {
      // Fallback: print enough newlines to clear visible area
      process.stdout.write('\n'.repeat(process.stdout.rows || 25));
    }
  }

  /**
   * Move cursor to specific position
   */
  moveCursor(row, col) {
    if (this.supportsAnsi) {
      process.stdout.write(`\x1B[${row};${col}H`);
    }
  }

  /**
   * Hide cursor
   */
  hideCursor() {
    if (this.supportsAnsi) {
      process.stdout.write('\x1B[?25l');
    }
  }

  /**
   * Show cursor
   */
  showCursor() {
    if (this.supportsAnsi) {
      process.stdout.write('\x1B[?25h');
    }
  }

  /**
   * Animate ASCII art with typewriter effect
   */
  async animateTypewriter(content, options = {}) {
    const {
      speed = 50,
      color = 'white',
      startDelay = 0,
      lineDelay = 100
    } = options;

    if (startDelay > 0) {
      await this.sleep(startDelay);
    }

    const lines = content.split('\n');
    this.isAnimating = true;
    this.hideCursor();

    try {
      for (let i = 0; i < lines.length && this.isAnimating; i++) {
        const line = lines[i];
        
        for (let j = 0; j < line.length && this.isAnimating; j++) {
          const char = line[j];
          const colorFunc = this.getSafeColor(color);
        process.stdout.write(colorFunc(char));
          
          if (char !== ' ') {
            await this.sleep(speed);
          }
        }
        
        if (i < lines.length - 1) {
          process.stdout.write('\n');
          await this.sleep(lineDelay);
        }
      }
      
      process.stdout.write('\n');
    } finally {
      this.showCursor();
      this.isAnimating = false;
    }
  }

  /**
   * Animate ASCII art with fade-in effect
   */
  async animateFadeIn(content, options = {}) {
    const {
      steps = 10,
      speed = 200,
      color = 'white'
    } = options;

    const lines = content.split('\n');
    const maxWidth = Math.max(...lines.map(line => line.length));
    
    this.isAnimating = true;
    this.hideCursor();

    try {
      for (let step = 0; step < steps && this.isAnimating; step++) {
        this.clearScreen();
        this.moveCursor(1, 1);
        
        const opacity = (step + 1) / steps;
        const visibleChars = Math.floor(maxWidth * opacity);
        
        for (const line of lines) {
          const visibleLine = line.substring(0, visibleChars);
          const grayLevel = Math.floor(255 * opacity);
          const grayColor = `rgb(${grayLevel},${grayLevel},${grayLevel})`;
          
          if (chalk.supportsColor.has256) {
            process.stdout.write(chalk.hex(`#${grayLevel.toString(16).repeat(3)}`)(visibleLine) + '\n');
          } else {
            process.stdout.write(chalk[color](visibleLine) + '\n');
          }
        }
        
        await this.sleep(speed);
      }
    } finally {
      this.showCursor();
      this.isAnimating = false;
    }
  }

  /**
   * Animate ASCII art with slide-in effect
   */
  async animateSlideIn(content, options = {}) {
    const {
      direction = 'right', // 'left', 'right', 'top', 'bottom'
      speed = 100,
      color = 'white'
    } = options;

    const lines = content.split('\n');
    const maxWidth = Math.max(...lines.map(line => line.length));
    const height = lines.length;
    
    this.isAnimating = true;
    this.hideCursor();

    try {
      let steps;
      
      switch (direction) {
        case 'right':
          steps = maxWidth;
          break;
        case 'left':
          steps = maxWidth;
          break;
        case 'top':
        case 'bottom':
          steps = height;
          break;
        default:
          steps = maxWidth;
      }

      for (let step = 0; step < steps && this.isAnimating; step++) {
        this.clearScreen();
        this.moveCursor(1, 1);
        
        let displayLines = [];
        
        switch (direction) {
          case 'right':
            displayLines = lines.map(line => line.substring(0, step + 1));
            break;
            
          case 'left':
            displayLines = lines.map(line => {
              const startIndex = Math.max(0, line.length - step - 1);
              return ' '.repeat(Math.max(0, maxWidth - step - 1)) + line.substring(startIndex);
            });
            break;
            
          case 'top':
            displayLines = lines.slice(0, step + 1);
            break;
            
          case 'bottom':
            displayLines = lines.slice(Math.max(0, lines.length - step - 1));
            break;
        }
        
        for (const line of displayLines) {
          process.stdout.write(chalk[color](line) + '\n');
        }
        
        await this.sleep(speed);
      }
    } finally {
      this.showCursor();
      this.isAnimating = false;
    }
  }

  /**
   * Animate ASCII art with matrix rain effect
   */
  async animateMatrixRain(content, options = {}) {
    const {
      duration = 5000,
      speed = 100,
      color = 'green'
    } = options;

    const lines = content.split('\n');
    const maxWidth = Math.max(...lines.map(line => line.length));
    const chars = '01';
    
    this.isAnimating = true;
    this.hideCursor();

    const startTime = Date.now();

    try {
      while (this.isAnimating && (Date.now() - startTime) < duration) {
        this.clearScreen();
        this.moveCursor(1, 1);
        
        // Generate random matrix characters
        for (let row = 0; row < lines.length; row++) {
          let line = '';
          for (let col = 0; col < maxWidth; col++) {
            if (Math.random() < 0.7) {
              line += chars[Math.floor(Math.random() * chars.length)];
            } else {
              line += ' ';
            }
          }
          process.stdout.write(chalk[color](line) + '\n');
        }
        
        await this.sleep(speed);
      }
      
      // Show the actual content after matrix effect
      this.clearScreen();
      this.moveCursor(1, 1);
      process.stdout.write(chalk[color](content) + '\n');
      
    } finally {
      this.showCursor();
      this.isAnimating = false;
    }
  }

  /**
   * Animate ASCII art with pulsing effect
   */
  async animatePulse(content, options = {}) {
    const {
      cycles = 3,
      speed = 300,
      colors = ['white', 'yellow', 'cyan', 'magenta']
    } = options;

    this.isAnimating = true;
    this.hideCursor();

    try {
      for (let cycle = 0; cycle < cycles && this.isAnimating; cycle++) {
        for (let colorIndex = 0; colorIndex < colors.length && this.isAnimating; colorIndex++) {
          this.clearScreen();
          this.moveCursor(1, 1);
          
          const currentColor = colors[colorIndex];
          const colorFunc = this.getSafeColor(currentColor);
          process.stdout.write(colorFunc(content) + '\n');
          
          await this.sleep(speed);
        }
      }
    } finally {
      this.showCursor();
      this.isAnimating = false;
    }
  }

  /**
   * Animate ASCII art with wave effect
   */
  async animateWave(content, options = {}) {
    const {
      cycles = 2,
      speed = 150,
      color = 'cyan'
    } = options;

    const lines = content.split('\n');
    const frames = 20;
    
    this.isAnimating = true;
    this.hideCursor();

    try {
      for (let cycle = 0; cycle < cycles && this.isAnimating; cycle++) {
        for (let frame = 0; frame < frames && this.isAnimating; frame++) {
          this.clearScreen();
          this.moveCursor(1, 1);
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const offset = Math.floor(Math.sin((frame + i) * 0.3) * 3);
            const spacedLine = ' '.repeat(Math.max(0, offset)) + line;
            
            process.stdout.write(chalk[color](spacedLine) + '\n');
          }
          
          await this.sleep(speed);
        }
      }
    } finally {
      this.showCursor();
      this.isAnimating = false;
    }
  }

  /**
   * Stop current animation
   */
  stopAnimation() {
    this.isAnimating = false;
    this.showCursor();
  }

  /**
   * Display static ASCII art with color effects
   */
  displayStatic(content, options = {}) {
    const {
      color = 'white',
      background = null,
      bold = false,
      dim = false,
      inverse = false
    } = options;

    let styledContent = content;
    
    // Apply color
    if (color) {
      styledContent = chalk[color](styledContent);
    }
    
    // Apply background
    if (background) {
      styledContent = chalk[`bg${background.charAt(0).toUpperCase() + background.slice(1)}`](styledContent);
    }
    
    // Apply text effects
    if (bold) styledContent = chalk.bold(styledContent);
    if (dim) styledContent = chalk.dim(styledContent);
    if (inverse) styledContent = chalk.inverse(styledContent);
    
    process.stdout.write(styledContent + '\n');
  }

  /**
   * Get available animation types
   */
  getAnimationTypes() {
    return [
      'typewriter',
      'fadein',
      'slidein',
      'matrix',
      'pulse',
      'wave'
    ];
  }

  /**
   * Get available colors
   */
  getAvailableColors() {
    return [
      'black', 'red', 'green', 'yellow',
      'blue', 'magenta', 'cyan', 'white',
      'gray', 'grey', 'brightRed', 'brightGreen',
      'brightYellow', 'brightBlue', 'brightMagenta',
      'brightCyan', 'brightWhite'
    ];
  }

  /**
   * Validate and get a safe color function from chalk
   */
  getSafeColor(colorName) {
    if (typeof chalk[colorName] === 'function') {
      return chalk[colorName];
    }
    
    // Fallback to white if color doesn't exist
    loggerService.warn(`Invalid color '${colorName}', using white`);
    return chalk.white;
  }

  /**
   * Sleep utility for animations
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get terminal dimensions
   */
  getTerminalSize() {
    return {
      width: process.stdout.columns || 80,
      height: process.stdout.rows || 24
    };
  }

  /**
   * Check if animation is currently running
   */
  isRunning() {
    return this.isAnimating;
  }
}

module.exports = new AsciiAnimationService();