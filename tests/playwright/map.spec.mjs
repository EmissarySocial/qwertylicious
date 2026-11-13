// A Map's pills: each keeps the drawn map, redraws only its markers, and fits the map to the tag's places.
// Each runs in Chromium and WebKit, light and dark (playwright.config.mjs).
import { test, expect } from "@playwright/test"

// mapState describes the Map tab's canvas: whether it is the canvas marked earlier, whether it holds a live map,
// how many maps and markers the tab draws, and which of the three places the view shows
async function mapState(page) {
	return page.locator("#profile-tabs .qwerty-map-canvas").evaluate((canvas) => {
		const map = canvas.qwertyMap ? canvas.qwertyMap.map : null
		const shows = (latitude, longitude) => map != null && map.getBounds().contains([latitude, longitude])
		return {
			kept: canvas.markedBySpec === true,
			live: map != null,
			maps: document.querySelectorAll("#profile-tabs .leaflet-container").length,
			markers: canvas.querySelectorAll(".leaflet-marker-icon").length,
			shows: [shows(34.05, -118.24), shows(37.77, -122.42), shows(32.72, -117.16)],
		}
	})
}

// openMap loads the Map tab and waits for every place's marker
async function openMap(page) {
	await page.goto("/@cartographer")
	await expect.poll(async () => (await mapState(page)).markers).toBe(3)
}

// pick clicks a pill and waits for it to be selected
async function pick(page, name) {
	await page.getByRole("tab", { name, exact: true }).click()
	await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true")
}

test.describe("a Map's pills", () => {

	test("a pill keeps the map and redraws only its markers", async ({ page }) => {
		await openMap(page)
		await page.locator("#profile-tabs .qwerty-map-canvas").evaluate((canvas) => { canvas.markedBySpec = true })

		await pick(page, "travel")
		await expect.poll(() => mapState(page)).toMatchObject({ kept: true, live: true, maps: 1, markers: 2 })

		await pick(page, "All")
		await expect.poll(() => mapState(page)).toMatchObject({ kept: true, live: true, maps: 1, markers: 3 })
	})

	test("a pill fits the map to its tag's places, and All to every place", async ({ page }) => {
		await openMap(page)
		expect((await mapState(page)).shows).toEqual([true, true, true])

		// travel is Los Angeles and San Diego, so San Francisco leaves the view
		await pick(page, "travel")
		await expect.poll(async () => (await mapState(page)).shows).toEqual([true, false, true])

		await pick(page, "All")
		await expect.poll(async () => (await mapState(page)).shows).toEqual([true, true, true])
	})

	test("a link with ?tag= opens the map fitted to that tag", async ({ page }) => {
		await page.goto("/@cartographer?tag=travel")
		await expect.poll(() => mapState(page)).toMatchObject({ markers: 2, shows: [true, false, true] })
	})

	test("Back brings back a live map, which a pill can still filter", async ({ page }) => {
		await openMap(page)
		await pick(page, "travel")
		await expect.poll(async () => (await mapState(page)).markers).toBe(2)

		// htmx restores its saved copy of the page, which a live map must draw again
		await page.goBack()
		await expect.poll(() => mapState(page)).toMatchObject({ live: true, maps: 1, markers: 3 })

		await pick(page, "food")
		await expect.poll(() => mapState(page)).toMatchObject({ live: true, maps: 1, markers: 2 })
	})

	test("every marker's image loads, before and after a pill", async ({ page }) => {
		const broken = () => page.locator("#profile-tabs img.leaflet-marker-icon").evaluateAll((images) => images.filter((image) => !image.complete || image.naturalWidth == 0).length)

		await openMap(page)
		await expect.poll(broken).toBe(0)

		await pick(page, "food")
		await expect.poll(async () => (await mapState(page)).markers).toBe(2)
		await expect.poll(broken).toBe(0)
	})
})
