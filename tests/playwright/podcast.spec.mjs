// The podcast list and the episode modal: hover colors, the date cell, the title's size between episodes,
// the backdrop, and the fade. Each runs in Chromium and WebKit, light and dark (playwright.config.mjs).
import { test, expect } from "@playwright/test"
import { rgba, luminance, pixels } from "./helpers.mjs"

// openEpisode loads the first episode's modal and waits for the Modal behavior to finish opening it
async function openEpisode(page) {
	await page.goto("/episode")
	await expect(page.locator("#modal.ready")).toBeVisible()
	await page.waitForTimeout(400)
}

test.describe("episode modal", () => {

	test("skip and play buttons highlight on hover, darker in light mode and lighter in dark mode", async ({ page }, testInfo) => {
		const dark = testInfo.project.use.colorScheme == "dark"
		await openEpisode(page)

		for (const selector of ["#modal [data-episode-go=next]", "#modal .qwerty-episode-toggle"]) {
			const button = page.locator(selector)
			const rest = await rgba(button)
			await button.hover()
			await page.waitForTimeout(200)
			const hover = await rgba(button)

			// RULE: the hover moves away from the page, never toward it, so the button never fades out
			if (dark) {
				expect(luminance(hover), `${selector} lightens`).toBeGreaterThan(luminance(rest) + 5)
			} else {
				expect(luminance(hover), `${selector} darkens`).toBeLessThan(luminance(rest) - 5)
			}
			await page.mouse.move(0, 0)
		}
	})

	test("a disabled skip button keeps its light circle on hover", async ({ page }) => {
		await openEpisode(page)
		const button = page.locator("#modal .qwerty-episode-arrow[disabled]")
		await expect(button).toHaveCount(1)
		const rest = await rgba(button)
		const box = await button.boundingBox()
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
		await page.waitForTimeout(200)
		expect(await rgba(button)).toEqual(rest)
	})

	test("the title keeps its size while the next episode arrives", async ({ page }) => {
		await openEpisode(page)

		// Sample the arriving title's font size on every frame of the change
		await page.evaluate(() => {
			window.sizes = []
			const start = performance.now()
			const tick = () => {
				const title = document.querySelector("#modal .qwerty-episode:not([data-leaving]) h2")
				if (title) window.sizes.push(getComputedStyle(title).fontSize)
				if (performance.now() - start < 700) requestAnimationFrame(tick)
			}
			requestAnimationFrame(tick)
		})
		await page.locator("#modal [data-episode-go=next]").click()
		await expect(page.locator("#modal h2")).toHaveText("Episode Two")
		await page.waitForTimeout(800)

		const sizes = await page.evaluate(() => window.sizes)
		expect(new Set(sizes), `sizes seen: ${[...new Set(sizes)].join(", ")}`).toEqual(new Set([sizes.at(-1)]))
	})

	test("moving between episodes fades with CSS, not a view transition, and the underlay keeps its blur", async ({ page }) => {
		await openEpisode(page)
		await page.evaluate(() => {
			window.viewTransitions = 0
			const original = document.startViewTransition
			if (original) document.startViewTransition = function (...args) { window.viewTransitions++; return original.apply(this, args) }
			window.blurs = []
			const start = performance.now()
			const tick = () => {
				const underlay = document.getElementById("modal-underlay")
				if (underlay) window.blurs.push(getComputedStyle(underlay).backdropFilter || getComputedStyle(underlay).webkitBackdropFilter)
				if (performance.now() - start < 700) requestAnimationFrame(tick)
			}
			requestAnimationFrame(tick)
		})
		await page.locator("#modal [data-episode-go=next]").click()
		await expect(page.locator("#modal h2")).toHaveText("Episode Two")
		await page.waitForTimeout(800)

		expect(await page.evaluate(() => window.viewTransitions)).toBe(0)
		const blurs = await page.evaluate(() => window.blurs)
		expect(blurs.every((value) => value.includes("blur")), `backdrop filters seen: ${[...new Set(blurs)].join(", ")}`).toBe(true)
		await expect(page.locator("html")).not.toHaveClass(/qwerty-episode-arriving/)
	})

	test("saving the episode returns to its modal, which stays open", async ({ page }) => {
		await openEpisode(page)

		// The edit form as Emissary's edit step draws it: hx-post, with hx-swap="none"
		await page.evaluate(() => {
			const id = document.querySelector("#modal [data-episode-id]").dataset.episodeId
			const form = document.createElement("form")
			form.id = "edit-episode-form"
			form.setAttribute("hx-post", `/${id}/edit`)
			form.setAttribute("hx-swap", "none")
			form.setAttribute("hx-push-url", "false")
			form.innerHTML = '<input name="label" value="Renamed"><button type="submit">Save</button>'
			document.querySelector("#modal-window").replaceChildren(form)
			htmx.process(form)
		})
		await page.locator("#edit-episode-form button").click()

		// The view comes back in the modal, and nothing closes it after the swap
		await expect(page.locator("#modal h2")).toHaveText(/Episode Three/)
		await page.waitForTimeout(600)
		await expect(page.locator("#modal.ready")).toBeVisible()
	})

	test("the X beside the pencil closes the modal", async ({ page }) => {
		await openEpisode(page)
		const close = page.locator("#modal .corner-pencil [aria-label=Close]")
		await expect(close).toBeVisible()
		await close.click()
		await expect(page.locator("#modal")).toHaveCount(0)
	})

	test("the backdrop is a black veil: 60% in light mode, 70% in dark mode", async ({ page }, testInfo) => {
		const dark = testInfo.project.use.colorScheme == "dark"
		await openEpisode(page)
		const [r, g, b, a] = await rgba(page.locator("#modal-underlay"))
		expect(Math.max(r, g, b)).toBeLessThan(16)
		expect(a).toBeCloseTo(dark ? 0.7 : 0.6, 1)
	})
})

test.describe("podcast list", () => {

	test("a hovered row is one color from end to end, behind the date too", async ({ page }) => {
		await page.goto("/podcast-list")
		const row = page.locator("tr.qwerty-podcast-episode")
		await row.locator(".qwerty-podcast-name").hover()
		await page.waitForTimeout(200)

		// RULE: no cell may be translucent, or it fades the row's hover color along with its text
		for (const cell of await row.locator("td").all()) {
			expect(await cell.evaluate((element) => getComputedStyle(element).opacity)).toBe("1")
		}

		// Sample the background just inside the top of each cell, above its content
		const points = []
		for (const cell of await row.locator("td").all()) {
			const box = await cell.boundingBox()
			points.push([box.x + 2, box.y + 2])
		}
		const colors = await pixels(page, points)
		for (const color of colors) {
			expect(color, `cell colors: ${JSON.stringify(colors)}`).toEqual(colors[0])
		}
	})
})
