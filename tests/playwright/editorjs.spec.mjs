// The Visual Editor: a pasted line break reaches the saved document (emissary-specs BUG-326).
// Each runs in Chromium and WebKit, light and dark (playwright.config.mjs). EditorJS loads from jsdelivr.
import { test, expect } from "@playwright/test"

// The qwerty-article editor, and Emissary's stream-article-editorjs editor, which share the fix
const editors = [["qwertylicious", "/editorjs"], ["emissary", "/editorjs-emissary"]]

// openEditor loads an editor and waits until EditorJS has drawn its first, empty paragraph
async function openEditor(page, path) {
	await page.goto(path)
	await page.waitForFunction(() => window.editor !== undefined)
	await page.evaluate(() => window.editor.isReady)
	return page.locator("#content-editor .ce-paragraph").first()
}

// paste dispatches a paste of this HTML into an element, as the browser does for Cmd+V
async function paste(target, html, text) {
	await target.click()
	await target.evaluate((element, [html, text]) => {
		const data = new DataTransfer()
		data.setData("text/html", html)
		data.setData("text/plain", text)
		element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }))
	}, [html, text])
}

// savedTexts is the text of every block that editor.save() returns
function savedTexts(page) {
	return page.evaluate(async () => (await window.editor.save()).blocks.map((block) => block.data.text))
}

for (const [name, path] of editors) {
	test.describe(`${name} visual editor`, () => {

		test("a line break pasted into a paragraph is saved", async ({ page }) => {
			const paragraph = await openEditor(page, path)
			await paste(paragraph, "one<br>two", "one\ntwo")
			await expect.poll(() => savedTexts(page)).toEqual(["one<br>two"])
		})

		test("a line break pasted inside a pasted paragraph is saved", async ({ page }) => {
			const paragraph = await openEditor(page, path)
			await paste(paragraph, "<p>one<br>two</p><p>three</p>", "one\ntwo\n\nthree")
			await expect.poll(() => savedTexts(page)).toEqual(["one<br>two", "three"])
		})
	})
}
