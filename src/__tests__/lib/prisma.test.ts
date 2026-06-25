jest.unmock('@/lib/prisma')

const MockPrismaClientInstance = { _mockClient: true }
const MockPrismaClient = jest.fn().mockImplementation(() => MockPrismaClientInstance)
const MockPrismaPgInstance = { _mockAdapter: true }
const MockPrismaPg = jest.fn().mockImplementation(() => MockPrismaPgInstance)

jest.mock('@/generated/prisma/client', () => ({
  PrismaClient: MockPrismaClient,
}))

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: MockPrismaPg,
}))

describe('Prisma Client', () => {
  const originalEnv = process.env.NODE_ENV

  beforeEach(() => {
    jest.resetModules()
    MockPrismaClient.mockClear()
    MockPrismaPg.mockClear()
    delete (globalThis as Record<string, unknown>).prisma
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb'
  })

  afterEach(() => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, writable: true })
  })

  it('should create a PrismaClient instance', async () => {
    const { prisma } = await import('@/lib/prisma')

    expect(prisma).toBeDefined()
    expect(MockPrismaClient).toHaveBeenCalledTimes(1)
  })

  it('should use PrismaPg adapter', async () => {
    await import('@/lib/prisma')

    expect(MockPrismaPg).toHaveBeenCalledWith('postgresql://test:test@localhost:5432/testdb')
    expect(MockPrismaClient).toHaveBeenCalledWith({ adapter: MockPrismaPgInstance })
  })

  it('should cache PrismaClient on globalThis in development', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true })

    const { prisma } = await import('@/lib/prisma')

    const globalForPrisma = globalThis as unknown as { prisma: unknown }
    expect(globalForPrisma.prisma).toBe(prisma)
  })

  it('should not cache PrismaClient on globalThis in production', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true })

    const globalForPrisma = globalThis as unknown as { prisma: unknown }
    delete globalForPrisma.prisma

    await import('@/lib/prisma')

    expect(globalForPrisma.prisma).toBeUndefined()
  })

  it('should reuse cached client from globalThis', async () => {
    const cachedClient = { _cachedClient: true }
    const globalForPrisma = globalThis as unknown as { prisma: unknown }
    globalForPrisma.prisma = cachedClient

    const { prisma } = await import('@/lib/prisma')

    expect(prisma).toBe(cachedClient)
    expect(MockPrismaClient).not.toHaveBeenCalled()
  })
})
