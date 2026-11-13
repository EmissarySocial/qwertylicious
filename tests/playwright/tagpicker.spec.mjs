// A photo's Hashtags field: the gallery's hashtags as checkboxes, posted as one "#a #b" string on data.tags
// (emissary-specs LIST-WIDGET §1.9). server.mjs draws the fragment from qwerty-item-base/tag-options.html, for a
// saved post and through the gallery's add before the Save, and keeps what each Save posts. Each test runs in
// Chromium and WebKit, light and dark.
import { test, expect } from "@playwright/test"

// hex24 mints a collection id for each test, so tests running at once never share a post or a list
const hex24 = () => Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join("")

// seed stores a post with these files and hashtags, and setList sets the gallery's own list
const seed = async (page, collection, names, tags) => (await page.request.post("/seed", { data: { collection, files: names, tags } })).json()
const setList = (page, collection, tags) => page.request.post("/lists", { data: { collection, tags } })

// settled waits for htmx to finish settling swapped-in content, which is when it wires that content's own requests
const settled = (page) => expect(page.locator(".htmx-settling")).toHaveCount(0)

// openModal waits for the Modal behavior to finish opening
async function openModal(page) {
	await expect(page.locator("#modal.ready")).toBeVisible()
	await page.waitForTimeout(400)
}

// openEditor opens a collection's only post in its modal, then its editor
async function openEditor(page, collection) {
	await page.goto(`/gallery/${collection}`)
	const tile = page.locator(".qwerty-gallery-item")
	await settled(page)
	const box = await tile.boundingBox()
	await tile.click({ position: { x: 8, y: box.height - 8 } })
	await openModal(page)
	await page.locator("#modal .corner-pencil button[aria-label='Edit']").click()
	await openModal(page)
}

// openPicker selects the Hashtags tab and waits for the picker to arrive from the server
async function openPicker(page) {
	await page.getByRole("tab", { name: "Hashtags" }).click()
	await expect(page.locator(".qwerty-tag-picker")).toBeVisible()
	await settled(page)
}

// drop dispatches one file drop on the photo zone, with the file made in the page, and waits for its tile
async function drop(page, name) {
	await expect(page.locator('[data-upload-multiple][data-upload-multiple-ready="true"]')).toHaveCount(1)
	const transfer = await page.evaluateHandle((name) => {
		const dt = new DataTransfer()
		dt.items.add(new File(["x".repeat(100)], name, { type: "image/png", lastModified: 1 }))
		return dt
	}, name)
	await page.dispatchEvent("#_html-remote [data-upload-multiple]", "drop", { dataTransfer: transfer })
	await expect(page.locator(".upload-multiple-tile[data-value]")).toHaveCount(1)
	await expect(page.locator(".upload-multiple[data-upload-multiple-busy]")).toHaveCount(0)
}

const boxes = (page) => page.locator(".qwerty-tag-picker input[type=checkbox]")
const labels = (page) => page.locator(".qwerty-tag-picker label")
const value = (page) => page.locator(".qwerty-tag-value").inputValue()

// posted waits for the next POST to a path ending in the suffix, and returns the data.tags value it carried
async function posted(page, suffix, send) {
	const [request] = await Promise.all([
		page.waitForRequest((request) => request.method() == "POST" && new URL(request.url()).pathname.endsWith(suffix)),
		send(),
	])
	return new URLSearchParams(request.postData()).get("data.tags")
}

test.describe("hashtag picker", () => {

	test("Edit Photo lists the gallery's hashtags in order, with the photo's own checked whatever their case", async ({ page }) => {
		const collection = hex24()
		await seed(page, collection, ["a.png"], "#Food")
		await openEditor(page, collection)
		await openPicker(page)

		await expect(page.locator(".qwerty-tag-picker")).toContainText("Select one or more hashtags to arrange this photo within the gallery.")
		await expect(labels(page)).toHaveText(["travel", "food"])
		await expect(boxes(page).nth(0)).not.toBeChecked()
		await expect(boxes(page).nth(1)).toBeChecked()
		expect(await value(page)).toBe("#food")
	})

	test("a box rebuilds the value in the list's order, from a click or the keyboard, and the Save posts it", async ({ page }) => {
		const collection = hex24()
		const post = await seed(page, collection, ["a.png"], "#food")
		await openEditor(page, collection)
		await openPicker(page)

		await labels(page).nth(0).click()
		expect(await value(page)).toBe("#travel #food")

		// Space on a native checkbox toggles it and fires change
		await boxes(page).nth(1).focus()
		await page.keyboard.press("Space")
		expect(await value(page)).toBe("#travel")

		expect(await posted(page, "/edit", () => page.locator("#modal .corner-pencil button", { hasText: "Save" }).click())).toBe("#travel")

		// The server kept it: the modal returns, and the editor opens with travel alone checked
		await expect(page.locator("#modal .qwerty-carousel-slide img, #modal img").first()).toBeVisible()
		await page.locator("#modal .corner-pencil button[aria-label='Edit']").click()
		await openModal(page)
		await openPicker(page)
		await expect(boxes(page).nth(0)).toBeChecked()
		await expect(boxes(page).nth(1)).not.toBeChecked()
		expect((await (await page.request.get(`/posts/${post.id}`)).json()).tags).toBe("#travel")
	})

	test("Add Photos starts with nothing checked, and its Save carries the chosen hashtags onto the new post", async ({ page }) => {
		const collection = hex24()
		await page.goto(`/gallery/${collection}`)
		await page.getByRole("button", { name: "+ Add Photos" }).click()
		await openModal(page)
		await drop(page, "a.png")
		await openPicker(page)

		await expect(labels(page)).toHaveText(["travel", "food"])
		await expect(boxes(page)).toHaveCount(2)
		for (const box of await boxes(page).all()) {
			await expect(box).not.toBeChecked()
		}
		expect(await value(page)).toBe("")

		await labels(page).nth(1).click()
		expect(await posted(page, "/add", () => page.locator("#inline-save-button").click())).toBe("#food")

		// The gallery reloads with the new post, whose editor shows food checked
		await expect(page.locator(".qwerty-gallery-item")).toHaveCount(1)
		await openEditor(page, collection)
		await openPicker(page)
		await expect(boxes(page).nth(0)).not.toBeChecked()
		await expect(boxes(page).nth(1)).toBeChecked()
	})

	test("a gallery with no hashtags shows a note linking to Edit Collection, and the Save still posts an empty value", async ({ page }) => {
		const collection = hex24()
		await setList(page, collection, [])
		await seed(page, collection, ["a.png"], "#food")
		await openEditor(page, collection)
		await openPicker(page)

		await expect(page.locator(".qwerty-tag-picker")).toContainText("After you add hashtags to the collection container, you'll be able to select tags and organize this item with them.")
		await expect(page.locator(".qwerty-tag-picker a")).toHaveAttribute("hx-get", `/${collection}/settings`)
		await expect(page.locator(".qwerty-tag-picker")).not.toContainText("Select one or more hashtags")
		await expect(boxes(page)).toHaveCount(0)
		expect(await value(page)).toBe("")
		expect(await posted(page, "/edit", () => page.locator("#modal .corner-pencil button", { hasText: "Save" }).click())).toBe("")
	})
})
