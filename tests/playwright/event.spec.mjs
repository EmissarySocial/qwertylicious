// The Calendar event modal: its title keeps one size while it opens, and its responses bar uses one font size.
// Each runs in Chromium and WebKit, light and dark (playwright.config.mjs).
import { test, expect } from "@playwright/test"

// openEvent opens the event's modal from its calendar and waits for the Modal behavior to finish opening it
async function openEvent(page) {
	await page.locator("#open-event").click()
	await expect(page.locator("#modal.ready")).toBeVisible()
	await page.waitForTimeout(400)
}

test.describe("calendar event modal", () => {

	test("the title keeps one size while the modal opens", async ({ page }) => {
		await page.goto("/calendar")

		// Sample the title's size on every frame, from before the click until the modal has settled
		await page.evaluate(() => {
			window.sizes = []
			const start = performance.now()
			const tick = () => {
				const title = document.querySelector("#modal h1")
				if (title) window.sizes.push(getComputedStyle(title).fontSize)
				if (performance.now() - start < 1200) requestAnimationFrame(tick)
			}
			requestAnimationFrame(tick)
		})
		await openEvent(page)
		await page.waitForTimeout(800)

		const sizes = await page.evaluate(() => window.sizes)
		expect(sizes.length).toBeGreaterThan(0)
		expect(new Set(sizes), `sizes seen: ${[...new Set(sizes)].join(", ")}`).toEqual(new Set([sizes.at(-1)]))
	})

	test("the Reply, Like, and Share buttons use the same font size as the tabs beside them", async ({ page }) => {
		await page.goto("/calendar")
		await openEvent(page)

		const sizes = await page.locator("#modal .qwerty-responses-row").evaluate((row) => ({
			buttons: [...row.querySelectorAll("button")].map((button) => getComputedStyle(button).fontSize),
			tabs: [...row.querySelectorAll("[role=tab]")].map((tab) => getComputedStyle(tab).fontSize),
		}))
		expect(sizes.buttons).toHaveLength(3)
		expect(sizes.tabs).toHaveLength(3)
		expect(new Set([...sizes.buttons, ...sizes.tabs]), `buttons ${sizes.buttons.join(", ")}; tabs ${sizes.tabs.join(", ")}`).toEqual(new Set([sizes.tabs[0]]))
	})
})
