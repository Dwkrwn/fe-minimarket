import type { SessionUser } from '@/stores/auth'

export function canVisit(user: SessionUser, path: string, name: string, editing: boolean, requiresSuperAdmin = false): boolean {
  const superAdmin = user.role.system_key === 'SUPER_ADMIN'
  const manager = superAdmin || user.role.system_key === 'ADMIN'
  if (requiresSuperAdmin && !superAdmin) return false
  if (name === 'Dashboard') return true
  if (['/setup/user_default', '/setup/m_role'].some(base => path === base || path.startsWith(base + '/')) && !manager) return false
  if (superAdmin) return true
  const menu = [...user.menus].sort((a, b) => b.path.length - a.path.length)
    .find(menu => path === menu.path || path.startsWith(menu.path + '/'))
  if (!menu) return false
  const action = /\/form(?:\/|$)/.test(path) ? (editing ? 'is_update' : 'is_create') : 'is_read'
  return !!user.permissions[menu.id]?.is_read && !!user.permissions[menu.id]?.[action]
}
