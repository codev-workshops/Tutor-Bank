const session = {
  user: {
    id: 'e2e-session-user',
    name: 'E2E User',
    email: 'e2e@example.com',
    role: 'STUDENT',
  },
}

globalThis.__e2eSession = session

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(async () => globalThis.__e2eSession),
}))
