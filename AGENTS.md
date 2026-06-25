<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Testing

- Run tests: `npm test`
- Run with coverage: `npm run test:coverage`
- CI command: `npm run test:ci`
- Coverage target: 85%+ overall, 90%+ for API routes
- All new API routes must have corresponding test files in `src/__tests__/api/`
- All new components should have test files in `src/__tests__/components/`
- Prisma is mocked globally — see `jest.setup.js`
