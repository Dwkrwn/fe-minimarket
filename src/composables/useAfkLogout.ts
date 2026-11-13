import { computed, ref } from 'vue'

type LogoutReason = 'afk' | 'manual' | 'cross-tab'
type AfkEventType = 'activity' | 'warning' | 'logout'
type LogoutHandler = (reason: LogoutReason) => void | Promise<void>

interface AfkEventPayload {
  type: AfkEventType
  at: number
  sourceTabId: string
}

const STORAGE_KEY = 'auth_afk_event'
const DEFAULT_IDLE_TIMEOUT_MS = 3_600_000
const WARNING_MS = 30_000
const ACTIVITY_THROTTLE_MS = 1_000
// Cross-tab activity broadcasts write to localStorage (synchronous). Doing that
// on every mousemove throttle tick is expensive, so broadcast much less often.
const ACTIVITY_BROADCAST_THROTTLE_MS = 15_000
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
]

const tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
const idleTimeoutMs = Number(import.meta.env.VITE_AFK_TIMEOUT_MS) || DEFAULT_IDLE_TIMEOUT_MS
const warningEnabled = idleTimeoutMs > WARNING_MS
const warningStartMs = warningEnabled ? idleTimeoutMs - WARNING_MS : idleTimeoutMs

const isRunning = ref(false)
const isWarningVisible = ref(false)
const warningCountdownSeconds = ref(0)

let logoutHandler: LogoutHandler | null = null
let lastActivityAt = Date.now()
let lastActivityBroadcastAt = 0
let lastBroadcastAt = 0
let warningTimer: ReturnType<typeof setTimeout> | null = null
let logoutTimer: ReturnType<typeof setTimeout> | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null
let warningDeadlineAt = 0
let forcingLogout = false

const clearTimers = () => {
  if (warningTimer) clearTimeout(warningTimer)
  if (logoutTimer) clearTimeout(logoutTimer)
  if (countdownTimer) clearInterval(countdownTimer)
  warningTimer = null
  logoutTimer = null
  countdownTimer = null
}

const emitAfkEvent = (type: AfkEventType) => {
  try {
    const payload: AfkEventPayload = {
      type,
      at: Date.now(),
      sourceTabId: tabId,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (error) {
    console.warn('[AFK] Failed to broadcast AFK event:', error)
  }
}

const hideWarning = () => {
  isWarningVisible.value = false
  warningCountdownSeconds.value = 0
  warningDeadlineAt = 0
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

const startWarningCountdown = (remainingMs: number, shouldBroadcast: boolean) => {
  if (!warningEnabled) return

  isWarningVisible.value = true
  warningDeadlineAt = Date.now() + Math.max(0, remainingMs)
  warningCountdownSeconds.value = Math.max(0, Math.ceil(remainingMs / 1000))

  if (shouldBroadcast) {
    emitAfkEvent('warning')
  }

  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    const nextSeconds = Math.max(0, Math.ceil((warningDeadlineAt - Date.now()) / 1000))
    warningCountdownSeconds.value = nextSeconds
    if (nextSeconds <= 0 && countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 250)
}

const scheduleTimersFromNow = (elapsedMs: number = 0) => {
  clearTimers()
  hideWarning()

  const remainingUntilLogout = idleTimeoutMs - elapsedMs

  if (remainingUntilLogout <= 0) {
    void triggerForcedLogout('afk')
    return
  }

  if (warningEnabled) {
    const remainingUntilWarning = warningStartMs - elapsedMs
    if (remainingUntilWarning <= 0) {
      startWarningCountdown(remainingUntilLogout, false)
    } else {
      warningTimer = setTimeout(() => {
        startWarningCountdown(WARNING_MS, true)
      }, remainingUntilWarning)
    }
  }

  logoutTimer = setTimeout(() => {
    void triggerForcedLogout('afk')
  }, remainingUntilLogout)
}

const onUserActivity = () => {
  if (!isRunning.value || forcingLogout) return

  const now = Date.now()
  if (now - lastActivityBroadcastAt < ACTIVITY_THROTTLE_MS) return
  lastActivityBroadcastAt = now

  const shouldBroadcast = now - lastBroadcastAt >= ACTIVITY_BROADCAST_THROTTLE_MS
  if (shouldBroadcast) lastBroadcastAt = now

  resetAfkTimer({ broadcast: shouldBroadcast })
}

const handleStorageSync = (event: StorageEvent) => {
  if (event.key !== STORAGE_KEY || !event.newValue || !isRunning.value) return

  try {
    const payload = JSON.parse(event.newValue) as AfkEventPayload
    if (payload.sourceTabId === tabId) return

    if (payload.type === 'activity') {
      lastActivityAt = payload.at
      scheduleTimersFromNow(0)
      return
    }

    if (payload.type === 'warning' && warningEnabled) {
      startWarningCountdown(WARNING_MS, false)
      return
    }

    if (payload.type === 'logout') {
      void triggerForcedLogout('cross-tab', { broadcast: false })
    }
  } catch (error) {
    console.warn('[AFK] Failed to parse cross-tab event:', error)
  }
}

const handleVisibilityChange = () => {
  if (!isRunning.value || document.visibilityState !== 'visible') return

  const elapsed = Date.now() - lastActivityAt
  if (elapsed >= idleTimeoutMs) {
    void triggerForcedLogout('afk')
    return
  }

  scheduleTimersFromNow(elapsed)
}

const addListeners = () => {
  ACTIVITY_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, onUserActivity, { passive: true })
  })
  window.addEventListener('storage', handleStorageSync)
  document.addEventListener('visibilitychange', handleVisibilityChange)
}

const removeListeners = () => {
  ACTIVITY_EVENTS.forEach((eventName) => {
    window.removeEventListener(eventName, onUserActivity)
  })
  window.removeEventListener('storage', handleStorageSync)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
}

const setLogoutHandler = (handler: LogoutHandler | null) => {
  logoutHandler = handler
}

const startAfkWatcher = () => {
  if (isRunning.value) return

  isRunning.value = true
  forcingLogout = false
  lastActivityAt = Date.now()
  lastActivityBroadcastAt = 0
  lastBroadcastAt = 0
  addListeners()
  scheduleTimersFromNow(0)
}

const stopAfkWatcher = () => {
  if (!isRunning.value) return

  isRunning.value = false
  clearTimers()
  hideWarning()
  removeListeners()
}

const resetAfkTimer = (options?: { broadcast?: boolean }) => {
  if (!isRunning.value || forcingLogout) return

  lastActivityAt = Date.now()
  scheduleTimersFromNow(0)

  if (options?.broadcast !== false) {
    emitAfkEvent('activity')
  }
}

const triggerForcedLogout = async (
  reason: LogoutReason,
  options?: { broadcast?: boolean }
) => {
  if (forcingLogout) return

  forcingLogout = true
  clearTimers()
  hideWarning()

  if (options?.broadcast !== false) {
    emitAfkEvent('logout')
  }

  try {
    if (logoutHandler) {
      await logoutHandler(reason)
    }
  } catch (error) {
    console.warn('[AFK] Logout handler failed:', error)
  } finally {
    stopAfkWatcher()
    forcingLogout = false
  }
}

export const useAfkLogout = () => {
  const timeoutSeconds = computed(() => Math.floor(idleTimeoutMs / 1000))

  return {
    isRunning,
    isWarningVisible,
    warningCountdownSeconds,
    timeoutSeconds,
    startAfkWatcher,
    stopAfkWatcher,
    resetAfkTimer,
    triggerForcedLogout,
    setLogoutHandler,
  }
}
