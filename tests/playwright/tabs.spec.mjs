// The form library's tabs: a tab a person chooses takes the focus to the first control in its panel, and the tab
// selected when the page loads leaves the focus where it was. fixtures/tabs.html holds a two-tab form as
// benpate/form draws it, and the TabContainer behavior is Emissary's own, served from source. Each test runs in
// Chromium and WebKit, light and dark.
import { test, expect } from "@playwright/test"

const generalTab = (page) => page.getByRole("tab", { name: "General" })
const hashtagsTab = (page) => page.getByRole("tab", { name: "Hashtags" })
const nameInput = (page) => page.locator('input[name="label"]')
const firstHashtag = (page) => page.locator('#panel-tabcontainer-1 .list-widget > table > tbody > tr input').first()

// ready opens the fixture and waits for TabContainer to select its first tab
async function ready(page) {
	await page.goto("/tabs")
	await expect(page.locator("#panel-tabcontainer-1")).toBeHidden()
	await expect(generalTab(page)).toHaveAttribute("aria-selected", "true")
}

test.describe("tabs", () => {

	test("the tab selected on load leaves the focus where it was", async ({ page }) => {
		await ready(page)
		expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true)
	})

	test("a click on a tab moves the focus to the first control in its panel", async ({ page }) => {
		await ready(page)

		await hashtagsTab(page).click()
		await expect(page.locator("#panel-tabcontainer-1")).toBeVisible()
		await expect(firstHashtag(page)).toBeFocused()

		await generalTab(page).click()
		await expect(page.locator("#panel-tabcontainer-0")).toBeVisible()
		await expect(nameInput(page)).toBeFocused()
	})

	test("Enter on a focused tab selects it and moves the focus into its panel", async ({ page }) => {
		await ready(page)
		await page.locator("#before-tabs").focus()
		await page.keyboard.press("Tab")
		await page.keyboard.press("Tab")
		await expect(hashtagsTab(page)).toBeFocused()

		await page.keyboard.press("Enter")
		await expect(hashtagsTab(page)).toHaveAttribute("aria-selected", "true")
		await expect(firstHashtag(page)).toBeFocused()
	})
})
