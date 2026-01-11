import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for PRODUCTION testing
 * 
 * Usage:
 *   npm run test:e2e:prod     # Run against production
 *   npm run test:e2e          # Run against local/staging
 */

// Determine which environment to test
const isProd = process.env.TEST_ENV === 'production';
const baseURL = isProd
    ? process.env.PROD_URL || 'https://www.pedidosfriosur.com'
    : process.env.PLAYWRIGHT_URL || 'http://localhost:5173';

export default defineConfig({
    testDir: './e2e',

    // Timeout settings
    timeout: isProd ? 60000 : 30000, // Longer timeout for prod (network latency)
    expect: {
        timeout: isProd ? 10000 : 5000,
    },

    // Test execution
    fullyParallel: !isProd, // Sequential for prod (safer)
    forbidOnly: !!process.env.CI,
    retries: isProd ? 3 : (process.env.CI ? 2 : 0), // More retries for prod
    workers: isProd ? 1 : (process.env.CI ? 2 : undefined), // 1 worker for prod safety

    // Reporting
    reporter: [
        ['html', { outputFolder: 'playwright-report' }],
        ['json', { outputFile: 'test-results.json' }],
        ['list'],
    ],

    use: {
        baseURL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: isProd ? 'on-first-retry' : 'retain-on-failure',

        // Production-specific settings
        ...(isProd && {
            actionTimeout: 15000,
            navigationTimeout: 30000,
        }),
    },

    projects: [
        // Setup project for authentication
        {
            name: 'setup',
            testMatch: /.*\.setup\.ts/,
        },

        // Chromium tests (dependencies on setup)
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
            dependencies: ['setup'],
        },

        // Mobile tests (production only)
        ...(isProd ? [{
            name: 'mobile',
            use: { ...devices['iPhone 13'] },
            dependencies: ['setup'],
        }] : []),
    ],

    // Web server (local only)
    ...((!isProd && !process.env.CI) && {
        webServer: {
            command: 'npm run preview',
            url: 'http://localhost:5173',
            reuseExistingServer: !process.env.CI,
            timeout: 120000,
        },
    }),
});
