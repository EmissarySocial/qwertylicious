// The Timeline entry modal: its layout holds still while the next entry arrives.
// Each runs in Chromium and WebKit, light and dark (playwright.config.mjs).
import { test, expect } from "@playwright/test"

// openEntry loads the first entry's modal and waits for the Modal behavior to finish opening it
async function openEntry(page) {
	await page.goto("/entry")
	await expect(page.locator("#modal.ready")).toBeVisible()
	await page.waitForTimeout(400)
}

test.describe("timeline entry modal", () => {

	test("the title and the details keep their place while the next entry arrives", async ({ page }) => {
		await openEntry(page)

		// Sample the title's size and top, and the top of the rule below it, on every frame of the change
		await page.evaluate(() => {
			window.layouts = []
			const start = performance.now()
			const tick = () => {
				const title = document.querySelector("#modal h1")
				const rule = document.querySelector("#modal hr")
				if (title && rule) {
					const size = getComputedStyle(title).fontSize
					window.layouts.push(`${size} at ${title.getBoundingClientRect().top}, rule at ${rule.getBoundingClientRect().top}`)
				}
				if (performance.now() - start < 700) requestAnimationFrame(tick)
			}
			requestAnimationFrame(tick)
		})
		await page.locator('#modal [data-modal-go="next"]').click()
		await expect(page.locator("#modal h1")).toHaveText("Constitution Signed")
		await page.waitForTimeout(800)

		const layouts = await page.evaluate(() => window.layouts)
		expect(new Set(layouts), `layouts seen: ${[...new Set(layouts)].join("; ")}`).toEqual(new Set([layouts.at(-1)]))
	})
})
