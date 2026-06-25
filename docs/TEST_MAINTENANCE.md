# Test Maintenance Checklist

## When Adding New Features
1. Create test file in appropriate directory
2. Write tests for all success and error paths
3. Run full test suite to verify no regressions
4. Check coverage hasn't decreased

## When Modifying Existing Code
1. Run existing tests first to establish baseline
2. Update tests if behavior changes
3. Add new tests for new behavior
4. Never delete tests unless the feature is removed

## Monthly Maintenance
- [ ] Review flaky tests and fix or quarantine
- [ ] Update test dependencies
- [ ] Review coverage gaps
- [ ] Remove obsolete tests for deleted features
- [ ] Verify CI pipeline is running correctly

## Performance Monitoring
- Test suite should complete in under 5 minutes
- Individual test files should complete in under 30 seconds
- Monitor for slow tests and optimize

## Common Issues
- **Mock not working**: Ensure the mock path matches the import exactly (`@/lib/prisma`)
- **Test interference**: Always use `jest.clearAllMocks()` in beforeEach
- **Async issues**: Use `waitFor` or `await` for async operations
- **Navigation mocks**: Ensure `next/navigation` is mocked before component import
