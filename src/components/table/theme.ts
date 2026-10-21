import { themeQuartz } from 'ag-grid-community'

/**
 * AG Grid Theme Configuration
 * All color themes with hex codes
 */

// Color mapping for all available themes
export const themeColors = {
  // Red theme
  red: '#F22222',
  // Rose theme
  rose: '#E91E63',
  // Orange theme
  orange: '#FF9800',
  // Green theme
  green: '#4CAF50',
  // Blue theme
  blue: '#2196F3',
  // Yellow theme
  yellow: '#FFC107',
  // Violet theme
  violet: '#9C27B0',
  // Default Blue
  default: '#2196F3'
}

// Get hex color based on theme name
export const getThemeColor = (themeName: string): string => {
  return themeColors[themeName as keyof typeof themeColors] || themeColors.default
}

// Get current accent color from CSS variable or theme color
const getAccentColor = (): string => {
  try {
    const root = document.documentElement
    const styles = getComputedStyle(root)
    const primaryHSL = styles.getPropertyValue('--primary').trim()
    
    if (!primaryHSL) {
      return themeColors.red
    }
    
    // Convert HSL to hex
    const hexColor = hslToHex(primaryHSL)
    return hexColor
  } catch (error) {
    console.error('Error getting accent color:', error)
    return themeColors.red
  }
}

// Helper function to convert HSL to Hex
const hslToHex = (hslString: string): string => {
  // Remove 'hsl(' and ')' if present
  let cleanStr = hslString.trim()
  if (cleanStr.startsWith('hsl(')) {
    cleanStr = cleanStr.substring(4)
  }
  if (cleanStr.endsWith(')')) {
    cleanStr = cleanStr.substring(0, cleanStr.length - 1)
  }
  
  // Split by whitespace or comma
  const parts = cleanStr.split(/[\s,]+/).filter(p => p.length > 0)
  
  if (parts.length < 3) {
    console.warn('Invalid HSL format:', hslString, 'parts:', parts)
    return themeColors.default
  }
  
  // Parse H, S, L - remove % signs
  const h = parseInt(parts[0]!) || 0
  const s = (parseInt(parts[1]!) || 0) / 100
  const l = (parseInt(parts[2]!) || 0) / 100
  
  // HSL to RGB conversion
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = l - c / 2
  
  let r = 0, g = 0, b = 0
  
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }
  
  const toHex = (v: number) => {
    const hex = Math.round((v + m) * 255).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  
  const result = '#' + toHex(r) + toHex(g) + toHex(b)
  return result
}

/**
 * Dark Mode Theme
 */
export const createDarkTheme = () => {
  const accentColor = getAccentColor()
  const selectedBg = accentColor + '5a' // 35% opacity
  
  return themeQuartz.withParams({
    accentColor: accentColor,
    backgroundColor: "#000000",
    browserColorScheme: "dark",
    chromeBackgroundColor: {
      ref: "foregroundColor",
      mix: 0.07,
      onto: "backgroundColor"
    },
    columnBorder: true,
    foregroundColor: "#FFF",
    headerBackgroundColor: "#040404",
    headerFontSize: 14,
    oddRowBackgroundColor: "#101010",
    selectedRowBackgroundColor: selectedBg
  })
}

/**
 * Light Mode Theme
 */
export const createLightTheme = () => {
  const accentColor = getAccentColor()
  const selectedBg = accentColor + '40' // 25% opacity - more visible in light mode
  
  return themeQuartz.withParams({
    accentColor: accentColor,
    browserColorScheme: "light",
    columnBorder: true,
    headerFontSize: 14,
    oddRowBackgroundColor: "#E9E9E9",
    selectedRowBackgroundColor: selectedBg
  })
}

/**
 * Get theme based on dark mode status
 */
export const getGridTheme = (isDarkMode: boolean) => {
  return isDarkMode ? createDarkTheme() : createLightTheme()
}

/**
 * Create dark theme with specific accent color
 */
export const createDarkThemeWithColor = (accentColor: string) => {
  const selectedBg = accentColor + '5a' // 35% opacity
  
  return themeQuartz.withParams({
    accentColor: accentColor,
    backgroundColor: "#000000",
    browserColorScheme: "dark",
    chromeBackgroundColor: {
      ref: "foregroundColor",
      mix: 0.07,
      onto: "backgroundColor"
    },
    columnBorder: true,
    foregroundColor: "#FFF",
    headerBackgroundColor: "#040404",
    headerFontSize: 14,
    oddRowBackgroundColor: "#101010",
    selectedRowBackgroundColor: selectedBg
  })
}

/**
 * Create light theme with specific accent color
 */
export const createLightThemeWithColor = (accentColor: string) => {
  const selectedBg = accentColor + '40' // 25% opacity - more visible in light mode
  
  return themeQuartz.withParams({
    accentColor: accentColor,
    browserColorScheme: "light",
    columnBorder: true,
    headerFontSize: 14,
    oddRowBackgroundColor: "#E9E9E9",
    selectedRowBackgroundColor: selectedBg
  })
}

/**
 * Predefined themes for all colors
 */

// Red Themes
export const darkThemeRed = createDarkThemeWithColor(themeColors.red)
export const lightThemeRed = createLightThemeWithColor(themeColors.red)

// Rose Themes
export const darkThemeRose = createDarkThemeWithColor(themeColors.rose)
export const lightThemeRose = createLightThemeWithColor(themeColors.rose)

// Orange Themes
export const darkThemeOrange = createDarkThemeWithColor(themeColors.orange)
export const lightThemeOrange = createLightThemeWithColor(themeColors.orange)

// Green Themes
export const darkThemeGreen = createDarkThemeWithColor(themeColors.green)
export const lightThemeGreen = createLightThemeWithColor(themeColors.green)

// Blue Themes
export const darkThemeBlue = createDarkThemeWithColor(themeColors.blue)
export const lightThemeBlue = createLightThemeWithColor(themeColors.blue)

// Yellow Themes
export const darkThemeYellow = createDarkThemeWithColor(themeColors.yellow)
export const lightThemeYellow = createLightThemeWithColor(themeColors.yellow)

// Violet Themes
export const darkThemeViolet = createDarkThemeWithColor(themeColors.violet)
export const lightThemeViolet = createLightThemeWithColor(themeColors.violet)

// Default Blue Themes
export const darkThemeDefault = createDarkThemeWithColor(themeColors.default)
export const lightThemeDefault = createLightThemeWithColor(themeColors.default)

