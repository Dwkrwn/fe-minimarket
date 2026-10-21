import type { App, Plugin } from 'vue'
import { API_BASE_URL } from '@/lib/api'

// Create a Vue plugin that can be used with app.use()
export const ApiPlugin: Plugin = {
  install(app: App) {
    // Register as global property accessible in templates
    app.config.globalProperties.$API_BASE_URL = API_BASE_URL
    
    // Also set on window and globalThis for script access
    if (typeof window !== 'undefined') {
      (window as any).API_BASE_URL = API_BASE_URL
    }
    if (typeof globalThis !== 'undefined') {
      (globalThis as any).API_BASE_URL = API_BASE_URL
    }
    
    // Provide for composition API
    app.provide('API_BASE_URL', API_BASE_URL)
  }
}

// Export helper function for backwards compatibility
export function registerApiGlobals(app: App) {
  ApiPlugin.install?.(app)
}
