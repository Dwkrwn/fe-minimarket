import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiCall, API_BASE_URL, logoutApi } from '@/lib/api'

// Menu Interface
interface Menu {
  id: string
  name: string
  desc: string
  sub_modul: string | null
  icon: string
  is_acti: boolean
  seq: string
  modul: string
  path: string
  created: string
  updated: string
}

// Menu Permission Interface
interface MenuPermission {
  id: string
  m_role_id: string
  m_menu_id: string
  is_read: boolean
  is_create: boolean
  is_update: boolean
  is_delete: boolean
  is_print: boolean
  createdAt: string
  updatedAt: string
  m_menu: Menu
}

// Role Interface
interface Role {
  id: string
  kode_role: string | null
  nama_role: string
  catatan: string | null
  is_active: boolean
  createdAt: string
  updatedAt: string
  m_role_ds: MenuPermission[]
}

// Respo Detail Interface
interface RespoDetail {
  id: string
  m_respo_id: string
  m_role_id: string
  is_active: boolean
  createdAt: string
  updatedAt: string
  m_role: Role
}

// Respo Interface
interface Respo {
  id: string
  m_unit_bisnis_id: string | null
  nama: string
  catatan: string | null
  is_active: boolean
  m_gudang_id?: string | null   // gudang yang dimiliki respo ini
  createdAt: string
  updatedAt: string
  m_respo_ds: RespoDetail[]
  unit_bisnis?: {
    id: string
    nama_comp: string
    kode_unit_bisnis?: string
    m_company?: {
      id?: string
      nama?: string
      logo_img?: string | null
    } | null
  }
}

// User Detail Interface
interface UserDetail {
  id: string
  user_default_id: string
  is_primary: boolean
  is_active: boolean
  m_respo_id: string
  createdAt: string
  updatedAt: string
  m_respo: Respo
}

// Tipe User Interface
interface TipeUser {
  id: string
  group: string
  key1: string
  code: string
  value1: string
  value2: string
  value3: string
  value4: string
  value5: string
  is_active: boolean
  createdAt: string
  updatedAt: string
}

// Approval Data Interface - Simplified (hanya data penting)
export interface ApprovalData {
  // m_approval ID
  id: string | null

  level: number
  min_val: string | null
  max_val: string | null
  // max_disc: string | null          // moved to header, not used in detail
  // max_disc_value: string | null    // reserved, not actively used
  is_full: boolean
  is_use_limit: boolean              // new: flag whether limit validation applies

  // String properties untuk akses mudah (null jika tidak ada data)
  // top: string | null                    // dari top_approval.value1 - not used
  tipe_approve: string | null          // dari tipe_approv.value1
  nama_approval: string | null         // dari m_approval.nama_approval
  nama_menu: string | null             // dari m_menu.name
  modul: string | null                 // dari m_menu.modul
  sub_modul: string | null             // dari m_menu.sub_modul
  path: string | null                  // dari m_menu.path

  // Sender info (user yang mengajukan approval)
  sender_id: string | null             // dari user_default.id
  sender_name: string | null           // dari user_default.name
}

// User Interface
interface User {
  id: string
  name: string
  username: string
  password: string
  catatan: string | null
  tipe_user_id: string
  is_active: boolean
  m_kary_id: string | null
  createdAt: string
  updatedAt: string
  user_details?: UserDetail[]
  tipe?: TipeUser
}

// Event emitter untuk token expired
type TokenExpiredCallback = () => void
let tokenExpiredCallbacks: TokenExpiredCallback[] = []

export const onTokenExpired = (callback: TokenExpiredCallback) => {
  tokenExpiredCallbacks.push(callback)
}

const emitTokenExpired = () => {
  tokenExpiredCallbacks.forEach(callback => callback())
}

export const useAuthStore = defineStore('auth', () => {
  // State - hanya simpan user dan token
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)

  // Getters
  const isAuthenticated = computed(() => !!token.value)
  const currentUser = computed(() => user.value)
  const tipeUser = computed(() => user.value?.tipe)
  
  // Check if user is SUPER ADMIN
  const isSuperAdmin = computed(() => {
    return user.value?.tipe?.value1?.toUpperCase() === 'SUPER ADMIN'
  })
  
  const userDetails = computed(() => user.value?.user_details || [])
  
  // Get all respos from user_details
  const respos = computed(() => {
    const respoList: Respo[] = []
    
    // If SUPER ADMIN, create a virtual respo with all menus
    if (isSuperAdmin.value) {
      // Return virtual respo for super admin
      return [{
        id: 'super-admin-respo',
        m_unit_bisnis_id: null,
        nama: 'Bos Baut',
        catatan: 'Super Admin - Full Access',
        is_active: true,
        createdAt: '',
        updatedAt: '',
        m_respo_ds: []
      }]
    }
    
    user.value?.user_details?.forEach(userDetail => {
      if (userDetail.is_active && userDetail.m_respo) {
        respoList.push(userDetail.m_respo)
      }
    })
    return respoList
  })

  // Check if user has permission for a specific menu (optionally filtered by respo)
  const hasPermission = (menuId: string, permissionType: 'read' | 'create' | 'update' | 'delete' | 'print', respoId?: string): boolean => {
    // SUPER ADMIN has access to everything
    if (isSuperAdmin.value) return true
    
    if (!user.value?.user_details) return false
    
    // If respoId is provided, check ONLY that specific respo
    if (respoId) {
      const userDetail = user.value.user_details.find(ud => ud.m_respo_id === respoId)
      if (!userDetail || !userDetail.is_active || !userDetail.m_respo?.is_active) {
        return false
      }
      
      for (const respoDetail of userDetail.m_respo.m_respo_ds || []) {
        if (!respoDetail.is_active || !respoDetail.m_role?.is_active) continue
        
        for (const roleDetail of respoDetail.m_role.m_role_ds || []) {
          if (roleDetail.m_menu_id === menuId) {
            switch (permissionType) {
              case 'read': return roleDetail.is_read
              case 'create': return roleDetail.is_create
              case 'update': return roleDetail.is_update
              case 'delete': return roleDetail.is_delete
              case 'print': return roleDetail.is_print
            }
          }
        }
      }
      
      return false
    }
    
    // If no respoId, check ALL respos (original behavior for backward compatibility)
    for (const userDetail of user.value.user_details) {
      if (!userDetail.is_active || !userDetail.m_respo?.is_active) continue
      
      for (const respoDetail of userDetail.m_respo.m_respo_ds || []) {
        if (!respoDetail.is_active || !respoDetail.m_role?.is_active) continue
        
        for (const roleDetail of respoDetail.m_role.m_role_ds || []) {
          if (roleDetail.m_menu_id === menuId) {
            switch (permissionType) {
              case 'read': if (roleDetail.is_read) return true; break
              case 'create': if (roleDetail.is_create) return true; break
              case 'update': if (roleDetail.is_update) return true; break
              case 'delete': if (roleDetail.is_delete) return true; break
              case 'print': if (roleDetail.is_print) return true; break
            }
          }
        }
      }
    }
    
    return false
  }

  // Check if user has access to a menu (at least read permission)
  const hasAccess = (menuId: string): boolean => {
    return hasPermission(menuId, 'read')
  }

  // Get all menus with permissions
  const getMenuPermissions = () => {
    const menuMap = new Map<string, MenuPermission>()
    
    user.value?.user_details?.forEach(userDetail => {
      if (!userDetail.is_active || !userDetail.m_respo?.is_active) return
      
      userDetail.m_respo.m_respo_ds?.forEach(respoDetail => {
        if (!respoDetail.is_active || !respoDetail.m_role?.is_active) return
        
        respoDetail.m_role.m_role_ds?.forEach(roleDetail => {
          const existingPerm = menuMap.get(roleDetail.m_menu_id)
          
          if (!existingPerm) {
            menuMap.set(roleDetail.m_menu_id, roleDetail)
          } else {
            // Merge permissions (take most permissive)
            existingPerm.is_read = existingPerm.is_read || roleDetail.is_read
            existingPerm.is_create = existingPerm.is_create || roleDetail.is_create
            existingPerm.is_update = existingPerm.is_update || roleDetail.is_update
            existingPerm.is_delete = existingPerm.is_delete || roleDetail.is_delete
            existingPerm.is_print = existingPerm.is_print || roleDetail.is_print
          }
        })
      })
    })
    
    return Array.from(menuMap.values())
  }

  // Initialize SelectRespo - create and save SelectRespo data to localStorage
  const initializeSelectRespo = () => {
    // For SUPER ADMIN
    if (isSuperAdmin.value) {
      const selectRespoData = {
        respoId: 'super-admin-respo',
        respoName: 'Bos Baut',
        isPrimary: true,
        companyId: null,
        companyName: null,
        companyLegalName: 'Bos Baut',
        companyLogo: '/hutomoLogoPutih.png',
        menus: [],
        permissions: {}
      }
      localStorage.setItem('SelectRespo', JSON.stringify(selectRespoData))
      return
    }

    // For regular users, find primary or first active respo
    const primaryDetail = user.value?.user_details?.find(ud => ud.is_primary && ud.is_active)
    const firstActiveDetail = user.value?.user_details?.find(ud => ud.is_active)
    const targetDetail = primaryDetail || firstActiveDetail

    if (!targetDetail?.m_respo) return

    // Extract menus and permissions from this respo
    const permissions: Record<string, {
      is_read: boolean
      is_create: boolean
      is_update: boolean
      is_delete: boolean
      is_print: boolean
    }> = {}

    const menuMap = new Map<string, any>()

    targetDetail.m_respo.m_respo_ds?.forEach(respoDetail => {
      if (!respoDetail.is_active || !respoDetail.m_role?.is_active) return

      respoDetail.m_role.m_role_ds?.forEach(roleDetail => {
        const menuId = roleDetail.m_menu_id
        
        // Store menu data
        if (roleDetail.m_menu && !menuMap.has(menuId)) {
          menuMap.set(menuId, {
            id: roleDetail.m_menu.id,
            name: roleDetail.m_menu.name,
            path: roleDetail.m_menu.path,
            icon: roleDetail.m_menu.icon,
            seq: roleDetail.m_menu.seq,
            modul: roleDetail.m_menu.modul
          })
        }
        
        // Merge permissions
        if (permissions[menuId]) {
          permissions[menuId].is_read = permissions[menuId].is_read || roleDetail.is_read
          permissions[menuId].is_create = permissions[menuId].is_create || roleDetail.is_create
          permissions[menuId].is_update = permissions[menuId].is_update || roleDetail.is_update
          permissions[menuId].is_delete = permissions[menuId].is_delete || roleDetail.is_delete
          permissions[menuId].is_print = permissions[menuId].is_print || roleDetail.is_print
        } else {
          permissions[menuId] = {
            is_read: roleDetail.is_read,
            is_create: roleDetail.is_create,
            is_update: roleDetail.is_update,
            is_delete: roleDetail.is_delete,
            is_print: roleDetail.is_print
          }
        }
      })
    })

    const selectRespoData = {
      respoId: targetDetail.id,
      respoName: targetDetail.m_respo.nama,
      isPrimary: targetDetail.is_primary,
      companyId: targetDetail.m_respo.unit_bisnis?.id || null,
      companyName: targetDetail.m_respo.unit_bisnis?.nama_comp || null,
      unitBisnisName: targetDetail.m_respo.unit_bisnis?.nama_comp || null,
      companyLegalId: targetDetail.m_respo.unit_bisnis?.m_company?.id || null,
      companyLegalName: targetDetail.m_respo.unit_bisnis?.m_company?.nama || null,
      companyLogo: targetDetail.m_respo.unit_bisnis?.m_company?.logo_img || null,
      gudangId: targetDetail.m_respo.m_gudang_id || null,
      menus: Array.from(menuMap.values()),
      permissions
    }

    console.log('[initializeSelectRespo] gudangId:', targetDetail.m_respo.m_gudang_id, '| respo keys:', Object.keys(targetDetail.m_respo))
    localStorage.setItem('SelectRespo', JSON.stringify(selectRespoData))
  }

  // Actions
  const login = (authToken: string, userData: User) => {
    token.value = authToken
    user.value = userData
    
    // Save to localStorage - simpan complete data
    const authData = {
      token: authToken,
      user: userData
    }
    localStorage.setItem('auth_bb', JSON.stringify(authData))
    
    // Initialize SelectRespo immediately after login
    initializeSelectRespo()
  }

  const logout = () => {
    user.value = null
    token.value = null
    
    // Clear localStorage - clear ALL auth-related data
    localStorage.removeItem('auth_bb')
    localStorage.removeItem('approval_list')
    localStorage.removeItem('SelectRespo')  // CRITICAL: Remove cached respo and permissions
    
 
  }

  const logoutWithServer = async (options?: { reason?: string; skipServer?: boolean }) => {
    const currentToken = token.value || undefined
    const shouldSkipServer = options?.skipServer === true

    try {
      if (!shouldSkipServer && currentToken) {
        await logoutApi(currentToken)
      }
    } catch (error) {
      console.warn(`[AUTH] Logout API failed (${options?.reason || 'unknown'}):`, error)
    } finally {
      logout()
    }
  }

  const handleTokenExpired = () => {
    logout()
    emitTokenExpired()
  }

  const checkAuth = () => {
    const savedAuth = localStorage.getItem('auth_bb')

    if (savedAuth) {
      try {
        const authData = JSON.parse(savedAuth)
        token.value = authData.token
        user.value = authData.user
        
        // Check if SelectRespo exists, if not initialize it
        const savedSelectRespo = localStorage.getItem('SelectRespo')
        if (!savedSelectRespo && user.value) {
          initializeSelectRespo()
        }
        
        // Refresh user data in background (async, non-blocking)
        // This will update localStorage with latest data from API
        setTimeout(() => {
          refreshUserData().catch(err => {
            console.warn('Background user data refresh failed:', err)
          })
        }, 100) // Small delay to let UI render first
        
        return true
      } catch (e) {
        // Invalid JSON, clear it

        localStorage.removeItem('auth_bb')
      }
    }
    return false
  }

  const saveApprovalList = (approvalList: ApprovalData[]) => {
    localStorage.setItem('approval_list', JSON.stringify(approvalList))
  }

  const getApprovalList = (): ApprovalData[] => {
    const saved = localStorage.getItem('approval_list')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        return []
      }
    }
    return []
  }

  /**
   * Refresh user data from API - updates localStorage without logout
   * Useful when user's company, permissions, or other data changes
   */
  const refreshUserData = async (): Promise<boolean> => {
    if (!user.value?.id || !token.value) {
      console.warn('Cannot refresh user data: no user or token')
      return false
    }

    try {
      // Step 1: Fetch updated user data from API
      const userResponse = await apiCall<{ status: string; data: User }>(
        `/dynamic/user_default/${user.value.id}?include=user_detail%3Em_respo%3Em_unit_bisnis%2Cuser_detail%3Em_respo%3Em_unit_bisnis%3Em_company%2Cuser_detail%3Em_respo%3Em_respo_d%3Em_role%3Em_role_d%3Em_menu%2Cm_general%2Cm_approval_d%3Em_general%2Cm_approval_d%3Em_approval%3Em_menu&no_pagination=true`,
        {},
        token.value
      )

      if (userResponse.status !== 'success' || !userResponse.data) {
        console.error('Failed to refresh user data: Invalid response')
        return false
      }

      // Step 2: Update user state
      user.value = userResponse.data

      // Step 3: Save updated auth data to localStorage
      const authData = {
        token: token.value,
        user: userResponse.data
      }
      localStorage.setItem('auth_bb', JSON.stringify(authData))

      // Step 4: Re-initialize SelectRespo with new data
      initializeSelectRespo()

      // Step 5: Fetch and update approval data
      try {
        const approvalResponse = await fetch(
          `${API_BASE_URL}/fn/m_approval/getUserApprovalData?id=${user.value.id}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token.value}`
            }
          }
        )

        const approvalData = await approvalResponse.json()

        if (approvalData.status === 'success' && approvalData.menu && approvalData.menu.length > 0) {
          // Transform approval data to ApprovalData format
          const transformedList = approvalData.menu.flatMap((menuItem: any) => {
            return (menuItem.syarat || []).map((syarat: any) => {
              const pathParts = menuItem.menu_path?.split('/').filter((p: string) => p) || []
              const modul = pathParts[0]?.toUpperCase() || null
              const subModul = pathParts[1]?.toUpperCase() || null

              return {
                id: menuItem.approval_id || null,
                level: syarat.level,
                // min_val/max_val now come from header (menuItem), fallback to syarat for backward compat
                min_val: (menuItem.min_val ?? syarat.min_val) ?? null,
                max_val: (menuItem.max_val ?? syarat.max_val) ?? null,
                // max_disc: syarat.max_disc || null,           // moved to header
                // max_disc_value: syarat.max_disc_value || null, // reserved
                is_full: syarat.is_full || false,
                is_use_limit: menuItem.is_use_limit ?? false,
                // top: null,                                     // not used
                tipe_approve: syarat.jenis_approval || null,
                nama_approval: menuItem.approval_name || null,
                nama_menu: menuItem.menu_name || null,
                modul: modul,
                sub_modul: subModul,
                path: menuItem.menu_path || null,
                sender_id: syarat.user_default_id || approvalData.user?.id || null,
                sender_name: approvalData.user?.name || null
              }
            })
          })

          saveApprovalList(transformedList)
        } else {
          saveApprovalList([])
        }
      } catch (approvalErr) {
        console.warn('Failed to refresh approval data:', approvalErr)
        // Don't fail the whole refresh if approval fails
      }

      // console.log('✅ User data refreshed successfully')
      return true
    } catch (error) {
      console.error('Failed to refresh user data:', error)
      return false
    }
  }

  return {
    user,
    token,
    isAuthenticated,
    currentUser,
    tipeUser,
    isSuperAdmin,
    userDetails,
    respos,
    hasPermission,
    hasAccess,
    getMenuPermissions,
    initializeSelectRespo,
    login,
    logout,
    logoutWithServer,
    handleTokenExpired,
    checkAuth,
    saveApprovalList,
    getApprovalList,
    refreshUserData
  }
})
