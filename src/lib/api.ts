const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

// Export API_BASE_URL for use in components
export { API_BASE_URL }

const sanitizeLegacySearchfield = (urlOrEndpoint: string) => {
  try {
    const url = new URL(urlOrEndpoint, API_BASE_URL)
    const currentSearchfield = url.searchParams.get('searchfield')

    if (!currentSearchfield) {
      return url.pathname + url.search
    }

    const sanitized = currentSearchfield
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean)
      .filter((field) => field !== 'no_t_transform_item')
      .join(',')

    if (sanitized) {
      url.searchParams.set('searchfield', sanitized)
    } else {
      url.searchParams.delete('searchfield')
    }

    return url.pathname + url.search
  } catch {
    return urlOrEndpoint.replace(/(^|,)no_t_transform_item(?=,|$)/g, '').replace(/searchfield=,&?/g, '')
  }
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  status: string
  token: string
  data: { user: import('@/stores/auth').SessionUser }
}

export interface ApiError {
  status: string
  message?: string
}

export interface DeleteResponse {
  status: string
  message: string
}

export class ApiRequestError<T = unknown> extends Error {
  statusCode?: number
  response?: {
    data?: T
  }

  constructor(message: string, data?: T, statusCode?: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.statusCode = statusCode
    this.response = { data }
  }
}

// Custom error class untuk token expired
export class TokenExpiredError extends Error {
  constructor(message: string = 'Invalid token or token has expired') {
    super(message)
    this.name = 'TokenExpiredError'
  }
}

/**
 * Login API call
 * @param credentials - Username and password
 * @returns Promise with login response containing token and user data
 */
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Login gagal')
    }

    const data: LoginResponse = await response.json()
    return data
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Terjadi kesalahan saat login')
  }
}

// Global callback untuk token expired
let tokenExpiredCallback: (() => void) | null = null

export const setTokenExpiredCallback = (callback: () => void) => {
  tokenExpiredCallback = callback
}

export async function logoutApi(token?: string): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    headers,
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || data.error || 'Logout API request failed')
  }
}

/**
 * Make authenticated API call
 * @param endpoint - API endpoint path
 * @param options - Fetch options
 * @param token - Optional token to use instead of localStorage token
 * @returns Promise with response data
 */
export async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const sanitizedEndpoint = sanitizeLegacySearchfield(endpoint)
  let authToken = token

  // If no token provided, try to get from localStorage
  if (!authToken) {
    const authData = localStorage.getItem('auth_bb')
    if (authData) {
      try {
        const parsed = JSON.parse(authData)
        authToken = parsed.token
      } catch (e) {
        // Invalid JSON
      }
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
    ...(options.headers as Record<string, string>),
  }

  if (options.body instanceof FormData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (headers as any)['Content-Type']
  }

  let requestBody = options.body
  if (requestBody && !(requestBody instanceof FormData) && typeof requestBody !== 'string') {
    requestBody = JSON.stringify(requestBody)
  }

  const response = await fetch(`${API_BASE_URL}${sanitizedEndpoint}`, {
    ...options,
    headers,
    body: requestBody
  })

  const data = (await response.json().catch(() => ({}))) ?? {}
  const method = options.method?.toUpperCase()

  // Check untuk token expired atau invalid
  // Support berbagai format error message dari backend
  const isTokenExpired = response.status === 401

  if (isTokenExpired) {
    const error = new TokenExpiredError(data.message || 'Session expired')

    // Trigger callback jika ada
    if (tokenExpiredCallback) {
      tokenExpiredCallback()
    } else {
      console.warn('⚠️ tokenExpiredCallback is not set!')
    }

    throw error
  }

  if (!response.ok) {
    throw new ApiRequestError(
      data.message || data.error || 'API request failed',
      data,
      response.status,
    )
  }

  if (method === 'DELETE') {
    if (Object.keys(data).length === 0) {
      return { status: 'success', message: 'Data berhasil dihapus' } as T
    }

    if (data.success === true && !data.status) {
      return { ...data, status: 'success' } as T
    }
  }

  return data
}

const isDeleteSuccess = (response: Partial<DeleteResponse> & { success?: boolean }) => {
  return response.status?.toLowerCase() === 'success' || response.success === true
}

const getRequestErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  return 'Terjadi kesalahan saat menghapus'
}

export async function bulkDeleteWithFallback(
  endpoint: string,
  ids: string[],
  deleteOne: (id: string) => Promise<DeleteResponse>,
): Promise<DeleteResponse> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))

  if (uniqueIds.length === 0) {
    return { status: 'success', message: 'Tidak ada data untuk dihapus' }
  }

  if (uniqueIds.length === 1) {
    return deleteOne(uniqueIds[0]!)
  }

  let bulkErrorMessage = ''

  try {
    const response = await apiCall<DeleteResponse & { success?: boolean }>(endpoint, {
      method: 'DELETE',
      body: JSON.stringify({ ids: uniqueIds }),
    })

    if (isDeleteSuccess(response)) {
      return {
        status: 'success',
        message: response.message || `${uniqueIds.length} item berhasil dihapus`,
      }
    }

    bulkErrorMessage = response.message || 'Bulk delete gagal'
  } catch (error) {
    bulkErrorMessage = getRequestErrorMessage(error)
  }

  const results = await Promise.allSettled(uniqueIds.map((id) => deleteOne(id)))
  const failedCount = results.filter((result) => {
    if (result.status === 'rejected') return true
    return !isDeleteSuccess(result.value)
  }).length

  if (failedCount === 0) {
    return {
      status: 'success',
      message: `${uniqueIds.length} item berhasil dihapus`,
    }
  }

  const message = `${failedCount} dari ${uniqueIds.length} item gagal dihapus`

  return {
    status: 'error',
    message: bulkErrorMessage ? `${message}. ${bulkErrorMessage}` : message,
  }
}

/**
 * Get the full session user (role, menus, permissions, capabilities) for a token.
 * @param token - Auth token
 * @returns Promise with the current user's complete session data
 */
export async function getCurrentUser(token: string): Promise<import('@/stores/auth').SessionUser> {
  const result = await apiCall<{ status?: string; data: import('@/stores/auth').SessionUser }>(
    '/auth/me',
    {},
    token
  )
  return result.data
}
