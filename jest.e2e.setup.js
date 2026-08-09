jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

beforeAll(async () => {
  if (process.env.RUN_E2E !== '1') return
  const { initializeDatabase } = await import('./src/lib/prisma')
  await initializeDatabase()
  await initializeDatabase()
})

afterAll(async () => {
  const { prisma } = await import('./src/lib/prisma')
  await prisma.$disconnect()
})
