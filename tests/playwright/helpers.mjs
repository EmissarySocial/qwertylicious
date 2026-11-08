// Shared helpers for the specs: colors as [r, g, b, a] numbers, whatever syntax the browser reports them in,
// and <main>'s scroll position sampled on every frame, for the specs that check a swap never moves the page.

// rgba reads one CSS property of an element as [r, g, b, a], drawn through a canvas so every color syntax compares
export async function rgba(locator, property = "background-color") {
	return locator.evaluate((element, property) => {
		const canvas = document.createElement("canvas")
		canvas.width = canvas.height = 1
		const context = canvas.getContext("2d")
		context.fillStyle = getComputedStyle(element).getPropertyValue(property)
		context.fillRect(0, 0, 1, 1)
		const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
		return [r, g, b, a / 255]
	}, property)
}

// luminance is a color's perceived brightness, 0 to 255
export function luminance([r, g, b]) {
	return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// pixels reads the screen's colors at a list of points, from a screenshot
export async function pixels(page, points) {
	const png = (await page.screenshot()).toString("base64")
	return page.evaluate(async ({ png, points }) => {
		const image = new Image()
		image.src = "data:image/png;base64," + png
		await image.decode()
		const canvas = document.createElement("canvas")
		canvas.width = image.width
		canvas.height = image.height
		const context = canvas.getContext("2d")
		context.drawImage(image, 0, 0)
		const scale = image.width / window.innerWidth
		return points.map(([x, y]) => [...context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data].slice(0, 3))
	}, { png, points })
}

// sampleScroll records <main>'s scroll position on every frame for the next 1.5 seconds; scrollSamples reads them back
export async function sampleScroll(page) {
	await page.evaluate(() => {
		const main = document.querySelector("main")
		window.__scroll = []
		const until = performance.now() + 1500
		const tick = () => {
			window.__scroll.push(Math.round(main.scrollTop))
			if (performance.now() < until) requestAnimationFrame(tick)
		}
		requestAnimationFrame(tick)
	})
}

export async function scrollSamples(page) {
	await page.waitForTimeout(1600)
	return page.evaluate(() => window.__scroll)
}

// movingFrames counts the frames whose scroll position differs from the frame before
export function movingFrames(samples) {
	return samples.filter((top, index) => index > 0 && top != samples[index - 1]).length
}
