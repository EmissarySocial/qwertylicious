// Emissary's Clipboard behavior, on the profile's handle, which copies the full @user@host.
// Each runs in Chromium and WebKit, light and dark (playwright.config.mjs).
import { test, expect } from "@playwright/test"

// withClipboard replaces the clipboard API with one that records what it was given, then settles as asked
async function withClipboard(page, outcome) {
	await page.addInitScript((outcome) => {
		const clipboard = {
			writeText(text) {
				if (this !== clipboard) throw new TypeError("Illegal invocation")
				window.copied = text
				if (outcome == "resolve") return Promise.resolve()
				return Promise.reject(new DOMException("Copy refused", "NotAllowedError"))
			},
		}
		Object.defineProperty(Navigator.prototype, "clipboard", { configurable: true, get: () => clipboard })
	}, outcome)
}

// withoutClipboard removes the clipboard API, as plain http does, and records the textarea each execCommand copies from
async function withoutClipboard(page, copied) {
	await page.addInitScript((copied) => {
		delete Navigator.prototype.clipboard
		window.commands = []
		Document.prototype.execCommand = function (command) {
			const textarea = document.querySelector("body > textarea")
			window.commands.push({
				command,
				value: textarea?.value,
				selected: textarea ? textarea.value.slice(textarea.selectionStart, textarea.selectionEnd) : null,
				readonly: textarea?.hasAttribute("readonly"),
				position: textarea?.style.position,
			})
			return copied
		}
	}, copied)
}

// consoleErrors collects every console error the page logs from now on
function consoleErrors(page) {
	const errors = []
	page.on("console", (message) => { if (message.type() == "error") errors.push(message.text()) })
	page.on("pageerror", (error) => errors.push(error.message))
	return errors
}

test.describe("Clipboard", () => {

	const button = "#profile-username .clipboard-copy-button"
	const feedback = "#profile-username .clipboard-copy-feedback"

	test("copies the full handle with the clipboard API, then says so", async ({ page }) => {
		await withClipboard(page, "resolve")
		await page.goto("/handle")

		await page.locator(button).click()
		await expect.poll(() => page.evaluate(() => window.copied)).toBe("@author@example.social")
		await expect(page.locator(feedback)).toBeVisible()
		await expect(page.locator(button)).toBeHidden()

		// After 1.5s, the handle comes back
		await expect(page.locator(button)).toBeVisible({ timeout: 3000 })
		await expect(page.locator(feedback)).toBeHidden()
	})

	test("a refused clipboard says nothing and logs the refusal", async ({ page }) => {
		await withClipboard(page, "reject")
		await page.goto("/handle")

		const errors = consoleErrors(page)
		await page.locator(button).click()
		await expect.poll(() => errors.join("\n")).toContain("Copy refused")
		await expect(page.locator(feedback)).toBeHidden()
		await expect(page.locator(button)).toBeVisible()
	})

	test("over plain http, copies from a hidden textarea and removes it", async ({ page }) => {
		await withoutClipboard(page, true)
		await page.goto("/handle")

		await page.locator(button).click()
		await expect(page.locator(feedback)).toBeVisible()

		const commands = await page.evaluate(() => window.commands)
		expect(commands).toEqual([{ command: "copy", value: "@author@example.social", selected: "@author@example.social", readonly: true, position: "fixed" }])
		await expect(page.locator("body > textarea")).toHaveCount(0)
	})

	test("over plain http, a copy that fails says nothing and logs it", async ({ page }) => {
		await withoutClipboard(page, false)
		await page.goto("/handle")

		const errors = consoleErrors(page)
		await page.locator(button).click()
		await expect.poll(() => errors.join("\n")).toContain("Unable to copy to the clipboard")
		await expect(page.locator(feedback)).toBeHidden()
		await expect(page.locator("body > textarea")).toHaveCount(0)
	})
})
