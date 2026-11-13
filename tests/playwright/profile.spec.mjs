// A profile's collection tabs: a tab swaps #profile-tabs in place and leaves <main> where it was, in every frame.
// Each runs in Chromium and WebKit, light and dark (playwright.config.mjs).
import { test, expect } from "@playwright/test"
import { sampleScroll, scrollSamples } from "./helpers.mjs"

// mainTab is one of the profile's collection tabs, by its label
function mainTab(page, name) {
	return page.locator(".profile-tabs-row [role=tablist] [role=tab]", { hasText: new RegExp(`^${name}$`) })
}

test.describe("profile tabs", () => {

	// Safari moves <main> as the tab is replaced, and the tabs scroll nothing, so the frame puts it back before the frame paints
	for (const [from, to] of [["Scrapbook", "Essays"], ["Essays", "Scrapbook"]]) {
		test(`${to} opens with the page where ${from} left it`, async ({ page }) => {
			await page.goto(`/@columnist?tab=${from.toLowerCase()}`)
			await expect(mainTab(page, from)).toHaveAttribute("aria-selected", "true")
			await page.evaluate(() => document.querySelector("main").scrollTo({ top: 60, behavior: "instant" }))

			await sampleScroll(page)
			await mainTab(page, to).click()
			const samples = await scrollSamples(page)
			await expect(mainTab(page, to)).toHaveAttribute("aria-selected", "true")
			expect(samples.filter((top) => top != 60), `scroll positions: ${samples.join(" ")}`).toEqual([])
		})
	}
})
