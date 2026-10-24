import { ApiError } from './errors'

const TIMEOUT_MS = 15_000

export async function fetchJson(
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<unknown> {
  const controller = new AbortController()
  let timedOut = false
  const cancel = () => controller.abort()
  if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError')
  signal?.addEventListener('abort', cancel, { once: true })
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, TIMEOUT_MS)

  try {
    const response = await fetch(path, { ...init, signal: controller.signal })
    const body: unknown = await response.json().catch(() => {
      if (response.status >= 500) {
        throw new ApiError('The service is temporarily unavailable. Please try again shortly.', response.status)
      }
      throw new ApiError('The service returned an unreadable response. Please try again.', response.status)
    })
    if (!response.ok) {
      const message = typeof body === 'object' && body !== null &&
        'error' in body && typeof body.error === 'string'
        ? body.error
        : 'We could not complete this request. Please try again.'
      throw new ApiError(message, response.status)
    }
    return body
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError')
    if (timedOut) throw new ApiError('This is taking longer than expected. Please try again.')
    if (error instanceof ApiError) throw error
    throw new ApiError('We could not reach the service. Please try again in a moment.')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
  }
}
