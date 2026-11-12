import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

interface MenuPermissions {
  is_read: boolean
  is_create: boolean
  is_update: boolean
  is_delete: boolean
  is_print: boolean
}

interface CachedMenu {
  id: string
  name: string
  path: string
  icon?: string
  seq?: string
  modul?: string
  sub_modul?: string | null
}

/**
 * Mapping of child routes to their parent menu paths
 * Format: { childPath: parentMenuPath }
 * This allows child routes to inherit permissions from parent menus
 */
const CHILD_ROUTE_MAPPING: Record<string, string> = {
  // Add child route mappings here as needed
}

/**
 * Composable to get current menu ID from route
 * and provide permission checking utilities using cached permissions
 */
export function usePermission() {
  const route = useRoute()
  const authStore = useAuthStore()

  /**
   * Get cached permissions from SelectRespo in localStorage
   */
  const cachedPermissions = ref<Record<string, MenuPermissions>>({})
  const cachedMenus = ref<CachedMenu[]>([])
  
  const loadCachedPermissions = () => {
    try {
      const stored = localStorage.getItem('SelectRespo')
      if (stored) {
        const selectRespo = JSON.parse(stored)
        cachedPermissions.value = selectRespo.permissions || {}
        cachedMenus.value = selectRespo.menus || []
      } else {
        cachedPermissions.value = {}
        cachedMenus.value = []
      }
    } catch (e) {
      cachedPermissions.value = {}
      cachedMenus.value = []
    }
  }

  // Load initial permissions
  loadCachedPermissions()

  // Listen to custom event for respo changes
  const handleRespoChange = () => {
    loadCachedPermissions()
  }

  onMounted(() => {
    window.addEventListener('respoChanged', handleRespoChange)
  })

  onUnmounted(() => {
    window.removeEventListener('respoChanged', handleRespoChange)
  })

  /**
   * Find menu ID by path from cached menus
   */
  const findMenuIdByPath = (path: string): string | undefined => {
    const menu = cachedMenus.value.find(m => m?.path === path)
    return menu?.id
  }

  /**
   * Get menu ID from current route path
   * This will find the menu from user's permissions that matches current path
   * Also supports child routes that inherit from parent menus via:
   * 1. CHILD_ROUTE_MAPPING constant
   * 2. Route meta.parentMenu
   */
  const currentMenuId = computed<string | undefined>(() => {
    const currentPath = route.path
    
    // SUPER ADMIN has all permissions, return undefined to skip checks
    if (authStore.isSuperAdmin) {
      return undefined
    }

    // First, try to find exact match in cached menus
    let menuId = findMenuIdByPath(currentPath)
    if (menuId) return menuId

    // Second, try matching stripped path for form/view/detail/edit routes
    // e.g. /production/transaksi/t_mrp/form/uuid -> /production/transaksi/t_mrp
    const strippedPath = currentPath.replace(/\/(form|view|detail|edit)(\/.*)?$/, '')
    if (strippedPath && strippedPath !== currentPath) {
      menuId = findMenuIdByPath(strippedPath)
      if (menuId) return menuId
    }

    // Try finding by longest prefix match in cached menus
    const matchingMenus = cachedMenus.value.filter(m => m?.path && currentPath.startsWith(m.path))
    if (matchingMenus.length > 0) {
      // Sort by longest path to get the most specific menu
      matchingMenus.sort((a, b) => (b.path?.length || 0) - (a.path?.length || 0))
      return matchingMenus[0]?.id
    }

    // Third, try to find by base path (for form/view routes like /setup/m_prefix/form/:id)
    const basePath = '/' + currentPath.split('/').slice(1, 3).join('/')
    menuId = findMenuIdByPath(basePath)
    if (menuId) return menuId

    // Fourth, check CHILD_ROUTE_MAPPING for child routes
    const parentPath = CHILD_ROUTE_MAPPING[basePath] || CHILD_ROUTE_MAPPING[strippedPath]
    if (parentPath) {
      menuId = findMenuIdByPath(parentPath)
      if (menuId) return menuId
    }

    // Fifth, check route meta.parentMenu and find matching parent menu
    const parentMenuName = route.meta?.parentMenu as string | undefined
    if (parentMenuName) {
      // Find menu by name (case-insensitive)
      const parentMenu = cachedMenus.value.find(m => 
        m?.name && m.name.toLowerCase() === parentMenuName.toLowerCase()
      )
      if (parentMenu) return parentMenu.id
    }

    // Fallback: try authStore.getMenuPermissions() for more complex matching
    const menuPermissions = authStore.getMenuPermissions() || []
    const matchedMenu = menuPermissions.find(perm => {
      const p = perm?.m_menu?.path
      return p && (p === currentPath || p === strippedPath || p === basePath || currentPath.startsWith(p))
    })
    
    return matchedMenu?.m_menu_id
  })

  /**
   * Check if user has specific permission for current page
   * Uses cached permissions from localStorage
   */
  const hasPermission = (action: 'read' | 'create' | 'update' | 'delete' | 'print'): boolean => {
    // SUPER ADMIN always has access
    if (authStore.isSuperAdmin) return true
    
    if (!currentMenuId.value) return false
    
    // Get permission from cache
    const menuPerms = cachedPermissions.value[currentMenuId.value]
    if (!menuPerms) return false
    
    switch (action) {
      case 'read': return menuPerms.is_read
      case 'create': return menuPerms.is_create
      case 'update': return menuPerms.is_update
      case 'delete': return menuPerms.is_delete
      case 'print': return menuPerms.is_print
      default: return false
    }
  }

  /**
   * Check if user has read permission for current page
   */
  const canRead = computed(() => hasPermission('read'))

  /**
   * Check if user has create permission for current page
   */
  const canCreate = computed(() => hasPermission('create'))

  /**
   * Check if user has update permission for current page
   */
  const canUpdate = computed(() => hasPermission('update'))

  /**
   * Check if user has delete permission for current page
   */
  const canDelete = computed(() => hasPermission('delete'))

  /**
   * Check if user has print permission for current page
   */
  const canPrint = computed(() => hasPermission('print'))

  const isSuperAdminComputed = computed(() => authStore.isSuperAdmin)

  return {
    currentMenuId,
    hasPermission,
    canRead,
    canCreate,
    canUpdate,
    canDelete,
    canPrint,
    isSuperAdmin: isSuperAdminComputed
  }
}
