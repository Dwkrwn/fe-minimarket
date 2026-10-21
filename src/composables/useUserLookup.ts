import { apiCall } from '@/lib/api'

let cache: Map<string, string> | null = null
let pending: Promise<Map<string, string>> | null = null

const loadUserMap = async (): Promise<Map<string, string>> => {
  if (cache) return cache
  if (pending) return pending

  pending = (async () => {
    const map = new Map<string, string>()
    try {
      const res = await apiCall<{ status: string; data: any[] }>(
        '/dynamic/user_default?no_pagination=true',
        { method: 'GET' },
      )
      if (res.status === 'success' && Array.isArray(res.data)) {
        res.data.forEach((u: any) => {
          if (!u?.id) return
          const name = u.name || u.username || u.nama_kary || u.m_kary?.nama_kary
          map.set(String(u.id), name ? String(name) : String(u.id))
        })
      }
    } catch {
      // Abaikan error; fallback ke id mentah saat resolve
    }
    cache = map
    return map
  })()

  return pending
}

export function useUserLookup() {
  const resolveUserName = async (id?: string | null): Promise<string> => {
    if (!id) return '-'
    const map = await loadUserMap()
    return map.get(String(id)) || String(id)
  }

  const clearUserCache = () => {
    cache = null
    pending = null
  }

  return { resolveUserName, clearUserCache }
}
