// An Article collection's tab: an article opened from it pushes its own address, even in Custom order.
// Each runs in Chromium and WebKit, light and dark (playwright.config.mjs).
import { test, expect } from "@playwright/test"

// historyLength is how many entries the tab's session history holds
async function historyLength(page) {
	return page.evaluate(() => history.length)
}

test.describe("article collection", () => {

	test("an article opened from Custom order pushes its own address, and Back returns to the tab", async ({ page }) => {
		await page.goto("/@author")
		const start = await historyLength(page)

		// The tab replaces the address, so it adds no history
		await page.getByRole("tab", { name: "Articles" }).click()
		await expect(page).toHaveURL(/\/@author\?tab=articles$/)
		expect(await historyLength(page)).toBe(start)

		// The article pushes its own address, so a reload stays on it
		await page.getByRole("link", { name: "An Article" }).click()
		await expect(page.locator("h1")).toHaveText("An Article")
		await expect(page).toHaveURL(/\/an-article$/)
		expect(await historyLength(page)).toBe(start + 1)

		// Back returns to the tab the article was opened from
		await page.goBack()
		await expect(page).toHaveURL(/\/@author\?tab=articles$/)
	})

	test("posting a new order leaves the address alone", async ({ page }) => {
		await page.goto("/@author?tab=articles")
		const start = await historyLength(page)

		// Sortable fires "update" on the form after a drag, and htmx posts the order from there
		// htmx:afterRequest fires on the form once the response, and any history change, is done
		await page.locator("form").evaluate((form) => new Promise((resolve) => {
			form.addEventListener("htmx:afterRequest", resolve, { once: true })
			form.dispatchEvent(new Event("update"))
		}))
		await expect(page).toHaveURL(/\/@author\?tab=articles$/)
		expect(await historyLength(page)).toBe(start)
	})
})
