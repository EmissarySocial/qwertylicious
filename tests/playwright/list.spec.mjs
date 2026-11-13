// The list form widget: rows of text inputs that the keys, the grip, the add button, and the Xs edit, posted in
// their order with the form's Save (emissary-specs LIST-WIDGET §1.3). fixtures/list.html holds the markup that
// benpate/form draws, and the ListWidget behavior and its styles are Emissary's own, served from source. Each
// test runs in Chromium and WebKit, light and dark.
import { test, expect } from "@playwright/test"

// rows returns the editable inputs of one list, in their order, leaving out its template's
const rows = (page, id) => page.locator(`#${id} > table > tbody > tr input`)

// values reads one list's values, in their order
const values = (page, id) => rows(page, id).evaluateAll((inputs) => inputs.map((input) => input.value))

// ready opens the fixture and waits for the behavior to install, which it shows by attaching Sortable to every list
async function ready(page) {
	await page.goto("/list")
	await expect.poll(() => page.evaluate(() => window.Sortable !== undefined && document.querySelectorAll(".list-widget > table > tbody").length)).toBe(3)
	await expect.poll(() => page.evaluate(() => Array.from(document.querySelectorAll(".list-widget > table > tbody")).every((tbody) => Object.keys(tbody).some((key) => key.startsWith("Sortable"))))).toBe(true)
}

// save submits the form and returns what the server received
async function save(page) {
	await page.locator("#list-save").click()
	await expect(page.locator("#posted")).not.toBeEmpty()
	return JSON.parse(await page.locator("#posted").textContent())
}

test.describe("list widget", () => {

	test("an empty list draws one blank row, and a list's own values one row each", async ({ page }) => {
		await ready(page)
		expect(await values(page, "empty_list")).toEqual([""])
		expect(await values(page, "tags_list")).toEqual(["alpha", "beta", "gamma"])
		await expect(page.locator("#tags_list .list-add")).toHaveText("Add a Hashtag")
		await expect(page.locator("#empty_list .list-add")).toHaveText("Add a Row")
	})

	test("Enter adds a row below and moves to it, and never submits the form", async ({ page }) => {
		await ready(page)
		await rows(page, "tags_list").nth(0).click()
		await page.keyboard.press("Enter")

		expect(await values(page, "tags_list")).toEqual(["alpha", "", "beta", "gamma"])
		await expect(rows(page, "tags_list").nth(1)).toBeFocused()
		await expect(page.locator("#posted")).toBeEmpty()

		await page.keyboard.type("delta")
		expect(await values(page, "tags_list")).toEqual(["alpha", "delta", "beta", "gamma"])
	})

	test("the add button adds a row at the bottom, and goes at the list's maximum", async ({ page }) => {
		await ready(page)
		const add = page.locator("#tags_list .list-add")

		await add.click()
		expect(await values(page, "tags_list")).toEqual(["alpha", "beta", "gamma", ""])
		await expect(rows(page, "tags_list").nth(3)).toBeFocused()
		await expect(add).toBeHidden()

		// Enter at the maximum adds nothing, and says why
		await page.keyboard.press("Enter")
		expect(await values(page, "tags_list")).toHaveLength(4)
		await expect(page.locator("#tags_list .list-status")).toHaveText("This list holds at most 4")
	})

	test("Backspace in an empty row removes it and moves to the end of the row above", async ({ page }) => {
		await ready(page)
		await rows(page, "tags_list").nth(1).click()
		await page.keyboard.press("Enter")
		await page.keyboard.press("Backspace")

		expect(await values(page, "tags_list")).toEqual(["alpha", "beta", "gamma"])
		const above = rows(page, "tags_list").nth(1)
		await expect(above).toBeFocused()
		expect(await above.evaluate((input) => [input.selectionStart, input.selectionEnd])).toEqual([4, 4])

		// Backspace in a row with text deletes a letter, as it always does
		await page.keyboard.press("Backspace")
		expect(await values(page, "tags_list")).toEqual(["alpha", "bet", "gamma"])
	})

	test("Alt with the arrows, Home, and End moves the row and keeps the cursor", async ({ page }) => {
		await ready(page)
		const status = page.locator("#tags_list .list-status")
		// Plain Home leaves the cursor alone in WebKit, as on macOS, so the selection is set directly
		await rows(page, "tags_list").nth(2).click()
		await rows(page, "tags_list").nth(2).evaluate((input) => input.setSelectionRange(1, 3))

		await page.keyboard.press("Alt+ArrowUp")
		expect(await values(page, "tags_list")).toEqual(["alpha", "gamma", "beta"])
		await expect(status).toHaveText("Moved to 2 of 3")
		const moved = rows(page, "tags_list").nth(1)
		await expect(moved).toBeFocused()
		expect(await moved.evaluate((input) => [input.selectionStart, input.selectionEnd])).toEqual([1, 3])

		await page.keyboard.press("Alt+Home")
		expect(await values(page, "tags_list")).toEqual(["gamma", "alpha", "beta"])
		await expect(status).toHaveText("Moved to 1 of 3")

		await page.keyboard.press("Alt+End")
		expect(await values(page, "tags_list")).toEqual(["alpha", "beta", "gamma"])
		await expect(status).toHaveText("Moved to 3 of 3")

		await page.keyboard.press("Alt+ArrowDown")
		expect(await values(page, "tags_list")).toEqual(["alpha", "beta", "gamma"])

		await page.keyboard.press("Alt+ArrowUp")
		expect(await values(page, "tags_list")).toEqual(["alpha", "gamma", "beta"])
		await expect(rows(page, "tags_list").nth(1)).toBeFocused()
	})

	test("a drag from the grip moves the row", async ({ page }) => {
		await ready(page)
		const grip = page.locator("#tags_list > table > tbody > tr").nth(2).locator(".list-handle")
		const target = page.locator("#tags_list > table > tbody > tr").nth(0)

		// RULE: Sortable ignores a move while its 150ms animation runs, so the pointer climbs one row at a time
		const from = await grip.boundingBox()
		const to = await target.boundingBox()
		const x = from.x + from.width / 2
		await page.mouse.move(x, from.y + from.height / 2)
		await page.mouse.down()
		for (const y of [from.y - to.height / 2, to.y + to.height / 4]) {
			await page.mouse.move(x, y, { steps: 8 })
			await page.waitForTimeout(250)
		}
		await page.mouse.up()

		await expect.poll(() => values(page, "tags_list")).toEqual(["gamma", "alpha", "beta"])
		await expect(page.locator("#tags_list .list-status")).toHaveText("Moved to 1 of 3")
	})

	test("the X removes its row, and the only row is cleared instead", async ({ page }) => {
		await ready(page)
		await page.locator("#tags_list > table > tbody > tr").nth(1).locator(".list-remove").click()
		expect(await values(page, "tags_list")).toEqual(["alpha", "gamma"])
		await expect(rows(page, "tags_list").nth(1)).toBeFocused()

		await rows(page, "empty_list").first().fill("solo")
		await page.locator("#empty_list .list-remove").click()
		expect(await values(page, "empty_list")).toEqual([""])
	})

	test("a repeat is marked while it is typed, and unmarked when it changes", async ({ page }) => {
		await ready(page)
		await page.locator("#tags_list .list-add").click()
		await page.keyboard.type(" ALPHA ")

		const row = page.locator("#tags_list > table > tbody > tr").nth(3)
		await expect(row).toHaveClass(/list-repeat/)
		await expect(rows(page, "tags_list").nth(3)).toHaveAttribute("aria-description", /Repeats an earlier row/)

		await page.keyboard.press("Backspace")
		await page.keyboard.press("Backspace")
		await expect(row).not.toHaveClass(/list-repeat/)
		await expect(rows(page, "tags_list").nth(3)).not.toHaveAttribute("aria-description")
	})

	test("the Xs are disabled at the list's minimum, and a Save below it is stopped", async ({ page }) => {
		await ready(page)
		const removes = page.locator("#minimum_list > table > tbody > tr .list-remove")
		await expect(removes).toHaveCount(2)
		await expect(removes.nth(0)).toBeDisabled()
		await expect(removes.nth(1)).toBeDisabled()

		// A blank row keeps nothing, so one value is short of two and the browser refuses the Save
		await rows(page, "minimum_list").nth(1).fill("")
		const first = rows(page, "minimum_list").nth(0)
		expect(await first.evaluate((input) => input.validationMessage)).toBe("Add at least 2 values")
		await page.locator("#list-save").click()
		await expect(page.locator("#posted")).toBeEmpty()

		// A second value lets it through
		await rows(page, "minimum_list").nth(1).fill("three")
		expect(await first.evaluate((input) => input.validationMessage)).toBe("")
		const posted = await save(page)
		expect(posted.minimum).toEqual(["one", "three"])
	})

	test("the Save posts every row in its order", async ({ page }) => {
		await ready(page)
		await rows(page, "tags_list").nth(0).click()
		await page.keyboard.press("Alt+End")
		await rows(page, "empty_list").first().fill("only")

		const posted = await save(page)
		expect(posted.tags).toEqual(["beta", "gamma", "alpha"])
		expect(posted.empty).toEqual(["only"])
		expect(posted.minimum).toEqual(["one", "two"])
	})

	test("a focused row is ringed whole, grip and X included, and its cell is not ringed on its own", async ({ page }) => {
		await ready(page)
		const row = page.locator("#tags_list > table > tbody > tr").nth(1)
		await rows(page, "tags_list").nth(1).click()

		const ring = await row.evaluate((element) => getComputedStyle(element).outlineStyle + " " + getComputedStyle(element).outlineWidth)
		expect(ring).toBe("solid 2px")
		const cell = rows(page, "tags_list").nth(1).locator("xpath=..")
		expect(await cell.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("none")
		expect(await page.locator("#tags_list > table > tbody > tr").nth(0).evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("none")
	})

	test("the X is a round button in the theme's colors, at rest and under the mouse", async ({ page }) => {
		await ready(page)
		const remove = page.locator("#tags_list .list-remove").first()
		const transparent = /rgba\(0, 0, 0, 0\)|transparent/

		const rest = await remove.evaluate((button) => getComputedStyle(button).backgroundColor)
		expect(rest).not.toMatch(transparent)
		expect(await remove.evaluate((button) => getComputedStyle(button).borderRadius)).toBe("50%")

		await remove.hover()
		const hover = await remove.evaluate((button) => getComputedStyle(button).backgroundColor)
		expect(hover).not.toMatch(transparent)
		expect(hover).not.toBe(rest)
	})
})
