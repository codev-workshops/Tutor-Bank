/**
 * @jest-environment node
 */

import { NextResponse } from 'next/server'

let capturedMiddleware: Function
let capturedOptions: { callbacks: { authorized: Function } }

jest.mock('next-auth/middleware', () => ({
  withAuth: jest.fn((middleware: Function, options: any) => {
    capturedMiddleware = middleware
    capturedOptions = options
    return middleware
  }),
}))

describe('middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should call withAuth with middleware function and options', async () => {
    const { withAuth } = await import('next-auth/middleware')
    await import('@/middleware')

    expect(withAuth).toHaveBeenCalledTimes(1)
    expect(typeof capturedMiddleware).toBe('function')
    expect(typeof capturedOptions.callbacks.authorized).toBe('function')
  })

  it('should return NextResponse.next() from middleware function', async () => {
    await import('@/middleware')

    const mockReq = {} as any
    const result = capturedMiddleware(mockReq)

    expect(result).toEqual(NextResponse.next())
  })

  it('should return true when token exists in authorized callback', async () => {
    await import('@/middleware')

    const result = capturedOptions.callbacks.authorized({ token: { sub: '123' } })
    expect(result).toBe(true)
  })

  it('should return false when token is null in authorized callback', async () => {
    await import('@/middleware')

    const result = capturedOptions.callbacks.authorized({ token: null })
    expect(result).toBe(false)
  })

  it('should return false when token is undefined in authorized callback', async () => {
    await import('@/middleware')

    const result = capturedOptions.callbacks.authorized({ token: undefined })
    expect(result).toBe(false)
  })

  it('should export config with correct matcher patterns', async () => {
    const { config } = await import('@/middleware')

    expect(config.matcher).toEqual([
      '/dashboard/:path*',
      '/api/bookings/:path*',
      '/api/notifications/:path*',
      '/api/tutors/:id*/slots/:path*',
    ])
  })

  it('should protect dashboard routes', async () => {
    const { config } = await import('@/middleware')

    expect(config.matcher.some((m: string) => m.includes('/dashboard'))).toBe(true)
  })

  it('should protect bookings API routes', async () => {
    const { config } = await import('@/middleware')

    expect(config.matcher.some((m: string) => m.includes('/api/bookings'))).toBe(true)
  })

  it('should protect notifications API routes', async () => {
    const { config } = await import('@/middleware')

    expect(config.matcher.some((m: string) => m.includes('/api/notifications'))).toBe(true)
  })

  it('should protect tutor slots API routes', async () => {
    const { config } = await import('@/middleware')

    expect(config.matcher.some((m: string) => m.includes('/api/tutors') && m.includes('slots'))).toBe(true)
  })
})
