// Playwright runs every spec in Chromium and WebKit (Safari's engine), in light and dark mode,
// against server.mjs, which serves the theme's real stylesheets and scripts from source.
import { defineConfig, devices } from "@playwright/test"

const port = 8777

const engines = [
	["chromium", devices["Desktop Chrome"]],
	["webkit", devices["Desktop Safari"]],
]

export default defineConfig({
	testDir: ".",
	testMatch: "*.spec.mjs",
	reporter: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL: `http://127.0.0.1:${port}`,
		viewport: { width: 900, height: 700 },
	},
	projects: engines.flatMap(([name, device]) => ["light", "dark"].map((scheme) => ({
		name: `${name}-${scheme}`,
		use: { ...device, viewport: { width: 900, height: 700 }, colorScheme: scheme },
	}))),
	webServer: {
		command: `node server.mjs ${port}`,
		url: `http://127.0.0.1:${port}/healthz`,
		reuseExistingServer: !process.env.CI,
	},
})
