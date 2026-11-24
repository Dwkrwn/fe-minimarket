import { ref } from 'vue'
import { getStockAlerts } from '@/views/notifikasi/stock/service.stock'
import {
  DISMISSED_STOCK_ALERTS_STORAGE_KEY,
  loadDismissedStockAlertIds,
} from '@/lib/notificationState'

/**
 * Badge notifikasi sekarang hanya menghitung alert stok.
 * Sumber datanya sama dengan halaman Notifikasi Stok (/v1/notifications/stock-alerts).
 */

const POLL_INTERVAL_MS = 5 * 60_000

const notificationCount = ref(0)
const dismissedStockAlertIds = ref<Set<string>>(new Set())

let started = false
let pollTimer: ReturnType<typeof setInterval> | null = null
let inFlight = false

const loadDismissedStockAlerts = (activeIds?: Set<string>) => {
  dismissedStockAlertIds.value = loadDismissedStockAlertIds(activeIds)
}

const fetchNotificationCounts = async (forceRefresh = false) => {
  if (inFlight) return
  inFlight = true

  try {
    const snapshot = await getStockAlerts(forceRefresh)
    const stockRows = snapshot.items || []

    loadDismissedStockAlerts(new Set(stockRows.map((row) => String(row.id))))

    notificationCount.value = stockRows.filter(
      (row) => !dismissedStockAlertIds.value.has(String(row.id)),
    ).length
  } catch {
    notificationCount.value = 0
  } finally {
    inFlight = false
  }
}

const handleNotificationRead = () => {
  void fetchNotificationCounts()
}

const handleNotificationsUpdated = () => {
  void fetchNotificationCounts(true)
}

const handleStorageChange = (e: StorageEvent) => {
  if (e.key === DISMISSED_STOCK_ALERTS_STORAGE_KEY) {
    loadDismissedStockAlerts()
    void fetchNotificationCounts()
  }
}

export function useNotificationBadge() {
  const start = () => {
    if (started) return
    started = true
    window.addEventListener('notificationRead', handleNotificationRead)
    window.addEventListener('notificationsUpdated', handleNotificationsUpdated)
    window.addEventListener('storage', handleStorageChange)
    void fetchNotificationCounts(true)
    pollTimer = setInterval(() => {
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
