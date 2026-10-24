export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

export function assetTypesError(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 400) return null
  return error.message.startsWith('Unknown asset types:') || /^Invalid fields:.*\btipos\b/.test(error.message)
    ? error.message : null
}
