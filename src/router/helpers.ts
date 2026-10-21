import type { RouteRecordRaw } from 'vue-router'

// Trigger glob reload for newly created views
/**
 * Pre-load all Vue components using Vite's import.meta.glob
 * This allows dynamic imports to work properly at build time
 */
const modules = import.meta.glob('../views/**/*.vue')

/**
 * Get component from pre-loaded modules
 * @param componentPath Path relative to views folder (e.g., '/setup/m_general/GeneralLanding.vue')
 */
function getComponent(componentPath: string): () => Promise<unknown> {
  const normalized = componentPath.replace(/\/+/g, '/')
  const cleanPath = normalized.startsWith('/') ? normalized : `/${normalized}`
  const fullPath = `../views${cleanPath}`
  const component = modules[fullPath]
  if (!component) {
    console.error(`Component not found: ${fullPath}`)
    // Return a fallback that will show error in console when loaded
    return () => Promise.reject(new Error(`Component not found: ${fullPath}`))
  }
  return component
}

/**
 * Generate CRUD routes (Landing, Form, View) for a module
 * @param config Configuration object for the route
 * @returns Array of route objects
 */
export function generateCrudRoutes(config: {
  path: string
  name: string
  title: string
  basePath: string
  requiresAuth?: boolean
  requiresSuperAdmin?: boolean
  activePath?: string
  prefix?: string
}): RouteRecordRaw[] {
  const {
    path,
    name,
    title,
    basePath,
    requiresAuth = true,
    requiresSuperAdmin = false,
    activePath,
    prefix,
  } = config

  // Auto-detect prefix based on path if not explicitly provided
  // If path contains /t_ or starts with t_, use "Transaksi", otherwise "Master"
  const titlePrefix = prefix || (
    basePath.includes('/t_') || name.startsWith('T') ? 'Transaksi' : 'Master'
  )

  const meta = {
    requiresAuth,
    ...(requiresSuperAdmin && { requiresSuperAdmin }),
    ...(activePath && { activePath }),
  }

  return [
    // Landing/List page
    {
      path,
      name,
      component: getComponent(`${basePath}/${name}Landing.vue`),
      meta: {
        title: `${titlePrefix} ${title}`,
        ...meta,
      },
    },
    // Form page (create/edit)
    {
      path: `${path}/form/:id?`,
      name: `${name}Form`,
      component: getComponent(`${basePath}/${name}Form.vue`),
      meta: {
        title: `Form ${title}`,
        ...meta,
      },
    },
    // View page (read-only)
    {
      path: `${path}/view/:id`,
      name: `${name}View`,
      component: getComponent(`${basePath}/${name}Form.vue`),
      meta: {
        title: `Detail ${title}`,
        ...meta,
        readOnly: true,
      },
    },
  ]
}

/**
 * Generate a single route with lazy loading
 */
export function createRoute(config: {
  path: string
  name: string
  component: string
  title: string
  requiresAuth?: boolean
  requiresSuperAdmin?: boolean
  activePath?: string
  readOnly?: boolean
}): RouteRecordRaw {
  const {
    path,
    name,
    component,
    title,
    requiresAuth = true,
    requiresSuperAdmin = false,
    activePath,
    readOnly = false,
  } = config

  return {
    path,
    name,
    component: getComponent(`${component}`),
    meta: {
      title,
      requiresAuth,
      ...(requiresSuperAdmin && { requiresSuperAdmin }),
      ...(activePath && { activePath }),
      ...(readOnly && { readOnly }),
    },
  }
}

/**
 * Generate notification detail routes
 */
export function generateNotificationRoutes(routes: Array<{
  path: string
  name: string
  component: string
  title: string
}>): RouteRecordRaw[] {
  return routes.map((route) => ({
    path: `/notifikasi/${route.path}/:id`,
    name: route.name,
    component: getComponent(`/notifikasi/${route.component}`),
    meta: {
      title: route.title,
      requiresAuth: true,
      activePath: '/notifikasi',
    },
  }))
}
