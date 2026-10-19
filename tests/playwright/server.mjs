// A test server for the Playwright specs. It serves the stylesheets and scripts that a real page loads,
// concatenated from source on every request, and fixture pages that copy the rendered markup.
// Where a spec checks one piece of markup, the fixture takes it from the template file itself (see README.md).
import { createServer } from "node:http"
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const qwerty = resolve(process.env.QWERTY_DIR || join(here, "../.."))
const emissary = resolve(process.env.EMISSARY_DIR || join(qwerty, "../emissary"))
const templates = join(emissary, "_embed/templates")
const port = Number(process.argv[2] || 8777)

if (!existsSync(templates)) {
	console.error(`Emissary not found at ${emissary}; set EMISSARY_DIR`)
	process.exit(1)
}

// The episodes, in the list's order
const episodes = [
	{ id: "6ad24ab9c00dfca0c02cd451", title: "Episode Three: A Title Long Enough to Wrap Onto a Second Line" },
	{ id: "6ad24ab9c00dfca0c02cd450", title: "Episode Two" },
	{ id: "6ad24ab9c00dfca0c02cd452", title: "Episode One" },
]

// concat joins every file in a folder, in name order, as a bundle does
function concat(folder) {
	return readdirSync(folder).filter((name) => !name.startsWith(".")).sort()
		.map((name) => readFileSync(join(folder, name), "utf8")).join("\n")
}

function read(path) {
	return readFileSync(path, "utf8")
}

// stripComments removes HTML comments, as the minifier does before Go parses a view
function stripComments(html) {
	return html.replace(/<!--[\s\S]*?-->/g, "")
}

// icons turns {{icon "name"}} into the Bootstrap icon it renders
function icons(html) {
	return html.replace(/\{\{icon "([^"]+)"\}\}/g, '<i class="bi bi-$1"></i>')
}

// arrow renders episode-arrow-back.html or episode-arrow-next.html: enabled for a neighbor, disabled for none
function arrow(file, neighbor) {
	const source = stripComments(read(join(qwerty, "qwerty-episode", file)))
	const [enabled, disabled] = source.split("{{- else -}}")
	const chosen = neighbor ? enabled : disabled
	return icons(chosen.replace(/\{\{-? ?(if|end)[^}]*\}\}/g, "")).trim()
}

// heading is the episode title's opening tag, exactly as qwerty-episode/modal.html writes it
function heading() {
	const match = stripComments(read(join(qwerty, "qwerty-episode/modal.html"))).match(/<h2[^>]*>/)
	return match[0]
}

// dateCell is the list's date cell from qwerty-collection/items-podcast.html, with the date filled in
function dateCell() {
	const source = stripComments(read(join(qwerty, "qwerty-collection/items-podcast.html")))
	const cell = source.match(/<td class="qwerty-podcast-date[\s\S]*?<\/td>/)[0]
	return cell.replace(/\{\{-? ?\.PublishDate[^}]*\}\}/, "Oct 9, 2025").replace(/\{\{[^}]*\}\}[^<]*<span[^>]*>[^<]*<\/span>\{\{[^}]*\}\}/, "")
}

function episodeModal(index) {
	const episode = episodes[index]
	const above = episodes[index - 1]
	const below = episodes[index + 1]
	const link = (kind, neighbor) => neighbor ? `<a class="qwerty-episode-${kind}" hidden aria-hidden="true" tabindex="-1" href="/${neighbor.id}" data-episode-id="${neighbor.id}" hx-get="/${neighbor.id}/modal" hx-target="aside" hx-push-url="false">${kind}</a>` : ""
	return read(join(here, "fixtures/episode-modal.html"))
		.replaceAll("${H2}", heading())
		.replaceAll("${ID}", episode.id)
		.replaceAll("${TITLE}", episode.title)
		.replaceAll("${BACK}", arrow("episode-arrow-back.html", above))
		.replaceAll("${NEXT}", arrow("episode-arrow-next.html", below))
		.replaceAll("${LINKS}", link("prev", above) + link("next", below))
}

function page(body) {
	return read(join(here, "fixtures/shell.html")).replace("${BODY}", body)
}

const routes = {
	"/healthz": () => ["text/plain", "ok"],
	"/css": () => ["text/css", [
		concat(join(templates, "theme-global/stylesheet")),
		concat(join(templates, "theme-default/stylesheet")),
		concat(join(qwerty, "qwerty-theme/stylesheet")),
		concat(join(qwerty, "qwerty-outbox/stylesheet")),
	].join("\n")],
	"/js/htmx.js": () => ["text/javascript", read(join(templates, "theme-global/resources/htmx-1.9.12/htmx.min.js"))],
	"/js/hyperscript.js": () => ["text/javascript", read(join(templates, "theme-global/resources/hyperscript-0.9.93/_hyperscript.min.js"))],
	"/js/global.js": () => ["text/javascript", concat(join(templates, "theme-global/javascript"))],
	"/hs/global.hs": () => ["text/hyperscript", concat(join(templates, "theme-global/hyperscript"))],
	"/js/podcast.js": () => ["text/javascript", concat(join(qwerty, "qwerty-theme/podcast"))],
	"/episode": () => ["text/html", page(`<aside>${episodeModal(0)}</aside>`)],
	"/podcast-list": () => ["text/html", page(read(join(here, "fixtures/podcast-list.html")).replace("${DATE}", dateCell()))],
}

createServer((request, response) => {
	const path = new URL(request.url, "http://x").pathname

	// The bootstrap icons, as static files
	if (path.startsWith("/icons/")) {
		const file = join(templates, "theme-global/resources/bootstrap-icons-1.13.1", path.slice(7).replace(/\.\./g, ""))
		if (existsSync(file)) {
			response.writeHead(200, { "Content-Type": file.endsWith(".css") ? "text/css" : "font/woff2" })
			return response.end(readFileSync(file))
		}
	}

	// An episode's modal, with the headers Emissary's as-modal sends
	const modal = path.match(/^\/([0-9a-f]{24})\/modal$/)
	if (modal) {
		const index = episodes.findIndex((episode) => episode.id == modal[1])
		if (index >= 0) {
			response.writeHead(200, { "Content-Type": "text/html", "HX-Retarget": "aside", "HX-Reswap": "innerHTML", "HX-Push-Url": "false" })
			return response.end(episodeModal(index))
		}
	}

	if (routes[path]) {
		const [type, body] = routes[path]()
		response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" })
		return response.end(body)
	}

	response.writeHead(404)
	response.end("not found")
}).listen(port, "127.0.0.1", () => console.log(`fixtures on http://127.0.0.1:${port}`))
