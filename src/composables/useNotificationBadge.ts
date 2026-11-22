import { ref } from 'vue'
import { getNotificationSnapshot } from '@/views/notifikasi/service'
import {
  DISMISSED_STOCK_ALERTS_STORAGE_KEY,
  READ_NOTIFICATIONS_STORAGE_KEY,
  countUnreadNotifications,
  loadDismissedStockAlertIds,
  loadReadNotificationIds,
  saveNotificationLocalState,
} from '@/lib/notificationState'

/**
 * Single owner for the notification badge.
 *
 * Before this composable, both Layout.vue and AppSidebar.vue listened to
 * route changes and each fetched the same notifications with forceRefresh,
 * producing two identical requests on every navigation. The state and the
 * fetch loop now live here (module scope = one instance per page load) and
 * consumers only read `notificationCount`.
 */

const POLL_INTERVAL_MS = 5 * 60_000

const notificationCount = ref(0)
const readNotificationIds = ref<Set<string>>(new Set())
const dismissedStockAlertIds = ref<Set<string>>(new Set())

let started = false
let pollTimer: ReturnType<typeof setInterval> | null = null
let inFlight = false

const loadReadNotifications = () => {
  readNotificationIds.value = loadReadNotificationIds()
}

const loadDismissedStockAlerts = (activeIds?: Set<string>) => {
  dismissedStockAlertIds.value = loadDismissedStockAlertIds(activeIds)
}

const fetchNotificationCounts = async (forceRefresh = false) => {
  // Dedupe concurrent callers (mount, event, interval).
  if (inFlight) return
  inFlight = true

  try {
    loadReadNotifications()

    // Sama dengan sumber data halaman notifikasi. Cache 10 detik di service
    // menggabungkan mount/route/event burst menjadi satu request.
    const snapshot = await getNotificationSnapshot(1, 100, forceRefresh)
    const stockRows = snapshot.data?.stock || []
    loadDismissedStockAlerts(new Set(stockRows.map((row) => String(row.id))))

    const validReadIds = new Set<string>(
      (snapshot.active_ids || []).map((id) => String(id)),
    )
    const validStockIds = new Set<string>(stockRows.map((row) => String(row.id)))

    const cleanedReadIds = snapshot.active_ids?.length
      ? [...readNotificationIds.value].filter((id) => validReadIds.has(id))
      : [...readNotificationIds.value]
    const cleanedDismissedIds = [...dismissedStockAlertIds.value].filter((id) =>
      validStockIds.has(id),
    )

    const readChanged = cleanedReadIds.length !== readNotificationIds.value.size
    const dismissedChanged =
      cleanedDismissedIds.length !== dismissedStockAlertIds.value.size
    if (readChanged) readNotificationIds.value = new Set(cleanedReadIds)
    if (dismissedChanged)
      dismissedStockAlertIds.value = new Set(cleanedDismissedIds)
    if (readChanged || dismissedChanged) {
      saveNotificationLocalState({
        readIds: readChanged ? readNotificationIds.value : undefined,
        dismissedIds: dismissedChanged
          ? dismissedStockAlertIds.value
          : undefined,
      })
    }

    const allRows = [
      ...(snapshot.data?.approval || []),
      ...(snapshot.data?.revisi || []),
      ...(snapshot.data?.pending_approval || []),
      ...(snapshot.data?.outstanding || []),
      ...(snapshot.data?.info || []),
      ...stockRows,
    ]

    notificationCount.value = countUnreadNotifications(
      allRows,
      readNotificationIds.value,
      dismissedStockAlertIds.value,
    )
  } catch {
    notificationCount.value = 0
  } finally {
    inFlight = false
  }
}

const handleNotificationRead = () => {
  loadReadNotifications()
  loadDismissedStockAlerts()
  void fetchNotificationCounts()
}

const handleNotificationsUpdated = () => {
  void fetchNotificationCounts(true)
}

const handleStorageChange = (e: StorageEvent) => {
  if (
    e.key === READ_NOTIFICATIONS_STORAGE_KEY ||
    e.key === DISMISSED_STOCK_ALERTS_STORAGE_KEY
  ) {
    loadReadNotifications()
    loadDismissedStockAlerts()
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
