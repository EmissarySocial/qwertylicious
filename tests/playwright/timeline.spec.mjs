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

	test("the previous and next entries stick to the modal's top edge, clear of the corner buttons", async ({ page }) => {
		await openEntry(page)

		const modalWindow = page.locator("#modal-window")
		const bar = page.locator("#modal .qwerty-entry-neighbors")
		const next = page.locator('#modal [data-modal-go="next"]')
		const corner = page.locator("#modal .corner-pencil")

		// The bar starts at the window's top edge, and Next ends before the pencil and X begin
		expect(Math.abs((await bar.boundingBox()).y - (await modalWindow.boundingBox()).y)).toBeLessThan(1.5)
		const nextBox = await next.boundingBox()
		expect(nextBox.x + nextBox.width).toBeLessThanOrEqual((await corner.boundingBox()).x)

		// A long entry scrolls under the bar, which keeps its place
		await page.locator("#modal .e-content").evaluate((element) => { element.style.height = "2000px" })
		await modalWindow.evaluate((element) => { element.scrollTop = 600 })
		expect(Math.abs((await bar.boundingBox()).y - (await modalWindow.boundingBox()).y)).toBeLessThan(1.5)
	})
})
