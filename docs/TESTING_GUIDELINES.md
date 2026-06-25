# Testing Guidelines

## Overview
This document describes the testing practices and conventions for the Tutor Bank project.

## Running Tests

- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:ci` - Run tests in CI mode (coverage + max 2 workers)

## Test Structure

```
src/__tests__/
├── api/          # API route unit tests
├── components/   # React component tests
├── integration/  # Multi-route workflow tests
├── security/     # Security-focused tests
├── performance/  # Performance benchmark tests
└── lib/          # Utility/library tests
```

## Writing Tests

### API Route Tests
- Import the route handler directly
- Mock Prisma client methods
- Use `new Request()` to create test requests
- Assert on response status and body

### Component Tests
- Use React Testing Library
- Mock `next/navigation`, `fetch`, and `localStorage`
- Test rendering, interactions, and error states
- Prefer `getByRole` and `getByLabelText` over `getByTestId`

### Integration Tests
- Test complete workflows across multiple route handlers
- Chain mock responses for multi-step flows
- Verify side effects (notifications, slot status changes)

## Mock Usage

### Prisma Mock
Prisma is mocked globally in `jest.setup.js`. Usage:
```typescript
import { prisma } from '@/lib/prisma'
;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
```

Always clear mocks between tests:
```typescript
beforeEach(() => { jest.clearAllMocks() })
```

### Fetch Mock
```typescript
global.fetch = jest.fn()
;(global.fetch as jest.Mock).mockResolvedValueOnce({
  ok: true,
  json: async () => ({ data: 'result' }),
})
```

## Coverage Targets

| Area | Target |
|------|--------|
| API Routes | 90%+ |
| Components | 80%+ |
| Overall | 85%+ |

## Best Practices

1. Test behavior, not implementation details
2. Each test should be independent (use beforeEach to reset)
3. Name tests descriptively: "should [expected behavior] when [condition]"
4. Test both success and error paths
5. Keep mocks close to reality
6. Don't test external libraries (Prisma, bcrypt) — test how you use them
