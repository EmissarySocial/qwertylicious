// A photo post's photos: Add Photos stages each dropped file under the user at once and its Save adopts them,
// and Edit Photo uploads, sorts, and deletes them in place through the post's photos action (emissary-specs
// UPLOAD-MULTIPLE-WIDGET §1.10, §1.11, and §1.13). server.mjs answers the photos action as Emissary's
// edit-attachments step does, on a saved post and before the Save through the collection's add, and the
// widget's script and styles are Emissary's own, served from source. Each
// test runs in Chromium and WebKit, light and dark.
import { test, expect } from "@playwright/test"

// hex24 mints a collection id for each test, so tests running at once never share a post
const hex24 = () => Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join("")

// drop dispatches one file drop per name on the widget's zone, with the files made in the page; the
// widget takes one file per drop
async function drop(page, names) {
	for (const [index, name] of names.entries()) {
		const transfer = await page.evaluateHandle(([name, index]) => {
			const dt = new DataTransfer()
			dt.items.add(new File(["x".repeat(100 + index)], name, { type: "image/png", lastModified: 1 }))
			return dt
		}, [name, index])
		await page.dispatchEvent("#_html-remote [data-upload-multiple]", "drop", { dataTransfer: transfer })
	}
}

// tileIDs reads the saved files' ids from the row, in tile order
const tileIDs = (page) => page.locator(".upload-multiple-tile").evaluateAll((tiles) => tiles.map((tile) => tile.dataset.value))

// slideIDs reads the attachment ids from the modal's carousel, in slide order
const slideIDs = (page) => page.locator("#modal .qwerty-carousel-slide img").evaluateAll((images) => images.map((image) => image.getAttribute("src").match(/attachments\/([0-9a-f]{24})/)[1]))

// settled waits for htmx to finish settling swapped-in content, which is when it wires that content's own
// requests; a click before then reaches a button htmx has not seen yet
const settled = (page) => expect(page.locator(".htmx-settling")).toHaveCount(0)

// idle waits for the widget's request to finish, which releases the Xs it held, and for the row to settle
async function idle(page) {
	await expect(page.locator(".upload-multiple[data-upload-multiple-busy]")).toHaveCount(0)
	await settled(page)
}

// zoneLoaded waits for the zone to arrive from the server with its row, and for Emissary's script to have wired
// it, which it does once the swap settles; a drop dispatched before then lands on a zone with no listeners
const zoneLoaded = async (page) => {
	await expect(page.locator(".upload-multiple-tiles")).toHaveCount(1)
	await expect(page.locator('[data-upload-multiple][data-upload-multiple-ready="true"]')).toHaveCount(1)
}

// rowCount waits for the zone, then for the row to hold this many saved files with none still uploading, and for the widget to go idle
async function rowCount(page, count) {
	await zoneLoaded(page)
	await expect(page.locator(".upload-multiple-tile[data-value]")).toHaveCount(count)
	await expect(page.locator(".upload-multiple-pending")).toHaveCount(0)
	await idle(page)
}

const status = (page) => page.locator("#upload-multiple-photos-status")

// clickX hovers a tile, which is what shows its X on a device with a pointer, then clicks the X
async function clickX(page, tile) {
	await page.locator(tile).hover()
	await page.locator(`${tile} .upload-multiple-remove`).click()
}

// files reads a post's files from the server, in rank order
const files = async (page, id) => (await (await page.request.get(`/posts/${id}`)).json()).files

// seed stores a post of these files in the collection, as Add Photos would
const seed = async (page, collection, names) => (await page.request.post("/seed", { data: { collection, files: names } })).json()

// posts records each POST the page sends to a path ending in the suffix, so a test can tell a stopped Save from a sent one
function posts(page, suffix) {
	const sent = []
	page.on("request", (request) => {
		if (request.method() == "POST" && new URL(request.url()).pathname.endsWith(suffix)) sent.push(request.url())
	})
	return sent
}

// openModal waits for the Modal behavior to finish opening
async function openModal(page) {
	await expect(page.locator("#modal.ready")).toBeVisible()
	await page.waitForTimeout(400)
}

// openPost clicks the gallery's only tile on its photo, away from the owner's pencil in its top right corner
async function openPost(page) {
	const tile = page.locator(".qwerty-gallery-item")
	await settled(page)
	const box = await tile.boundingBox()
	await tile.click({ position: { x: 8, y: box.height - 8 } })
	await openModal(page)
}

// openEditor opens a collection's only post in its modal, then its editor, and waits for the row of photos
async function openEditor(page, collection, count) {
	await page.goto(`/gallery/${collection}`)
	await openPost(page)
	await page.locator("#modal .corner-pencil button[aria-label='Edit']").click()
	await rowCount(page, count)
	await openModal(page)
}

test.describe("photo post", () => {

	test.beforeEach(async ({ page }) => {
		page.on("dialog", (dialog) => dialog.accept())
	})

	test("Add Photos stages each dropped file at once, and the Save adopts them in tile order", async ({ page }) => {
		let dialogs = 0
		page.on("dialog", () => dialogs++)

		const collection = hex24()
		await page.goto(`/gallery/${collection}`)
		await expect(page.locator("#gallery")).toContainText("Your Photo Gallery")

		await page.locator("#add-photos").click()
		await openModal(page)

		// The zone loads its row, plus, input, and status line from the photos action, reached through the collection's add before the Save
		await zoneLoaded(page)
		await expect(page.locator(".upload-multiple-tiles")).toHaveAttribute("data-staging-url", `/${collection}/add?action=photos`)
		await expect(page.locator(".upload-multiple-tiles")).toHaveAttribute("data-maximum", "16")

		// Each drop uploads through the collection's add at once, one at a time, and the staged tiles join the row before the plus
		await expect(page.locator("#upload-multiple-photos-add")).toBeVisible()
		await drop(page, ["a.png", "b.png", "c.png"])
		await expect(page.locator(".upload-multiple-tile[data-value]")).toHaveCount(3)
		await idle(page)
		expect(await page.locator("#upload-multiple-photos-input").evaluate((input) => input.files.length)).toBe(0)
		expect(await page.locator("#upload-multiple-photos-input").evaluate((input) => input.multiple)).toBe(false)
		await expect(page.locator("#upload-multiple-photos-add")).toBeVisible()

		const ids = await tileIDs(page)
		const staged = await (await page.request.get("/staged")).json()
		expect(ids.every((id) => staged.some((file) => file.id == id))).toBe(true)

		// The X on a staged tile comes with the mouse, removes it at once with no confirm, and the server forgets it
		await expect(page.locator(`.upload-multiple-tile[data-value="${ids[1]}"] .upload-multiple-remove`)).toBeHidden()
		await clickX(page, `.upload-multiple-tile[data-value="${ids[1]}"]`)
		await expect(page.locator(".upload-multiple-tile")).toHaveCount(2)
		await idle(page)
		expect(dialogs).toBe(0)
		expect((await (await page.request.get("/staged")).json()).some((file) => file.id == ids[1])).toBe(false)

		// Home moves c.png to the front from the keyboard, with its tile as the handle; its order input moves with it, and nothing is posted
		await page.locator(`.upload-multiple-tile[data-value="${ids[2]}"]`).focus()
		await page.keyboard.press("Home")
		await expect(status(page)).toHaveText("c.png, 1 of 2")
		expect(await tileIDs(page)).toEqual([ids[2], ids[0]])

		// The Save posts the IDs, the modal closes, and the gallery shows the new post
		await page.locator("#inline-save-button").click()
		await expect(page.locator("#modal")).toHaveCount(0)
		await expect(page.locator(".qwerty-gallery-item")).toHaveCount(1)
		await expect(page.locator(".qwerty-gallery-mark .bi-images")).toHaveCount(1)

		// The post holds the two in tile order, and they are no longer staged
		const id = (await page.locator(".qwerty-gallery-item").getAttribute("hx-get")).split("/")[1]
		const stored = await files(page, id)
		expect(stored.map((file) => file.name)).toEqual(["c.png", "a.png"])
		expect((await (await page.request.get("/staged")).json()).some((file) => ids.includes(file.id))).toBe(false)

		// Its modal is a carousel of the two, in that order
		await openPost(page)
		await expect(page.locator("#modal .qwerty-carousel-slide")).toHaveCount(2)
		await expect(page.locator("#modal .qwerty-carousel-count")).toHaveText("1 / 2")
		expect(await slideIDs(page)).toEqual(stored.map((file) => file.id))

		// The figure brings its own script, so the arrows work on a page whose theme loads none
		await page.locator('#modal [data-carousel="next"]').click()
		await expect(page.locator("#modal .qwerty-carousel-count")).toHaveText("2 / 2")
		await page.keyboard.press("ArrowLeft")
		await expect(page.locator("#modal .qwerty-carousel-count")).toHaveText("1 / 2")
	})

	test("Add Photos stops a Save with no photo before it is sent, and a staged photo's X never locks", async ({ page }) => {
		const saves = posts(page, "/add")
		const collection = hex24()
		await page.goto(`/gallery/${collection}`)
		await page.locator("#add-photos").click()
		await openModal(page)
		await zoneLoaded(page)

		// The zone counts what is missing, and the browser stops the Save in the step's own words
		await expect(status(page)).toHaveText("1 more file needed")
		await page.locator("#inline-save-button").click()
		await expect(page.locator("#htmx-response-message")).toHaveText("At least 1 file is required")
		await expect(status(page)).toHaveText("At least 1 file is required")
		await expect(page.locator("#modal.ready")).toBeVisible()
		expect(saves).toHaveLength(0)

		// One staged photo meets the minimum, and its X stays live, because a new post's minimum is its Save's to enforce
		await drop(page, ["a.png"])
		await expect(page.locator(".upload-multiple-tile[data-value]")).toHaveCount(1)
		await idle(page)
		await expect(status(page)).toHaveText("")
		await expect(page.locator(".upload-multiple-tile .upload-multiple-remove")).toBeEnabled()
	})

	test("Add Photos takes no file while its Save is in flight, and takes one again once the Save is refused", async ({ page }) => {
		const collection = hex24()
		await page.goto(`/gallery/${collection}`)
		await page.locator("#add-photos").click()
		await openModal(page)
		await zoneLoaded(page)

		await drop(page, ["a.png"])
		await expect(page.locator(".upload-multiple-tile[data-value]")).toHaveCount(1)
		await idle(page)

		// The Save is held in flight until the test releases it, then refused as Emissary's WrapInlineError refuses one
		let sent, release
		const sending = new Promise((resolve) => { sent = resolve })
		const held = new Promise((resolve) => { release = resolve })
		await page.route((url) => url.pathname == `/${collection}/add` && url.search == "", async (route) => {
			if (route.request().method() != "POST") return route.continue()
			sent()
			await held
			await route.fulfill({ status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "HX-Retarget": "#htmx-response-message", "HX-Reswap": "innerHTML" }, body: `<span class="warning">The Save was refused</span>` })
		})

		// While the Save is in flight the plus is disabled, and a drop is refused in the status line
		await page.locator("#inline-save-button").click()
		await sending
		await expect(page.locator("#upload-multiple-photos-add")).toBeDisabled()
		await drop(page, ["b.png"])
		await expect(status(page)).toHaveText("Wait for the Save to finish before adding a file")
		await expect(page.locator(".upload-multiple-tile")).toHaveCount(1)

		// Once the Save is refused the plus returns, the message clears, and a drop uploads again
		release()
		await expect(page.locator("#htmx-response-message")).toHaveText("The Save was refused")
		await expect(page.locator("#upload-multiple-photos-add")).toBeEnabled()
		await expect(status(page)).toHaveText("")
		await drop(page, ["b.png"])
		await expect(page.locator(".upload-multiple-tile[data-value]")).toHaveCount(2)
		await idle(page)
	})

	test("Edit Photo uploads a drop at once, sorts from the keyboard, deletes a saved photo, and the carousel follows", async ({ page }) => {
		const collection = hex24()
		const post = await seed(page, collection, ["a.png", "b.png", "c.png"])
		const [a, b, c] = post.files.map((file) => file.id)

		// The row loads the saved photos from the photos action
		await openEditor(page, collection, 3)
		expect(await tileIDs(page)).toEqual([a, b, c])

		// A drop uploads at once, after the saved ones, and the plus stays after them all
		await drop(page, ["d.png"])
		await rowCount(page, 4)
		await expect(page.locator("#upload-multiple-photos-add")).toBeVisible()
		expect(await page.locator(".upload-multiple-tiles").evaluate((row) => row.nextElementSibling.id)).toBe("upload-multiple-photos-add")
		const d = (await files(page, post.id))[3].id
		expect(await tileIDs(page)).toEqual([a, b, c, d])

		// Home moves the new photo to the front from the keyboard, with its tile as the handle, and the order is saved
		await page.locator(`.upload-multiple-tile[data-value="${d}"]`).focus()
		await page.keyboard.press("Home")
		await expect(status(page)).toHaveText("d.png, 1 of 4")
		await expect.poll(async () => (await files(page, post.id)).map((file) => file.id)).toEqual([d, a, b, c])

		// While the sort runs the Xs are held; the server's row then replaces the sorted one, in the saved order
		await expect(page.locator(".upload-multiple-remove:disabled")).toHaveCount(4)
		await idle(page)
		expect(await tileIDs(page)).toEqual([d, a, b, c])
		await expect(page.locator(".upload-multiple-remove:disabled")).toHaveCount(0)

		// The X deletes a saved photo, after the confirm
		await clickX(page, `.upload-multiple-tile[data-value="${a}"]`)
		await rowCount(page, 3)
		expect(await tileIDs(page)).toEqual([d, b, c])

		// Save returns to the modal, whose carousel shows the three in the new order
		await page.locator("#modal button[form='edit-photo-form']").click()
		await expect(page.locator("#modal .qwerty-carousel-slide")).toHaveCount(3)
		await openModal(page)
		expect(await slideIDs(page)).toEqual([d, b, c])
		expect((await files(page, post.id)).map((file) => file.name)).toEqual(["d.png", "b.png", "c.png"])
	})

	test("the last photo cannot be deleted", async ({ page }) => {
		const collection = hex24()
		await seed(page, collection, ["only.png"])

		await openEditor(page, collection, 1)
		await expect(page.locator(".upload-multiple-tile .upload-multiple-remove")).toBeDisabled()
		await expect(page.locator(".upload-multiple-tile .upload-multiple-remove")).toHaveAttribute("title", /Add another file/)
	})

	test("Edit Photo short of its minimum takes a photo, and stops the Save until it has one", async ({ page }) => {
		const saves = posts(page, "/edit")
		const collection = hex24()
		const post = await seed(page, collection, [])

		// A post with no photo has no tile to click, so its editor is opened the way the tile's pencil would open it
		await page.goto(`/gallery/${collection}`)
		await settled(page)
		await page.evaluate((id) => htmx.ajax("GET", `/${id}/edit`, { target: "aside" }), post.id)
		await rowCount(page, 0)
		await openModal(page)

		// The zone counts what is missing, and the browser stops the Save in the step's own words
		await expect(status(page)).toHaveText("1 more file needed")
		await page.locator("#modal button[form='edit-photo-form']").click()
		await expect(page.locator("#htmx-response-message")).toHaveText("At least 1 file is required")
		expect(saves).toHaveLength(0)

		// A drop short of the minimum still uploads, and the Save then goes through
		await drop(page, ["a.png"])
		await rowCount(page, 1)
		await expect(status(page)).toHaveText("")
		expect((await files(page, post.id)).map((file) => file.name)).toEqual(["a.png"])

		await page.locator("#modal button[form='edit-photo-form']").click()
		await expect(page.locator("#modal .qwerty-carousel-slide")).toHaveCount(1)
		expect(saves).toHaveLength(1)
	})

	test("Edit Photo over its maximum still sorts, and stops the Save until a photo is deleted", async ({ page }) => {
		const saves = posts(page, "/edit")
		const collection = hex24()
		const post = await seed(page, collection, Array.from({ length: 17 }, (_, index) => `p${index}.png`))
		const ids = post.files.map((file) => file.id)

		// The row holds all 17, the plus is gone, and the zone counts the extra
		await openEditor(page, collection, 17)
		await expect(page.locator("#upload-multiple-photos-add")).toBeHidden()
		await expect(status(page)).toHaveText("1 file over the limit")

		// A sort is still saved, and keeps every photo
		await page.locator(`.upload-multiple-tile[data-value="${ids[16]}"]`).focus()
		await page.keyboard.press("Home")
		await expect.poll(async () => (await files(page, post.id)).map((file) => file.id)).toEqual([ids[16], ...ids.slice(0, 16)])
		await idle(page)

		// The browser stops the Save in the step's own words
		await page.locator("#modal button[form='edit-photo-form']").click()
		await expect(page.locator("#htmx-response-message")).toHaveText("At most 16 files are allowed")
		expect(saves).toHaveLength(0)

		// Deleting one brings the post within its limits, and the Save goes through
		await clickX(page, `.upload-multiple-tile[data-value="${ids[3]}"]`)
		await rowCount(page, 16)
		await expect(status(page)).toHaveText("")
		await page.locator("#modal button[form='edit-photo-form']").click()
		await expect(page.locator("#modal .qwerty-carousel-slide")).toHaveCount(16)
		expect(saves).toHaveLength(1)
	})
})
