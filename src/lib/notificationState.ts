/**
 * Sumber tunggal untuk status baca notifikasi dokumen dan dismissal alert stok.
 *
 * - Status baca dokumen: sumber kebenaran tetap API/DB (`notif.status`).
 *   localStorage hanya cache sementara dan dibersihkan setelah aksi API sukses.
 * - Alert stok: dinamis, tidak punya status baca permanen. Dismissal hanya
 *   cache localStorage dengan TTL, lalu dibersihkan saat alert hilang.
 *
 * Setiap penulisan localStorage memancarkan `notificationRead` tepat sekali.
 */

export const READ_NOTIFICATIONS_STORAGE_KEY = 'bb_read_notifications'
export const DISMISSED_STOCK_ALERTS_STORAGE_KEY = 'bb_dismissed_stock_alerts'
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000

type DismissedMap = Record<string, string>

export interface NotificationLike {
  id?: string | number
  status?: unknown
  notification_category?: string
  info_type?: string
  notification_type?: string
}

const asId = (value: unknown) => String(value ?? '')

const dispatchNotificationRead = () => {
  window.dispatchEvent(new CustomEvent('notificationRead'))
}

/** Dipakai setelah approve/reject/revise agar badge dan daftar ikut segar. */
export const dispatchNotificationsUpdated = () => {
  window.dispatchEvent(new Event('notificationsUpdated'))
}

export const canMarkNotificationAsRead = (notif: NotificationLike | null | undefined) =>
  !!notif &&
  notif.notification_type !== 'stock' &&
  notif.notification_category !== 'outstanding' &&
  notif.info_type !== 'stock_opname_lock'

export const isNotificationRead = (
  notif: NotificationLike | null | undefined,
  readIds: Set<string>,
) =>
  !canMarkNotificationAsRead(notif) ||
  !!notif?.status ||
  readIds.has(asId(notif?.id))

export function loadReadNotificationIds(): Set<string> {
  try {
    const stored = localStorage.getItem(READ_NOTIFICATIONS_STORAGE_KEY)
    return new Set<string>(stored ? (JSON.parse(stored) as string[]).map(asId) : [])
  } catch {
    return new Set<string>()
  }
}

function loadDismissedMap(): DismissedMap {
  try {
    const stored = localStorage.getItem(DISMISSED_STOCK_ALERTS_STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as DismissedMap)
      : {}
  } catch {
    return {}
  }
}

function writeDismissedMap(map: DismissedMap) {
  localStorage.setItem(DISMISSED_STOCK_ALERTS_STORAGE_KEY, JSON.stringify(map))
}

/** TTL + pruning terhadap id yang sudah tidak aktif. Tidak memancarkan event. */
export function loadDismissedStockAlertIds(activeIds?: Set<string>): Set<string> {
  const map = loadDismissedMap()
  const now = Date.now()
  let changed = false

  for (const [id, dismissedAt] of Object.entries(map)) {
    const age = now - new Date(dismissedAt).getTime()
    const expired = !Number.isFinite(age) || age >= DISMISS_TTL_MS
    if (expired || (activeIds && !activeIds.has(id))) {
      delete map[id]
      changed = true
    }
  }

  if (changed) writeDismissedMap(map)
  return new Set(Object.keys(map))
}

function writeReadIds(readIds: Set<string>) {
  localStorage.setItem(
    READ_NOTIFICATIONS_STORAGE_KEY,
    JSON.stringify([...readIds].map(asId)),
  )
}

function writeDismissedIds(dismissedIds: Set<string>) {
  const previous = loadDismissedMap()
  const next: DismissedMap = {}
  const now = new Date().toISOString()

  for (const id of dismissedIds) {
    const key = asId(id)
    if (key) next[key] = previous[key] || now
  }

  writeDismissedMap(next)
}

/**
 * Tulis satu atau dua cache sekaligus, lalu pancarkan `notificationRead` sekali.
 */
export function saveNotificationLocalState(options: {
  readIds?: Set<string>
  dismissedIds?: Set<string>
}) {
  if (options.readIds) writeReadIds(options.readIds)
  if (options.dismissedIds) writeDismissedIds(options.dismissedIds)
  dispatchNotificationRead()
}

export const saveReadNotificationIds = (readIds: Set<string>) =>
  saveNotificationLocalState({ readIds })

export const saveDismissedStockAlertIds = (dismissedIds: Set<string>) =>
  saveNotificationLocalState({ dismissedIds })

/** Dipanggil setelah approve/reject/revise sukses. */
export function clearReadNotificationId(id: unknown) {
  const readIds = loadReadNotificationIds()
  if (!readIds.delete(asId(id))) return
  saveReadNotificationIds(readIds)
}

/** Bersihkan cache baca + minta badge/daftar refresh setelah aksi sukses. */
export function finalizeNotificationAction(id: unknown) {
  clearReadNotificationId(id)
  dispatchNotificationsUpdated()
}

function dedupeRows(rows: any[]) {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = asId(
      row?.id ||
        row?.t_purchase_request_id ||
        row?.t_purchase_order_id ||
        row?.t_purchase_invoice_id ||
        row?.t_purchase_return_id ||
        row?.t_penerimaan_gudang_id ||
        row?.t_stock_opname_id ||
        row?.ref_id ||
        row?.item_id ||
        `${row?.notification_type}_${row?.nama_item}`,
    )
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Hitungan yang dipakai bersama oleh badge sidebar dan halaman notifikasi.
 */
export function countUnreadNotifications(
  rows: any[],
  readIds: Set<string>,
  dismissedIds: Set<string>,
) {
  const unique = dedupeRows(rows || [])
  const documentUnread = unique.filter(
    (row) =>
      row?.notification_type !== 'stock' &&
      canMarkNotificationAsRead(row) &&
      !isNotificationRead(row, readIds),
  ).length
  const stockUnread = unique.filter(
    (row) =>
      row?.notification_type === 'stock' && !dismissedIds.has(asId(row?.id)),
  ).length

  return documentUnread + stockUnread
}
