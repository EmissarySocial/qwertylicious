// The form library's upload widget, drawn as a single-file zone: the saved file as a tile at its own proportions,
// or a plus that picks one, with the file sent by the form's Save. The fixture is the markup benpate/form draws,
// and the styles and the script are Emissary's own, served from source. Each test runs in Chromium and WebKit,
// light and dark.
import { test, expect } from "@playwright/test"

const TILE_HEIGHT = 96

// zone finds a field's zone by the name its input posts under
const zone = (page, name) => page.locator(`.upload-single:has(input[type=file][name="${name}"])`)

// box rounds an element's size, which is all these tests compare
const box = async (locator) => {
	const { width, height } = await locator.boundingBox()
	return { width: Math.round(width), height: Math.round(height) }
}

// image makes a real PNG of this size in the page, as a buffer Playwright can hand to a picker
async function image(page, width, height) {
	const base64 = await page.evaluate(([width, height]) => {
		const canvas = document.createElement("canvas")
		canvas.width = width
		canvas.height = height
		const context = canvas.getContext("2d")
		context.fillStyle = "#2a9d8f"
		context.fillRect(0, 0, width, height)
		return canvas.toDataURL("image/png").split(",")[1]
	}, [width, height])
	return Buffer.from(base64, "base64")
}

// drag dispatches one drag event carrying a file of this name and type onto a field's zone
async function drag(page, name, type, file) {
	const transfer = await page.evaluateHandle(([name, type]) => {
		const transfer = new DataTransfer()
		transfer.items.add(new File(["x"], name, { type }))
		return transfer
	}, [file.name, file.type])
	await zone(page, name).dispatchEvent(type, { dataTransfer: transfer })
}

// pickedNames reads the names of the files a field's input holds, which is what the Save will carry
const pickedNames = (page, name) => page.locator(`input[type=file][name="${name}"]`).evaluate((input) => Array.from(input.files).map((file) => file.name))

// posted clicks Save and reads back what the server received, by field name
async function posted(page) {
	await page.locator("#inline-save-button").click()
	await expect(page.locator("#posted")).not.toBeEmpty()
	return JSON.parse(await page.locator("#posted").textContent())
}

test.describe("upload widget", () => {

	test.beforeEach(async ({ page }) => {
		await page.goto("/upload")
		await expect(page.locator('.upload-single[data-upload-single-ready="true"]')).toHaveCount(7)
		await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete))
	})

	test("every tile is one height, takes its width from its image, and stays inside its zone", async ({ page }) => {
		const tile = (name) => zone(page, name).locator(".upload-multiple-tile")

		expect(await box(tile("square"))).toEqual({ width: 96, height: TILE_HEIGHT })
		expect(await box(tile("banner"))).toEqual({ width: 171, height: TILE_HEIGHT })

		// A portrait is narrower than the tile's minimum, and a panorama is wider than its maximum
		expect(await box(tile("portrait"))).toEqual({ width: 96, height: TILE_HEIGHT })
		expect(await box(tile("panorama"))).toEqual({ width: 640, height: TILE_HEIGHT })

		// The image never distorts: the panorama letterboxes inside its tile
		expect(await zone(page, "panorama").locator("img").evaluate((image) => getComputedStyle(image).objectFit)).toBe("contain")

		// The plus is a square of the tile's height, so an empty zone and a full one are the same height
		expect(await box(zone(page, "empty").locator(".upload-multiple-add"))).toEqual({ width: TILE_HEIGHT, height: TILE_HEIGHT })
		const heights = await page.locator(".upload-single").evaluateAll((zones) => zones.map((zone) => Math.round(zone.getBoundingClientRect().height)))
		expect(new Set(heights).size).toBe(1)

		// A saved file hides the plus and the picker, and an empty field shows only the plus
		await expect(zone(page, "square").locator(".upload-multiple-add")).toBeHidden()
		await expect(zone(page, "empty").locator(".upload-multiple-tile")).toHaveCount(0)
		await expect(page.locator(".upload-single input[type=file]").first()).toBeHidden()
	})

	test("a tile stays inside a narrow zone", async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 800 })
		const inner = await zone(page, "panorama").evaluate((zone) => zone.clientWidth - parseFloat(getComputedStyle(zone).paddingLeft) * 2)
		const tile = await box(zone(page, "panorama").locator(".upload-multiple-tile"))
		expect(tile.width).toBeLessThanOrEqual(Math.round(inner))
		expect(tile.height).toBe(TILE_HEIGHT)
	})

	test("a file with no preview is an icon and its name", async ({ page }) => {
		const tile = zone(page, "audio").locator(".upload-multiple-tile")
		await expect(tile.locator(".upload-multiple-filename")).toHaveText("Episode 12 - A very long conversation about everything.mp3")
		await expect(tile.locator("img, audio")).toHaveCount(0)
		expect((await box(tile)).height).toBe(TILE_HEIGHT)
	})

	test("the plus picks a file, which shows at once and travels with the Save, and its X takes it back", async ({ page }) => {
		const empty = zone(page, "empty")
		const before = await box(empty)

		const chooser = page.waitForEvent("filechooser")
		await empty.locator(".upload-multiple-add").click()
		await (await chooser).setFiles({ name: "wide.png", mimeType: "image/png", buffer: await image(page, 400, 200) })

		// The picked file is a tile at its own proportions, and the message sits beside it, so the zone keeps its height
		const picked = empty.locator("[data-upload-single-picked]")
		await expect(picked.locator("img")).toBeVisible()
		await page.waitForFunction(() => document.querySelector("[data-upload-single-picked] img").naturalWidth > 0)
		expect(await box(picked)).toEqual({ width: 192, height: TILE_HEIGHT })
		await expect(empty.locator(".upload-multiple-add")).toBeHidden()
		await expect(empty.locator(".upload-multiple-status")).toHaveText("wide.png will upload when you save")
		expect(await box(empty)).toEqual(before)

		expect((await posted(page)).empty).toEqual(["file:wide.png"])

		// The X shows with the mouse, removes the pick, and puts the plus back with the focus on it
		await picked.hover()
		await picked.locator(".upload-multiple-remove").click()
		await expect(picked).toHaveCount(0)
		await expect(empty.locator(".upload-multiple-add")).toBeVisible()
		await expect(empty.locator(".upload-multiple-add")).toBeFocused()
		await expect(empty.locator(".upload-multiple-status")).toBeEmpty()
		expect(await pickedNames(page, "empty")).toEqual([])
	})

	test("a click on the saved tile picks a replacement, and its X puts the saved file back", async ({ page }) => {
		const square = zone(page, "square")
		const saved = square.locator("[data-upload-single-saved]")

		// With nothing picked, the Save keeps the saved file's address
		expect((await posted(page)).square).toEqual(["/upload/image/400x400"])

		const chooser = page.waitForEvent("filechooser")
		await saved.click({ position: { x: 20, y: 80 } })
		await (await chooser).setFiles({ name: "new.png", mimeType: "image/png", buffer: await image(page, 100, 100) })

		const picked = square.locator("[data-upload-single-picked]")
		await expect(picked).toBeVisible()
		await expect(saved).toBeHidden()
		await page.locator("#posted").evaluate((element) => { element.textContent = "" })
		expect((await posted(page)).square).toEqual(["/upload/image/400x400", "file:new.png"])

		await picked.hover()
		await picked.locator(".upload-multiple-remove").click()
		await expect(saved).toBeVisible()
		await expect(saved).toBeFocused()
		await expect(square.locator(".upload-multiple-add")).toBeHidden()
		expect(await pickedNames(page, "square")).toEqual([])
	})

	test("Enter and Space on a focused tile open the picker", async ({ page }) => {
		const saved = zone(page, "banner").locator("[data-upload-single-saved]")

		for (const key of ["Enter", " "]) {
			await saved.focus()
			const chooser = page.waitForEvent("filechooser")
			await page.keyboard.press(key)
			await (await chooser).setFiles([])
		}

		// Focus inside the tile shows its X, as the mouse does
		await saved.focus()
		await expect(saved.locator(".upload-multiple-remove")).toBeVisible()
	})

	test("a dropped file is taken when the field accepts it, and refused when it does not", async ({ page }) => {
		const empty = zone(page, "empty")

		await drag(page, "empty", "dragenter", { name: "photo.png", type: "image/png" })
		await expect(empty).toHaveClass(/highlight/)

		await drag(page, "empty", "drop", { name: "photo.png", type: "image/png" })
		await expect(empty).not.toHaveClass(/highlight/)
		expect(await pickedNames(page, "empty")).toEqual(["photo.png"])
		await expect(empty.locator("[data-upload-single-picked]")).toBeVisible()

		// An audio field takes no image, says so, and keeps what it had
		const audio = zone(page, "emptyAudio")
		await drag(page, "emptyAudio", "drop", { name: "photo.png", type: "image/png" })
		expect(await pickedNames(page, "emptyAudio")).toEqual([])
		await expect(audio.locator(".upload-multiple-status")).toHaveText("photo.png is not a file this field takes")
		await expect(audio.locator(".upload-multiple-status")).toHaveClass(/warning/)
		await expect(audio.locator(".upload-multiple-add")).toBeVisible()

		// A drop of several takes the first that fits
		await page.evaluate(() => {
			const transfer = new DataTransfer()
			transfer.items.add(new File(["x"], "notes.txt", { type: "text/plain" }))
			transfer.items.add(new File(["x"], "one.mp3", { type: "audio/mpeg" }))
			transfer.items.add(new File(["x"], "two.mp3", { type: "audio/mpeg" }))
			document.querySelector('input[name="emptyAudio"]').closest(".upload-single").dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true }))
		})
		expect(await pickedNames(page, "emptyAudio")).toEqual(["one.mp3"])
		await expect(audio.locator(".upload-multiple-filename")).toHaveText("one.mp3")
	})

	test("an image the browser cannot decode falls back to the icon and its name", async ({ page }) => {
		await page.locator('input[name="empty"]').setInputFiles({ name: "broken.png", mimeType: "image/png", buffer: Buffer.from("not an image") })

		const picked = zone(page, "empty").locator("[data-upload-single-picked]")
		await expect(picked.locator(".upload-multiple-filename")).toHaveText("broken.png")
		await expect(picked.locator("img")).toHaveCount(0)
	})

	test("the saved tile's X deletes after a confirm, and a failed delete keeps the tile", async ({ page }) => {
		const dialogs = []
		page.on("dialog", (dialog) => { dialogs.push(dialog.message()); dialog.accept() })

		// A field with no delete option draws no X
		await expect(zone(page, "portrait").locator(".upload-multiple-remove")).toHaveCount(0)

		// A refused delete changes nothing
		await page.route("**/upload/delete", (route) => route.fulfill({ status: 500, body: "" }), { times: 1 })
		const banner = zone(page, "banner")
		await banner.locator("[data-upload-single-saved]").hover()
		const refused = page.waitForResponse("**/upload/delete")
		await banner.locator(".upload-multiple-remove").click()
		await refused
		await expect(banner.locator("[data-upload-single-saved]")).toBeVisible()

		// One that goes through removes the tile and shows the plus, and the Save then carries nothing for the field
		const square = zone(page, "square")
		await square.locator("[data-upload-single-saved]").hover()
		const deleted = page.waitForResponse("**/upload/delete")
		await square.locator(".upload-multiple-remove").click()
		await deleted
		await expect(square.locator("[data-upload-single-saved]")).toHaveCount(0)
		await expect(square.locator(".upload-multiple-add")).toBeVisible()
		expect(dialogs).toEqual(["Delete this file?", "Delete this file?"])
		expect((await posted(page)).square).toBeUndefined()
	})

	test("a file dropped beside a zone never replaces the page", async ({ page }) => {
		const prevented = await page.evaluate(() => {
			const transfer = new DataTransfer()
			transfer.items.add(new File(["x"], "stray.png", { type: "image/png" }))
			const event = new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true })
			document.querySelector("#posted").dispatchEvent(event)
			return event.defaultPrevented
		})
		expect(prevented).toBe(true)
	})
})
