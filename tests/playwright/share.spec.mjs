// Emissary's Share behavior, on the Share button at the end of a responses bar.
// Each runs in Chromium and WebKit, light and dark (playwright.config.mjs).
import { test, expect } from "@playwright/test"

// withShare replaces the browser's share menu with one that records what it was given, then settles as asked;
// like the real one, it refuses a call that is not made on navigator
async function withShare(page, outcome) {
	await page.addInitScript((outcome) => {
		Object.defineProperty(Navigator.prototype, "share", {
			configurable: true,
			value: function (data) {
				if (this !== navigator) throw new TypeError("Illegal invocation")
				window.shared = data
				if (outcome == "resolve") return Promise.resolve()
				return Promise.reject(new DOMException("Share failed", outcome))
			},
		})
	}, outcome)
}

// openEvent opens the event's modal from its calendar, so the Share button arrives in an htmx swap
async function openEvent(page) {
	await page.goto("/calendar")
	await page.locator("#open-event").click()
	await expect(page.locator("#modal.ready")).toBeVisible()
}

// consoleErrors collects every console error the page logs from now on
function consoleErrors(page) {
	const errors = []
	page.on("console", (message) => { if (message.type() == "error") errors.push(message.text()) })
	page.on("pageerror", (error) => errors.push(error.message))
	return errors
}

test.describe("Share button", () => {

	test("stays hidden where the browser has no share menu", async ({ page }) => {
		await page.addInitScript(() => { delete Navigator.prototype.share })
		await openEvent(page)

		const share = page.locator('#modal button[aria-label="Share"]')
		await expect(share).toHaveCount(1)
		await expect(share).toBeHidden()
	})

	test("opens the share menu with the post's URL", async ({ page }) => {
		await withShare(page, "resolve")
		await openEvent(page)

		const share = page.locator('#modal button[aria-label="Share"]')
		await expect(share).toBeVisible()
		await share.click()

		const url = await share.getAttribute("data-share-url")
		expect(url).toMatch(/^https:\/\/example\.social\/[0-9a-f]{24}$/)
		await expect.poll(() => page.evaluate(() => window.shared)).toEqual({ url })
	})

	test("shows on a page that arrives whole, not only in a swap", async ({ page }) => {
		await withShare(page, "resolve")
		await page.goto("/entry")

		await expect(page.locator('button[aria-label="Share"]')).toBeVisible()
	})

	test("adds a title and text only where the button carries them", async ({ page }) => {
		await withShare(page, "resolve")
		await page.goto("/entry")
		await expect(page.locator('button[aria-label="Share"]')).toBeVisible()

		// Two buttons as the Share Page widget draws them, inside the open modal: one with a title and text, one whose text is empty
		await page.evaluate(() => {
			document.querySelector('button[aria-label="Share"]').insertAdjacentHTML("afterend", `
				<div id="titled" role="button" script="install Share" data-share-url="https://example.social/1" data-share-title="It's a &quot;title&quot;" data-share-text="A summary" hidden>Share Page</div>
				<div id="untexted" role="button" script="install Share" data-share-url="https://example.social/2" data-share-title="A title" data-share-text="" hidden>Share Page</div>`)
			_hyperscript.process(document.getElementById("titled"))
			_hyperscript.process(document.getElementById("untexted"))
		})

		await page.locator("#titled").click()
		await expect.poll(() => page.evaluate(() => window.shared)).toStrictEqual({ url: "https://example.social/1", title: `It's a "title"`, text: "A summary" })

		await page.locator("#untexted").click()
		await expect.poll(() => page.evaluate(() => window.shared)).toStrictEqual({ url: "https://example.social/2", title: "A title" })
	})

	test("closing the share menu logs nothing", async ({ page }) => {
		await withShare(page, "AbortError")
		await openEvent(page)

		const errors = consoleErrors(page)
		await page.locator('#modal button[aria-label="Share"]').click()
		await expect.poll(() => page.evaluate(() => window.shared)).toBeTruthy()
		await page.waitForTimeout(200)

		expect(errors).toEqual([])
	})

	test("a share menu that fails is logged", async ({ page }) => {
		await withShare(page, "NotAllowedError")
		await openEvent(page)

		const errors = consoleErrors(page)
		await page.locator('#modal button[aria-label="Share"]').click()

		await expect.poll(() => errors.join("\n")).toContain("Share failed")
	})
})
