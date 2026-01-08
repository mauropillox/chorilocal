/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
    testDir: './tests/e2e',
    timeout: 30000,
    expect: {
        timeout: 5000
    },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [
        ['html'],
        ['list']
    ],
    use: {
        baseURL: process.env.BASE_URL || 'http://localhost',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        actionTimeout: 10000,
        navigationTimeout: 15000,
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...require('@playwright/test').devices['Desktop Chrome'],
            },
        },
        {
            name: 'firefox',
            use: {
                ...require('@playwright/test').devices['Desktop Firefox'],
            },
        },
        {
            name: 'webkit',
            use: {
                ...require('@playwright/test').devices['Desktop Safari'],
            },
        },
    ],
    webServer: {
        command: 'npm run preview',
        port: 4173,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
    },
};
