# Playwright E2E Tests

This directory contains end-to-end tests for the TracSeq ON web application using Playwright.

## Setup

The tests are already configured and ready to run. Playwright browsers are installed automatically when you run the tests for the first time.

## Running Tests

### Local Development

```bash
# Run all E2E tests
pnpm test:e2e

# Run tests with UI mode (interactive)
pnpm test:e2e:ui

# Run tests in debug mode
pnpm test:e2e:debug

# Show test report
pnpm test:e2e:report
```

### From Project Root

```bash
# Run all E2E tests
pnpm test:e2e

# Run tests with UI mode
pnpm test:e2e:ui

# Run tests in debug mode
pnpm test:e2e:debug

# Show test report
pnpm test:e2e:report
```

## Test Structure

- `homepage.spec.ts` - Tests for the main homepage
- `crispr-studio.spec.ts` - Tests for CRISPR Studio functionality
- `nanopore.spec.ts` - Tests for Nanopore analysis features
- `utils/test-helpers.ts` - Common test utilities and helper functions

## Test Configuration

The tests are configured in `playwright.config.ts` with the following settings:

- **Base URL**: `http://localhost:3001`
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Parallel execution**: Enabled for faster test runs
- **Screenshots**: Taken on failure
- **Videos**: Recorded on failure
- **Traces**: Collected on retry

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/your-page')
  })

  test('should do something', async ({ page }) => {
    // Your test code here
    await expect(page.locator('selector')).toBeVisible()
  })
})
```

### Using Test Helpers

```typescript
import {
  waitForPageLoad,
  elementExists,
  clickIfExists,
} from './utils/test-helpers'

test('should use helpers', async ({ page }) => {
  await page.goto('/')
  await waitForPageLoad(page)

  if (await elementExists(page, '.optional-element')) {
    await clickIfExists(page, '.optional-element')
  }
})
```

### Best Practices

1. **Use data-testid attributes** for reliable element selection
2. **Wait for elements** to be visible before interacting
3. **Use conditional checks** for optional elements
4. **Test responsive design** at different viewport sizes
5. **Check accessibility** with basic ARIA and semantic HTML tests
6. **Mock API responses** when testing specific scenarios

### Data Test IDs

Add `data-testid` attributes to your components for reliable testing:

```tsx
<div data-testid="crispr-studio">
  <button data-testid="design-button">Design</button>
  <input data-testid="sequence-input" />
</div>
```

Then use them in tests:

```typescript
await page.locator('[data-testid="crispr-studio"]').click()
await page.locator('[data-testid="sequence-input"]').fill('ATCG')
```

## CI/CD Integration

Tests run automatically in GitHub Actions on:

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

The CI pipeline:

1. Sets up Node.js and pnpm
2. Installs dependencies
3. Sets up PostgreSQL database
4. Runs database migrations
5. Builds the application
6. Runs Playwright tests
7. Uploads test reports as artifacts

## Debugging

### Local Debugging

```bash
# Run specific test file
pnpm test:e2e tests/e2e/homepage.spec.ts

# Run specific test
pnpm test:e2e --grep "should load homepage"

# Run in headed mode (see browser)
pnpm test:e2e --headed

# Run in debug mode with breakpoints
pnpm test:e2e:debug
```

### Test Reports

After running tests, view the HTML report:

```bash
pnpm test:e2e:report
```

This opens an interactive report showing:

- Test results
- Screenshots on failure
- Video recordings
- Execution traces
- Performance metrics

## Troubleshooting

### Common Issues

1. **Port conflicts**: Make sure port 3001 is available
2. **Database issues**: Ensure PostgreSQL is running
3. **Slow tests**: Use `waitForLoadState('networkidle')` for dynamic content
4. **Flaky tests**: Add proper waits and use `test.retry()` for unstable tests

### Environment Variables

Set these environment variables if needed:

```bash
# Database connection
DATABASE_URL=postgres://localhost:5432/tracseq_test

# CI environment
CI=true
```

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Use descriptive test names
3. Add proper assertions
4. Include accessibility checks
5. Test responsive design
6. Update this README if needed
