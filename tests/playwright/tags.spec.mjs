// A tagged collection's pills: each one redraws the tab and scrolls the pill row to the top of the window.
// Each runs in Chromium and WebKit, light and dark (playwright.config.mjs).
import { test, expect } from "@playwright/test"

// pillsTop is how far the pill row sits below the top of the window, in whole pixels
async function pillsTop(page) {
	return page.locator(".qwerty-tag-pills").evaluate((row) => Math.round(row.getBoundingClientRect().top))
}

test.describe("tag pills", () => {

	test("a pill reads as its bare tag, without a #", async ({ page }) => {
		await page.goto("/@photographer")
		await expect(page.locator(".qwerty-tag-pills [role=tab]")).toHaveText(["All", "travel", "food"])
	})

	test("a pill scrolls its row to the top of the window", async ({ page }) => {
		await page.goto("/@photographer")
		expect(await pillsTop(page)).toBeGreaterThan(300)

		await page.getByRole("tab", { name: "travel" }).click()
		await expect(page.getByRole("tab", { name: "travel" })).toHaveAttribute("aria-selected", "true")
		await expect.poll(() => pillsTop(page)).toBe(0)
	})

	test("a pill's text cannot be selected", async ({ page }) => {
		await page.goto("/@photographer")
		const pill = page.getByRole("tab", { name: "travel" })
		expect(await pill.evaluate((element) => getComputedStyle(element).webkitUserSelect || getComputedStyle(element).userSelect)).toBe("none")
	})

	test("All scrolls the row to the top too", async ({ page }) => {
		await page.goto("/@photographer")
		await page.getByRole("tab", { name: "travel" }).click()
		await expect.poll(() => pillsTop(page)).toBe(0)

		// From the top of the page again, All brings the row back up; the theme scrolls <main>, not the window
		await page.evaluate(() => document.querySelector("main").scrollTo({ top: 0, behavior: "instant" }))
		expect(await pillsTop(page)).toBeGreaterThan(300)
		await page.getByRole("tab", { name: "All", exact: true }).click()
		await expect(page.getByRole("tab", { name: "All", exact: true })).toHaveAttribute("aria-selected", "true")
		await expect.poll(() => pillsTop(page)).toBe(0)
	})
})
