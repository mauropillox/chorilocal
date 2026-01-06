/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
    timeout: 30000,
    use: {
        headless: true,
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } }
    ],
};
