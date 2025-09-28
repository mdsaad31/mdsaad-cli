/**
 * Weather ASCII Art Collection
 * Visual weather representations for enhanced CLI display
 */

const weatherAscii = {
  // Current weather conditions
  sunny: `
    \\   /    
     .--.     
  .-'      '-.  
 (    \\   /    )
  '-.____.-'   
     /   \\     
    /     \\    `,

  partlyCloudy: `
   \\  /      
 __ .--.      
   .-(    ).   
  (___.__)__) `,

  cloudy: `
     .--.      
  .-(    ).    
 (___.__)__)   `,

  rainy: `
     .--.      
  .-(    ).    
 (___.__)__)   
  ʻ ʻ ʻ ʻ     
 ʻ ʻ ʻ ʻ      `,

  thunderstorm: `
     .--.      
  .-(    ).    
 (___.__)__)   
  ⚡ ʻ ⚡ ʻ     
 ʻ ʻ ʻ ʻ      `,

  snowy: `
     .--.      
  .-(    ).    
 (___.__)__)   
  * * * *      
 * * * *       `,

  foggy: `
             
  _ - _ - _   
 _ - _ - _ -  
  _ - _ - _   
 _ - _ - _ -  
             `,

  windy: `
             
 ～～～～～   
    ～～～～  
 ～～～～～   
    ～～～～  
             `,

  // Temperature indicators
  hot: `
     ╔═══╗
     ║███║
     ║███║
     ║███║
     ╚═█═╝
       █   `,

  cold: `
    *   *   
  *   *   * 
     ❄️     
  *   *   * 
    *   *   `,

  // Wind direction arrows
  windArrows: {
    N: '↑',
    NNE: '↗',
    NE: '↗',
    ENE: '↗',
    E: '→',
    ESE: '↘',
    SE: '↘',
    SSE: '↘',
    S: '↓',
    SSW: '↙',
    SW: '↙',
    WSW: '↙',
    W: '←',
    WNW: '↖',
    NW: '↖',
    NNW: '↖',
  },

  // Air quality indicators
  airQuality: {
    good: '🟢',
    fair: '🟡',
    moderate: '🟠',
    poor: '🔴',
    veryPoor: '🟣',
    extremelyPoor: '⚫',
  },

  // Time of day
  timeOfDay: {
    sunrise: `
   \\  |  /   
    \\ | /    
  --- ☀ ---  
    / | \\    
   /  |  \\   `,

    sunset: `
   \\  |  /   
    \\ | /    
  --- 🌅 ---  
    / | \\    
   /  |  \\   `,

    day: '☀️',
    night: '🌙',
  },

  // Forecast chart components
  chart: {
    tempBar: '█',
    tempEmpty: '░',
    rainDrop: '💧',
    snowFlake: '❄️',
    cloudIcon: '☁️',
  },
};

module.exports = weatherAscii;
