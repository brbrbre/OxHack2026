import { describe, expect, it } from 'vitest'
import { ApiError, assetTypesError } from './errors'

describe('plan field errors', () => {
  it.each(['Unknown asset types: Bonds', 'Invalid fields: tipos', 'Invalid fields: monto, tipos'])(
    'preserves the asset-type message for the inline field: %s', (message) => {
      expect(assetTypesError(new ApiError(message, 400))).toBe(message)
    },
  )

  it.each([
    new ApiError('Invalid fields: monto', 400),
    new ApiError('Unknown asset types: Bonds', 500),
    new ApiError('Service unavailable.', 503),
    new Error('Unknown asset types: Bonds'),
    null,
  ])('leaves other failures in the general error state', (error) => {
    expect(assetTypesError(error)).toBeNull()
  })
})
