/**
 * ASCII Art Database Manager
 * Manages categorized ASCII art collection with search and display functionality
 */

const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const loggerService = require('./logger');
const cacheService = require('./cache');

class AsciiArtDatabase {
  constructor() {
    this.artPath = path.join(__dirname, '..', 'assets', 'ascii-art');
    this.categories = ['superheroes', 'logos', 'animals'];
    this.artCache = new Map();
    this.metadata = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the ASCII art database
   */
  async initialize() {
    try {
      await this.loadArtDatabase();
      await this.loadMetadata();
      this.initialized = true;
      loggerService.info(`ASCII Art Database initialized with ${this.getTotalArtCount()} artworks`);
    } catch (error) {
      loggerService.error('Failed to initialize ASCII art database:', error);
      throw error;
    }
  }

  /**
   * Load all ASCII art from the filesystem
   */
  async loadArtDatabase() {
    for (const category of this.categories) {
      const categoryPath = path.join(this.artPath, category);
      
      try {
        if (await fs.pathExists(categoryPath)) {
          const files = await fs.readdir(categoryPath);
          const artFiles = files.filter(file => file.endsWith('.txt'));
          
          if (!this.artCache.has(category)) {
            this.artCache.set(category, new Map());
          }
          
          const categoryCache = this.artCache.get(category);
          
          for (const file of artFiles) {
            const artName = path.basename(file, '.txt');
            const filePath = path.join(categoryPath, file);
            
            try {
              const content = await fs.readFile(filePath, 'utf8');
              categoryCache.set(artName, {
                name: artName,
                category: category,
                content: content,
                filePath: filePath,
                lines: content.split('\n').length,
                width: Math.max(...content.split('\n').map(line => line.length)),
                size: content.length
              });
            } catch (error) {
              loggerService.warn(`Failed to load art file ${file}:`, error.message);
            }
          }
        }
      } catch (error) {
        loggerService.warn(`Failed to read category ${category}:`, error.message);
      }
    }
  }

  /**
   * Load or generate metadata for ASCII art
   */
  async loadMetadata() {
    const cachedMetadata = await cacheService.get('ascii_art_metadata', 'art');
    
    if (cachedMetadata) {
      this.metadata = new Map(cachedMetadata);
      return;
    }
    
    // Generate metadata if not cached
    for (const [category, artMap] of this.artCache) {
      for (const [artName, artData] of artMap) {
        const metadata = {
          name: artName,
          category: category,
          tags: this.generateTags(artName, category),
          description: this.generateDescription(artName, category),
          difficulty: this.calculateDifficulty(artData),
          popularity: Math.floor(Math.random() * 100) // Simulated popularity score
        };
        
        this.metadata.set(`${category}:${artName}`, metadata);
      }
    }
    
    // Cache metadata for 24 hours
    await cacheService.set('ascii_art_metadata', Array.from(this.metadata), 'art', 86400000);
  }

  /**
   * Get ASCII art by name and category
   */
  getArt(artName, category = null) {
    if (!this.initialized) {
      throw new Error('ASCII Art Database not initialized');
    }
    
    if (category) {
      const categoryCache = this.artCache.get(category);
      return categoryCache ? categoryCache.get(artName) : null;
    }
    
    // Search across all categories
    for (const [cat, artMap] of this.artCache) {
      const art = artMap.get(artName);
      if (art) {
        return art;
      }
    }
    
    return null;
  }

  /**
   * Search for ASCII art by name or tags
   */
  searchArt(query, options = {}) {
    if (!this.initialized) {
      throw new Error('ASCII Art Database not initialized');
    }
    
    const {
      category = null,
      limit = 10,
      fuzzy = true
    } = options;
    
    const results = [];
    const queryLower = query.toLowerCase();
    
    for (const [key, metadata] of this.metadata) {
      const [cat, artName] = key.split(':');
      
      // Filter by category if specified
      if (category && cat !== category) {
        continue;
      }
      
      let score = 0;
      
      // Exact name match gets highest score
      if (artName.toLowerCase() === queryLower) {
        score += 100;
      }
      // Partial name match
      else if (artName.toLowerCase().includes(queryLower)) {
        score += 50;
      }
      // Tag match
      else if (metadata.tags.some(tag => tag.toLowerCase().includes(queryLower))) {
        score += 30;
      }
      // Fuzzy matching if enabled
      else if (fuzzy && this.fuzzyMatch(queryLower, artName.toLowerCase())) {
        score += 20;
      }
      
      if (score > 0) {
        const artData = this.getArt(artName, cat);
        results.push({
          ...metadata,
          artData,
          score
        });
      }
    }
    
    // Sort by score descending, then by name
    results.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.name.localeCompare(b.name);
    });
    
    return results.slice(0, limit);
  }

  /**
   * Get all art in a category
   */
  getCategory(category) {
    if (!this.initialized) {
      throw new Error('ASCII Art Database not initialized');
    }
    
    if (!this.artCache.has(category)) {
      return [];
    }
    
    const categoryCache = this.artCache.get(category);
    return Array.from(categoryCache.values());
  }

  /**
   * List all available categories
   */
  getCategories() {
    return Array.from(this.artCache.keys());
  }

  /**
   * Get random art from category or all categories
   */
  getRandomArt(category = null) {
    if (!this.initialized) {
      throw new Error('ASCII Art Database not initialized');
    }
    
    let availableArt = [];
    
    if (category) {
      const categoryArt = this.getCategory(category);
      availableArt = categoryArt;
    } else {
      for (const [cat, artMap] of this.artCache) {
        availableArt.push(...Array.from(artMap.values()));
      }
    }
    
    if (availableArt.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * availableArt.length);
    return availableArt[randomIndex];
  }

  /**
   * Get popular art (top rated)
   */
  getPopularArt(limit = 5, category = null) {
    if (!this.initialized) {
      throw new Error('ASCII Art Database not initialized');
    }
    
    const results = [];
    
    for (const [key, metadata] of this.metadata) {
      const [cat, artName] = key.split(':');
      
      if (category && cat !== category) {
        continue;
      }
      
      const artData = this.getArt(artName, cat);
      if (artData) {
        results.push({
          ...metadata,
          artData
        });
      }
    }
    
    results.sort((a, b) => b.popularity - a.popularity);
    return results.slice(0, limit);
  }

  /**
   * Get ASCII art statistics
   */
  getStatistics() {
    const stats = {
      totalArt: this.getTotalArtCount(),
      categories: this.getCategories().length,
      categoryBreakdown: {},
      largestArt: null,
      smallestArt: null,
      averageSize: 0
    };
    
    let totalSize = 0;
    let maxSize = 0;
    let minSize = Infinity;
    
    for (const [category, artMap] of this.artCache) {
      stats.categoryBreakdown[category] = artMap.size;
      
      for (const [name, art] of artMap) {
        totalSize += art.size;
        
        if (art.size > maxSize) {
          maxSize = art.size;
          stats.largestArt = { name, category, size: art.size };
        }
        
        if (art.size < minSize) {
          minSize = art.size;
          stats.smallestArt = { name, category, size: art.size };
        }
      }
    }
    
    stats.averageSize = Math.round(totalSize / stats.totalArt);
    
    return stats;
  }

  /**
   * Generate tags for ASCII art
   */
  generateTags(artName, category) {
    const tags = [category];
    
    // Add name-based tags
    const words = artName.toLowerCase().split(/[-_\s]/);
    tags.push(...words);
    
    // Add category-specific tags
    switch (category) {
      case 'superheroes':
        tags.push('hero', 'comic', 'character', 'fiction');
        if (artName.includes('man')) tags.push('superhero');
        break;
      case 'logos':
        tags.push('brand', 'company', 'tech', 'software');
        break;
      case 'animals':
        tags.push('nature', 'creature', 'wildlife');
        break;
    }
    
    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Generate description for ASCII art
   */
  generateDescription(artName, category) {
    const descriptions = {
      superheroes: {
        batman: 'The Dark Knight of Gotham City',
        superman: 'The Man of Steel from Krypton',
        spiderman: 'Your friendly neighborhood web-slinger'
      },
      logos: {
        mdsaad: 'MDSAAD CLI Tool logo',
        node: 'Node.js runtime logo',
        github: 'GitHub code repository platform'
      },
      animals: {
        cat: 'Adorable feline ASCII art',
        owl: 'Wise nocturnal bird',
        penguin: 'Antarctic tuxedo bird'
      }
    };
    
    return descriptions[category]?.[artName] || `ASCII art of ${artName}`;
  }

  /**
   * Calculate difficulty score based on art complexity
   */
  calculateDifficulty(artData) {
    const { lines, width, size } = artData;
    
    // Simple scoring based on size and complexity
    let score = 0;
    
    if (lines > 50) score += 3;
    else if (lines > 20) score += 2;
    else score += 1;
    
    if (width > 80) score += 3;
    else if (width > 40) score += 2;
    else score += 1;
    
    if (size > 2000) score += 3;
    else if (size > 500) score += 2;
    else score += 1;
    
    return Math.min(score, 10); // Cap at 10
  }

  /**
   * Simple fuzzy matching algorithm
   */
  fuzzyMatch(query, target) {
    if (query.length === 0) return true;
    if (target.length === 0) return false;
    
    const threshold = 0.7;
    const maxDistance = Math.floor(query.length * (1 - threshold));
    
    return this.levenshteinDistance(query, target) <= maxDistance;
  }

  /**
   * Calculate Levenshtein distance for fuzzy matching
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Get total count of ASCII art
   */
  getTotalArtCount() {
    let total = 0;
    for (const [category, artMap] of this.artCache) {
      total += artMap.size;
    }
    return total;
  }

  /**
   * Check if database is initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Refresh the art database
   */
  async refresh() {
    this.artCache.clear();
    this.metadata.clear();
    await cacheService.invalidate('ascii_art_metadata', 'art');
    await this.initialize();
  }
}

module.exports = new AsciiArtDatabase();