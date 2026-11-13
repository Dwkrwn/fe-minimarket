import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiCall, logoutApi, ApiRequestError, TokenExpiredError } from '@/lib/api'

export interface Permission { is_read: boolean; is_create: boolean; is_update: boolean; is_delete: boolean; is_print: boolean }
export interface SessionMenu { id: string; name: string; path: string; icon: string | null; seq: string; modul: string | null; sub_modul: string | null }
export interface SessionUser {
 capabilities?: { dashboard?: boolean; notifications?: boolean; chatbot?: boolean };
 id: string; name: string; username: string; is_active: boolean;
 tipe?: { value1: string }; user_details?: any[]; m_kary_id?: string | null;
 role: { id: string; nama_role: string; system_key: string | null; is_active: boolean };
 menus: SessionMenu[]; permissions: Record<string, Permission>;
}
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


const callbacks: (() => void)[] = []
export const onTokenExpired = (callback: () => void) => callbacks.push(callback)

// Timestamp of the last successful background profile refresh. Kept outside the
// store state so it survives component unmounts but is shared per page load.
let lastRefreshAt = 0
const DEFAULT_REFRESH_TTL_MS = 5 * 60_000
export const useAuthStore = defineStore('auth', () => {
 const user = ref<SessionUser | null>(null)
 const token = ref<string | null>(null)
 const isAuthenticated = computed(() => !!token.value && !!user.value)
 const currentUser = computed(() => user.value)
 const isSuperAdmin = computed(() => user.value?.role.system_key === 'SUPER_ADMIN')
 const isManager = computed(() => ['SUPER_ADMIN', 'ADMIN'].includes(user.value?.role.system_key || ''))
 const tipeUser = computed(() => ({ value1: isSuperAdmin.value ? 'SUPER ADMIN' : user.value?.role.nama_role || '' }))
 // Project the direct role into the data shape consumed by existing UI components.
 const userDetails = computed<any[]>(() => user.value ? [{
   id: user.value.role.id, m_respo_id: user.value.role.id, is_primary: true, is_active: true,
   m_respo: { id: user.value.role.id, nama: user.value.role.nama_role, is_active: true,
     m_respo_ds: [{ is_active: true, m_role_id: user.value.role.id, m_role: { ...user.value.role,
       m_role_ds: user.value.menus.map(menu => ({m_menu_id:menu.id,m_menu:menu,...user.value?.permissions[menu.id]}))
     }}] }
 }] : [])
 const respos = computed<any[]>(() => userDetails.value.map(detail => detail.m_respo))
 const initializeSelectRespo = () => {
   // Compatibility cache for existing action directives; role is the source of permissions.
   localStorage.setItem('SelectRespo', JSON.stringify({ respoId: user.value?.role.id, respoName: user.value?.role.nama_role, menus: user.value?.menus || [], permissions: user.value?.permissions || {} }))
   window.dispatchEvent(new CustomEvent('respoChanged', { detail: user.value?.role.id ?? null }))
 }
 const login = (authToken: string, data: SessionUser) => {
   token.value = authToken; user.value = { ...data, tipe: { value1: data.role.system_key === 'SUPER_ADMIN' ? 'SUPER ADMIN' : data.role.nama_role } }
   localStorage.setItem('auth_bb', JSON.stringify({ token: authToken, user: data }))
   // NOTE: initializeSelectRespo() is intentionally NOT called here. It writes
   // localStorage and dispatches a window event, which is too costly to run on
   // every background refresh/navigation. Real logins call it explicitly.
 }
 const logout = () => {
   user.value = null; token.value = null; lastRefreshAt = 0
   for (const key of ['auth_bb', 'SelectRespo', 'approval_list']) localStorage.removeItem(key)
   window.dispatchEvent(new Event('respoChanged'))
 }
 const handleTokenExpired = () => { logout(); callbacks.forEach(fn => fn()) }
 const logoutWithServer = async (options?: { reason?: string; skipServer?: boolean }) => {
   try { if (token.value && !options?.skipServer) await logoutApi(token.value) } finally { logout() }
 }
 const checkAuth = () => {
   try {
     const saved = JSON.parse(localStorage.getItem('auth_bb') || 'null')
     if (saved?.token && saved?.user?.role) { token.value = saved.token; user.value = saved.user; return true }
   } catch { /* Invalid or obsolete cached session. */ }
   logout(); return false
 }
 const refreshUserData = async () => {
   const currentToken = token.value
   if (!currentToken) return false
   try {
     const result = await apiCall<{ data: SessionUser }>('/auth/me', {}, currentToken)
     if (token.value !== currentToken) return false
     login(currentToken, result.data); return true
   } catch (error) {
     if (token.value === currentToken && (error instanceof TokenExpiredError || (error instanceof ApiRequestError && error.statusCode === 401))) logout()
     throw error
   }
 }
 const refreshUserDataIfStale = async (ttl = DEFAULT_REFRESH_TTL_MS) => {
   if (!token.value) return false
   if (Date.now() - lastRefreshAt < ttl) return false
   lastRefreshAt = Date.now()
   try {
     const refreshed = await refreshUserData()
     // Keep the SelectRespo compatibility cache in sync without doing it on
     // every navigation (only on the throttled background refresh).
     if (refreshed) initializeSelectRespo()
     return refreshed
   } catch {
     // 401 is already handled by the api layer; ignore transient network errors.
     return false
   }
 }
 const hasPermission = (menuId: string, action: 'read' | 'create' | 'update' | 'delete' | 'print', _respoId?: string) =>
   isSuperAdmin.value || !!user.value?.permissions[menuId]?.[('is_' + action) as keyof Permission]
 const hasAccess = (menuId: string) => hasPermission(menuId, 'read')
 const getMenuPermissions = () => (user.value?.menus || []).map(menu => ({ m_menu_id: menu.id, m_menu: menu, ...user.value?.permissions[menu.id] }))
 const saveApprovalList = (list: ApprovalData[]) => localStorage.setItem('approval_list', JSON.stringify(list))
 const getApprovalList = (): ApprovalData[] => []
 return { user, token, currentUser, isAuthenticated, isSuperAdmin, isManager, tipeUser, userDetails, respos, login, logout, logoutWithServer, handleTokenExpired, checkAuth, refreshUserData, refreshUserDataIfStale, initializeSelectRespo, hasPermission, hasAccess, getMenuPermissions, saveApprovalList, getApprovalList }
})
