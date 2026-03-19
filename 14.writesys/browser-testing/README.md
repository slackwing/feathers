# WriteSys Browser Testing with Playwright

Automated browser testing infrastructure for WriteSys using Playwright.

## Overview

This directory contains a comprehensive Playwright-based testing setup for headless browser testing of the WriteSys web UI. It provides:

- **Automated UI testing** with real Chrome browser
- **Screenshot capture** for visual verification
- **Console log monitoring** for JavaScript errors
- **Network request tracking** for API verification
- **Video recording** on test failures

## Setup

### Prerequisites

- Node.js 16+ and npm
- Running WriteSys API server on port 5003

### Installation

```bash
cd browser-testing
npm install
```

Playwright will automatically download Chromium (~167MB) during installation.

## Running Tests

### All Tests

```bash
npm test
```

### Smoke Tests (Quick Verification)

```bash
npm run test:smoke
```

Tests:
- API health check
- UI page loads correctly
- CSS is applied
- JavaScript modules load
- Manuscript API endpoint works

### UI Tests (Full Workflow)

```bash
npm run test:ui
```

Tests:
- Page load with all elements
- Manuscript loading and sentence wrapping
- Sentence hover and click interactions
- Create highlight annotations
- Create tag annotations
- Create task annotations
- Delete annotations
- Sidebar open/close

### Diagnostic Tests

```bash
npm test diagnostic.spec.js
npm test dom-structure.spec.js
```

Useful for debugging DOM structure and network issues.

### Run Tests with Visible Browser

```bash
npm run test:headed
```

### Debug Mode

```bash
npm run test:debug
```

Opens Playwright Inspector for step-by-step debugging.

## Test Structure

```
browser-testing/
├── tests/
│   ├── smoke.spec.js           # Quick verification tests
│   ├── writesys-ui.spec.js     # Full UI workflow tests
│   ├── diagnostic.spec.js       # Debugging tools
│   └── dom-structure.spec.js    # DOM inspection
├── playwright.config.js         # Playwright configuration
├── package.json
└── README.md
```

## Key Features

### 1. Paged.js Detection

The test framework automatically disables Paged.js during automated testing by detecting `navigator.webdriver`. This prevents Paged.js from wrapping the DOM in a template element, which would break the tests.

**In web/index.html:**
```javascript
const isAutomatedTest = navigator.webdriver || window.Cypress || window.__playwright;
if (!isAutomatedTest) {
  // Load Paged.js only for real browsers
}
```

### 2. Console Log Capture

All tests capture console messages and errors:

```javascript
page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push(msg.text());
  } else {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  }
});
```

### 3. Screenshot on Failure

Failed tests automatically capture screenshots and videos:

```
test-results/
└── <test-name>/
    ├── test-failed-1.png
    └── video.webm
```

### 4. Network Request Tracking

```javascript
page.on('request', request => {
  requests.push({ url: request.url(), method: request.method() });
});

page.on('response', response => {
  responses.push({ url: response.url(), status: response.status() });
});
```

### 5. HTML Report

```bash
npm run report
```

Opens a detailed HTML report with:
- Test execution timeline
- Screenshots and videos
- Network requests
- Console logs

## Configuration

### playwright.config.js

Key settings:

```javascript
{
  baseURL: 'http://localhost:5003',
  webServer: {
    command: 'cd .. && API_PORT=5003 ./bin/writesys-api',
    url: 'http://localhost:5003/health',
    reuseExistingServer: true,  // Reuse existing API server
    timeout: 10000,
  },
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
}
```

### Environment Variables

- `CI=true` - Disables server reuse and enables retries
- `API_PORT=5003` - Port for WriteSys API server

## Writing Tests

### Basic Test Structure

```javascript
const { test, expect } = require('@playwright/test');

test.describe('Feature Name', () => {
  test('test description', async ({ page }) => {
    // Navigate
    await page.goto('/');

    // Wait for element
    await page.waitForSelector('.sentence');

    // Interact
    await page.click('.sentence');

    // Assert
    await expect(page.locator('#sidebar')).toBeVisible();
  });
});
```

### Capturing Console Logs

```javascript
test.beforeEach(async ({ page }) => {
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push(msg.text());
  });
});
```

### Taking Screenshots

```javascript
await page.screenshot({
  path: 'screenshots/test-state.png',
  fullPage: true
});
```

### Waiting for API Calls

```javascript
// Wait for API response
const response = await page.waitForResponse(
  resp => resp.url().includes('/api/manuscripts')
);

// Or wait for specific selector after API call
await page.waitForSelector('.sentence', { timeout: 10000 });
```

## Troubleshooting

### Tests Fail with "element not found"

1. Check if Paged.js is properly disabled:
   ```bash
   npm test diagnostic.spec.js
   ```
   Look for "Paged.js disabled for automated testing" in console logs.

2. Increase timeout:
   ```javascript
   await page.waitForSelector('.sentence', { timeout: 15000 });
   ```

### API Server Not Starting

1. Check if port 5003 is already in use:
   ```bash
   lsof -i :5003
   ```

2. Manually start the API server:
   ```bash
   cd .. && API_PORT=5003 ./bin/writesys-api
   ```

3. Set `reuseExistingServer: true` in playwright.config.js

### CSS Not Loading

Check network tab in diagnostic test:
```bash
npm test diagnostic.spec.js
```

Look for 200 responses for `/css/book.css`.

### JavaScript Errors

Check console errors in test output:
```bash
npm test writesys-ui.spec.js
```

Console errors are printed after failed tests.

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Browser Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd browser-testing
          npm install
          npx playwright install --with-deps chromium

      - name: Start API server
        run: |
          cd ..
          ./bin/writesys-api &
          sleep 5

      - name: Run tests
        run: |
          cd browser-testing
          npm test

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: browser-testing/playwright-report/
```

## Performance

- **Smoke tests:** ~3-5 seconds
- **Full UI tests:** ~30-60 seconds
- **Single test:** ~2-5 seconds

## Known Issues

1. **Paged.js Conflict:** Paged.js wraps all body content in a `<template>` element, making DOM elements inaccessible. Solved by detecting `navigator.webdriver` and skipping Paged.js during tests.

2. **Sentence Wrapping:** renderer.js:241 has a null reference error when trying to wrap sentences without Paged.js's DOM structure. This needs to be fixed in the renderer code to handle both paged and unpaged modes.

3. **Network Timing:** Some tests may be flaky if the API server is slow. Increase timeouts if needed.

## Future Enhancements

- [ ] Visual regression testing with Percy or Chromatic
- [ ] Cross-browser testing (Firefox, WebKit)
- [ ] Mobile viewport testing
- [ ] Performance metrics (Core Web Vitals)
- [ ] Accessibility testing (axe-core)
- [ ] API mocking for faster tests
- [ ] Parallel test execution optimization

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [WriteSys Project Docs](../README.md)
- [WriteSys API Reference](../AGENTS.md#api-tests)

---

**Last Updated:** 2026-03-19
**Version:** 1.0.0
**Status:** ✓ Smoke tests passing, UI tests reveal renderer bug
