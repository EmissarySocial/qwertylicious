// An Article collection's tab: an article opened from it pushes its own address, even in Custom order.
// Each runs in Chromium and WebKit, light and dark (playwright.config.mjs).
import { test, expect } from "@playwright/test"

// historyLength is how many entries the tab's session history holds
async function historyLength(page) {
	return page.evaluate(() => history.length)
}

// sortableRequests counts every request the page makes for Sortable.js, which the fixture server never lets it cache
function sortableRequests(page) {
	const requests = { count: 0 }
	page.on("request", (request) => {
		if (request.url().endsWith("/Sortable.min.js")) {
			requests.count++
		}
	})
	return requests
}

// sortableInstalled waits until the open tab's form carries a Sortable instance, which Sortable keys by its own name
async function sortableInstalled(page) {
	await page.waitForFunction(() => {
		const form = document.querySelector("form")
		return (form !== null) && !form.hasAttribute("data-replaced") && Object.keys(form).some((key) => key.startsWith("Sortable"))
	})
}

// reopenTab clicks the Articles tab again and waits for its new form to install Sortable
async function reopenTab(page) {
	await page.locator("form").evaluate((form) => form.setAttribute("data-replaced", ""))
	await page.getByRole("tab", { name: "Articles" }).click()
	await sortableInstalled(page)
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

	test("dragging an article by its handle posts the new order", async ({ page }) => {
		await page.goto("/@author")
		await sortableInstalled(page)

		// sortContainer hands the form's own handle and draggable on to Sortable
		const options = await page.locator("form").evaluate((form) => {
			const sortable = form[Object.keys(form).find((key) => key.startsWith("Sortable"))]
			return { handle: sortable.options.handle, draggable: sortable.options.draggable }
		})
		expect(options).toEqual({ handle: ".drag-handle", draggable: ">div" })

		// Hover the second card so its handle shows, then drag the handle above the first card
		const cards = page.locator("form > div")
		await cards.nth(1).hover()
		const handle = await cards.nth(1).locator(".drag-handle").boundingBox()
		const first = await cards.nth(0).boundingBox()
		const posted = page.waitForRequest((request) => request.url().endsWith("/articles/sort"))
		await page.mouse.move(handle.x + (handle.width / 2), handle.y + (handle.height / 2))
		await page.mouse.down()
		await page.mouse.move(first.x + 20, first.y + 20, { steps: 25 })
		await page.mouse.up()

		// The form posts every key, in the new order
		const body = new URLSearchParams((await posted).postData())
		expect(body.getAll("keys")).toEqual(["6ad24ab9c00dfca0c02cd472", "6ad24ab9c00dfca0c02cd471"])
	})

	test("Sortable loads once, however often the tab opens", async ({ page }) => {
		const requests = sortableRequests(page)
		await page.goto("/@author")
		await sortableInstalled(page)

		// Each click swaps in a new form, which installs the copy already on the page
		await reopenTab(page)
		await reopenTab(page)
		expect(requests.count).toBe(1)
		expect(await page.locator("script#sortable-library").count()).toBe(1)
	})
})
