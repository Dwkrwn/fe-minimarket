import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getUnifiedNotifications } from '@/views/notifikasi/service'

/**
 * Single owner for the notification badge.
 *
 * Before this composable, both Layout.vue and AppSidebar.vue listened to
 * route changes and each fetched the same notifications with forceRefresh,
 * producing two identical requests on every navigation. The state and the
 * fetch loop now live here (module scope = one instance per page load) and
 * consumers only read `notificationCount`.
 */

const NOTIFICATION_STORAGE_KEY = 'bb_read_notifications'
const POLL_INTERVAL_MS = 5 * 60_000

const notificationCount = ref(0)
const readNotificationIds = ref<Set<string>>(new Set())

let started = false
let pollTimer: ReturnType<typeof setInterval> | null = null
let inFlight = false

const loadReadNotifications = () => {
  try {
    const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY)
    readNotificationIds.value = stored ? new Set(JSON.parse(stored) as string[]) : new Set()
  } catch {
    readNotificationIds.value = new Set()
  }
}

const fetchNotificationCounts = async (forceRefresh = false) => {
  const authStore = useAuthStore()
  if (!authStore.user?.capabilities?.notifications) {
    notificationCount.value = 0
    return
  }
  // Dedupe concurrent callers (mount, event, interval).
  if (inFlight) return
  inFlight = true

  try {
    loadReadNotifications()

    // Do NOT forceRefresh here: the 10s cache in getUnifiedNotifications is
    // enough to collapse mount/route/event bursts into one request.
    const unifiedResponse = await getUnifiedNotifications(1, 100, forceRefresh)
    const approvalRows = unifiedResponse.data?.approval || []
    const revisiRows = unifiedResponse.data?.revisi || []

    const validIds = new Set<string>((unifiedResponse.active_ids || []).map((id) => String(id)))
    const cleanedIds = [...readNotificationIds.value].filter((id) => validIds.has(id))
    if (cleanedIds.length !== readNotificationIds.value.size) {
      readNotificationIds.value = new Set(cleanedIds)
      localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(cleanedIds))
    }

    const approvalUnread = approvalRows.filter(
      (n: any) => !n.status && !readNotificationIds.value.has(String(n.id)),
    ).length
    const revisiUnread = revisiRows.filter(
      (n: any) => !n.status && !readNotificationIds.value.has(String(n.id)),
    ).length

    notificationCount.value = approvalUnread + revisiUnread
  } catch {
    notificationCount.value = 0
  } finally {
    inFlight = false
  }
}

const handleNotificationRead = () => {
  loadReadNotifications()
  void fetchNotificationCounts()
}

const handleNotificationsUpdated = () => {
  void fetchNotificationCounts(true)
}

const handleStorageChange = (e: StorageEvent) => {
  if (e.key === NOTIFICATION_STORAGE_KEY) {
    loadReadNotifications()
    void fetchNotificationCounts()
  }
}

export function useNotificationBadge() {
  /** Start the single polling loop + listeners. Safe to call multiple times. */
  const start = () => {
    if (started) return
    started = true
    window.addEventListener('notificationRead', handleNotificationRead)
    window.addEventListener('notificationsUpdated', handleNotificationsUpdated)
    window.addEventListener('storage', handleStorageChange)
    void fetchNotificationCounts(true)
    pollTimer = setInterval(() => {
      // Skip polling while the tab is hidden.
      if (document.visibilityState === 'visible') void fetchNotificationCounts()
    }, POLL_INTERVAL_MS)
  }

  const stop = () => {
    if (!started) return
    started = false
    window.removeEventListener('notificationRead', handleNotificationRead)
    window.removeEventListener('notificationsUpdated', handleNotificationsUpdated)
    window.removeEventListener('storage', handleStorageChange)
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
    notificationCount.value = 0
  }

  return {
    notificationCount,
    start,
    stop,
    refresh: (forceRefresh = true) => fetchNotificationCounts(forceRefresh),
  }
}
