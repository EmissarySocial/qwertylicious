// A test server for the Playwright specs. It serves the stylesheets and scripts that a real page loads,
// concatenated from source on every request, and fixture pages that copy the rendered markup.
// Where a spec checks one piece of markup, the fixture takes it from the template file itself (see README.md).
import { createServer } from "node:http"
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { deflateSync } from "node:zlib"

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

// The Timeline entries, in the tab's order
const entries = [
	{ id: "6ad6445b9d33845fe83e2a01", title: "Declaration of Independence", date: "Thursday, July 4, 1776", short: "Jul 4, 1776" },
	{ id: "6ad6445b9d33845fe83e2a02", title: "Constitution Signed", date: "Monday, September 17, 1787", short: "Sep 17, 1787" },
	{ id: "6ad6445b9d33845fe83e2a03", title: "Constitution Ratified", date: "Saturday, June 21, 1788", short: "Jun 21, 1788" },
]

// The Calendar event, opened from its calendar
const calendarEvent = { id: "6ad7aa00094d4ab2cbcc8701", title: "Concert in the Park", date: "Saturday, July 18, 2026" }

// The photo posts the photo spec makes, keyed by post id, each holding its files in rank order.
// A collection id comes from the spec, so tests running at once never share a post.
const photoPosts = new Map()
let photoSerial = 0

// The files staged under the user by Add Photos, keyed by file id, until a Save adopts them
const stagedFiles = new Map()

// The limits of qwerty-photo's photos action
const photoMinimum = 1
const photoMaximum = 16

// The headers Emissary's as-modal sends
const modalHeaders = { "HX-Retarget": "aside", "HX-Reswap": "innerHTML", "HX-Push-Url": "false" }

// photoID mints a 24-hex id, shaped like Emissary's, under a prefix that tells posts from files
function photoID(prefix) {
	photoSerial++
	return prefix + photoSerial.toString(16).padStart(20, "0")
}

// newPhotoFile is one stored attachment
function newPhotoFile(file) {
	return { id: photoID("6ada"), name: file.name, type: file.type || "image/png" }
}

// newPhotoPost stores a post of these files in the collection, as the create action's include does
function newPhotoPost(collection, files) {
	const post = { id: photoID("6ad9"), collection, files: files.map(newPhotoFile) }
	photoPosts.set(post.id, post)
	return post
}

// postsIn lists a collection's posts, newest first, as the gallery does
function postsIn(collection) {
	return [...photoPosts.values()].filter((post) => post.collection == collection).reverse()
}

// reorderPhotos puts the named files first, in the order named, and keeps the rest after them,
// as Emissary's Attachment.Reorder does
function reorderPhotos(post, order) {
	const named = order.map((id) => post.files.find((file) => file.id == id)).filter((file) => file != null)
	post.files = [...new Set([...named, ...post.files])]
}

// crcTable, crc32, pngChunk, and png make a solid-color PNG, so every preview and slide is a real image
const crcTable = Array.from({ length: 256 }, (_, n) => {
	let c = n
	for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
	return c >>> 0
})

function crc32(buffer) {
	let c = 0xffffffff
	for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
	return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
	const length = Buffer.alloc(4)
	length.writeUInt32BE(data.length)
	const body = Buffer.concat([Buffer.from(type), data])
	const crc = Buffer.alloc(4)
	crc.writeUInt32BE(crc32(body))
	return Buffer.concat([length, body, crc])
}

function png(width, height, [r, g, b]) {
	const stride = width * 3 + 1
	const raw = Buffer.alloc(stride * height)
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) raw.set([r, g, b], y * stride + 1 + x * 3)
	}
	const header = Buffer.alloc(13)
	header.writeUInt32BE(width, 0)
	header.writeUInt32BE(height, 4)
	header[8] = 8
	header[9] = 2
	return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))])
}

function escapeHTML(text) {
	return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]))
}

// photoRow draws the tile row as Emissary's edit-attachments step does, with the limits as data attributes
function photoRow(post) {
	const url = `/${post.id}/photos`
	const tiles = post.files.map((file) => photoTile(post, url, file)).join("")
	return `<div class="upload-multiple-tiles" data-url="${url}" data-name="photos" data-accept="image/*" data-minimum="${photoMinimum}" data-maximum="${photoMaximum}" hx-params="photos,photos.order" hx-push-url="false" hx-sync="closest .upload-multiple:queue all" hx-encoding="multipart/form-data">${tiles}</div>`
}

// zone wraps what the step answers a GET with in the zone it draws, which the html-remote element's shell receives
function zone(inner) {
	return `<div class="upload-multiple" data-upload-multiple="true">${inner}</div>`
}

// readOnlyRow draws the row as the step does with ?readonly=true: the previews alone, marked so the script leaves it be
function readOnlyRow(post) {
	const tiles = post.files.map((file) => `<div class="upload-multiple-tile" data-value="${file.id}" data-group="image"><img src="/${post.id}/attachments/${file.id}?width=300" class="upload-multiple-preview" alt="${escapeHTML(file.name)}" draggable="false"></div>`).join("")
	return `<div class="upload-multiple-tiles" data-readonly="true">${tiles}</div>`
}

// stagingRow draws a create form's row as edit-attachments does on an unsaved post: empty, and wired to post each file back through the collection's add
function stagingRow(collection) {
	const url = `/${collection}/add?action=photos`
	return `<div class="upload-multiple-tiles" data-staging-url="${url}" data-name="photos" data-accept="image/*" data-minimum="${photoMinimum}" data-maximum="${photoMaximum}" hx-params="photos" hx-push-url="false" hx-sync="closest .upload-multiple:queue all" hx-encoding="multipart/form-data"></div>`
}

// controls draws what follows the row inside the zone, as Emissary's writeControls does: the plus, the hidden file input, and the status line
function controls() {
	return `<button id="upload-multiple-photos-add" type="button" class="upload-multiple-add" title="Add a file" aria-label="Add a file"><i class="bi bi-plus-lg"></i></button><input type="file" name="photos" id="upload-multiple-photos-input" accept="image/*" hidden="hidden" aria-label="Add a file"><div id="upload-multiple-photos-status" class="upload-multiple-status" role="status"></div>`
}

// photoTile is one saved file in the row: its preview, which is its handle, its X, and its place in the order
function photoTile(post, url, file) {
	return tile(`/${post.id}`, url, file, "photos.order", "closest .upload-multiple-tiles", "Delete this file?")
}

// stagedTile is one staged file, as edit-attachments draws it on an unsaved post: its X posts back through the collection's add and replaces the tile alone, with no confirm
function stagedTile(file, collection) {
	return tile("/@me", `/${collection}/add?action=photos`, file, file.field + ".order", "closest .upload-multiple-tile", "")
}

// tile draws one file as Emissary's drawTile does
function tile(base, url, file, orderName, target, confirm) {
	const name = escapeHTML(file.name)
	const confirmAttr = confirm == "" ? "" : ` hx-confirm="${confirm}"`
	// The delete's attachmentId follows the URL's own query when it has one, as a staged tile's does
	const deleteURL = `${url}${url.includes("?") ? "&amp;" : "?"}attachmentId=${file.id}`
	return `<div class="upload-multiple-tile hover-trigger" data-value="${file.id}" data-group="image" tabindex="0" aria-label="Move ${name}"><img src="${base}/attachments/${file.id}?width=300" class="upload-multiple-preview" alt="${name}" draggable="false"><button type="button" class="upload-multiple-remove hover-show" hx-post="${deleteURL}" hx-params="none"${confirmAttr} hx-target="${target}" hx-swap="outerHTML" hx-push-url="false" hx-sync="closest .upload-multiple:queue all" aria-label="Delete ${name}"><i class="bi bi-x-lg"></i></button><input type="hidden" name="${orderName}" value="${file.id}"></div>`
}

// photoFigure is a post's carousel, as qwerty-photo/photo-figure.html draws it for a post with no title or caption
function photoFigure(post) {
	const count = post.files.length
	const slides = post.files.map((file, index) => `<div class="qwerty-carousel-slide pos-relative"><img src="/${post.id}/attachments/${file.id}.webp?width=1600" alt="Photo ${index + 1} of ${count}" loading="${index == 0 ? "eager" : "lazy"}" draggable="false"></div>`).join("")
	const controls = count > 1 ? `<button type="button" class="qwerty-carousel-prev" data-carousel="prev" aria-label="Previous Photo" disabled><i class="bi bi-arrow-left"></i></button><button type="button" class="qwerty-carousel-next" data-carousel="next" aria-label="Next Photo"><i class="bi bi-arrow-right"></i></button><div class="qwerty-carousel-count text-xs" aria-live="polite">1 / ${count}</div>` : ""
	return `<figure class="margin-none"><div class="qwerty-carousel pos-relative"><div class="qwerty-carousel-stage"><div class="qwerty-carousel-track">${slides}</div></div>${controls}</div><figcaption class="margin-top"></figcaption></figure>`
}

// cornerButtons is the pencil and X block of a photo's view, taken from the template file, with the id filled in
function cornerButtons(file, id) {
	const source = stripComments(read(join(qwerty, "qwerty-photo", file)))
	const block = source.match(/<div class="corner-pencil[\s\S]*?<\/div>/)[0]
	return icons(block.replace(/\{\{-? ?(if|end)[^}]*\}\}/g, "")).replaceAll("{{.StreamID}}", id)
}

function photoModal(post) {
	return read(join(here, "fixtures/photo-modal.html"))
		.replaceAll("${CORNER}", cornerButtons("modal.html", post.id))
		.replaceAll("${FIGURE}", photoFigure(post))
}

function photoEdit(post) {
	return read(join(here, "fixtures/photo-edit.html"))
		.replaceAll("${PENCIL}", cornerButtons("edit-pencil.html", post.id))
		.replaceAll("${ID}", post.id)
}

function photoCreate(collection) {
	return read(join(here, "fixtures/photo-create.html")).replaceAll("${COLLECTION}", collection)
}

// galleryTiles draws a collection's posts for their owner, as qwerty-collection/gallery-tiles.html does,
// or the welcome of qwerty-collection/items-empty.html
function galleryTiles(collection) {
	const posts = postsIn(collection)
	if (posts.length == 0) {
		return `<div class="align-center margin-vertical-xl"><div class="text-2xl margin-none">Your Photo Gallery</div><div class="margin-vertical max-width-512 margin-horizontal-auto">This gallery shows off your photos, newest first.  Each post holds up to 16.  Add your first one now.</div><button class="primary turboclick margin-top-lg" hx-get="/${collection}/add" hx-push-url="false">+ Add Photos</button></div>`
	}
	const tiles = posts.map((post) => {
		const mark = post.files.length > 1 ? `<span class="qwerty-gallery-mark" aria-hidden="true"><i class="bi bi-images"></i></span>` : ""
		// A post seeded with no photo, short of its minimum, draws an empty tile
		const cover = post.files.length > 0 ? `<img src="/${post.id}/attachments/${post.files[0].id}.webp?width=480&height=480" alt="" loading="lazy">` : ""
		return `<div role="button" tabindex="0" class="qwerty-gallery-item hover-trigger turboclick" hx-get="/${post.id}/modal" hx-push-url="false" aria-label="Photo">${cover}${mark}<div class="hover-show pos-absolute-top-right"><button type="button" class="edit-circle turboclick" hx-get="/${post.id}/edit" hx-trigger="click consume" hx-push-url="false" aria-label="Edit" title="Edit"><i class="bi bi-pencil"></i></button></div></div>`
	}).join("")
	return `<div class="qwerty-gallery">${tiles}</div>`
}

// readBody collects a request's body
async function readBody(request) {
	const chunks = []
	for await (const chunk of request) chunks.push(chunk)
	return Buffer.concat(chunks)
}

// formData reads a POST body as htmx sends it, multipart or url-encoded
async function formData(request) {
	const type = request.headers["content-type"] || "application/x-www-form-urlencoded"
	return new Response(await readBody(request), { headers: { "content-type": type } }).formData()
}

// postedFiles returns the files a form posted under the name, leaving out empty fields
function postedFiles(form, name) {
	return form.getAll(name).filter((value) => typeof value != "string" && value.name != "")
}

// inlineError answers as Emissary's WrapInlineError does: 200, retargeted to the form's message span
function inlineError(response, message) {
	response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "HX-Reswap": "innerHTML", "HX-Retarget": "#htmx-response-message" })
	response.end(`<span class="warning">${escapeHTML(message)}</span>`)
}

function htmlResponse(response, body, headers = {}) {
	response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...headers })
	response.end(body)
}

function jsonResponse(response, value) {
	response.writeHead(200, { "Content-Type": "application/json" })
	response.end(JSON.stringify(value))
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// photosAction answers the photos action as edit-attachments does: GET draws the zone's contents, read-only on
// request, and a POST deletes one file, or stores the posted files and applies the posted order, then draws the row
async function photosAction(request, response, post, query) {

	if (request.method != "POST") {
		if (query.get("readonly") == "true") {
			return htmlResponse(response, zone(readOnlyRow(post)))
		}
		return htmlResponse(response, zone(photoRow(post) + controls()))
	}

	const attachmentId = query.get("attachmentId")

	if (attachmentId != null) {
		if (post.files.length - 1 < photoMinimum) {
			return inlineError(response, "At least 1 file is required")
		}
		if (!post.files.some((file) => file.id == attachmentId)) {
			response.writeHead(400)
			return response.end("Attachment is not on this object")
		}
		post.files = post.files.filter((file) => file.id != attachmentId)
		await sleep(200)
		return htmlResponse(response, photoRow(post))
	}

	const form = await formData(request)
	const files = postedFiles(form, "photos")

	// An add past the maximum is refused; a sort adds nothing, so it goes through even when the post is over
	if (files.length > 0 && post.files.length + files.length > photoMaximum) {
		return inlineError(response, `At most ${photoMaximum} files are allowed`)
	}

	for (const file of files) post.files.push(newPhotoFile(file))
	reorderPhotos(post, form.getAll("photos.order"))
	await sleep(200)
	htmlResponse(response, photoRow(post))
}

// stagingAction answers the collection's add with ?action= as Emissary's add-stream does: it runs the named action on
// the unsaved post, which is edit-attachments on photos and nothing else, since create includes only that action. GET
// draws a create form's zone, a POST stores the one posted file under the user and draws its tile alone, and
// ?attachmentId= deletes one staged file and answers nothing
async function stagingAction(request, response, query, collection) {

	if (query.get("action") != "photos") {
		response.writeHead(400)
		return response.end("The create action does not include this action")
	}

	if (request.method != "POST") {
		return htmlResponse(response, zone(stagingRow(collection) + controls()))
	}

	const attachmentId = query.get("attachmentId")

	if (attachmentId != null) {
		if (!stagedFiles.delete(attachmentId)) {
			response.writeHead(400)
			return response.end("Attachment is not on this object")
		}
		await sleep(200)
		return htmlResponse(response, "")
	}

	const form = await formData(request)
	const posted = [...form.entries()].filter(([, value]) => typeof value != "string" && value.name != "")

	if (posted.length != 1) {
		response.writeHead(400)
		return response.end("One file at a time")
	}

	const [field, upload] = posted[0]
	const file = { ...newPhotoFile(upload), field }
	stagedFiles.set(file.id, file)
	await sleep(200)
	htmlResponse(response, stagedTile(file, collection))
}

// adoptStaged takes the staged files the order names out of staging, in the order named, up to the room left, as the
// create action's include does; a file past the room stays staged
function adoptStaged(order, room) {
	const adopted = []
	for (const id of order) {
		if (adopted.length >= room) break
		const file = stagedFiles.get(id)
		if (file != null) {
			adopted.push({ name: file.name, type: file.type })
			stagedFiles.delete(id)
		}
	}
	return adopted
}

// photoRoute answers the photo spec's pages and actions, and returns false for any other path
async function photoRoute(request, response, path, query) {

	const hex = "[0-9a-f]{24}"
	let match

	// A staged file's preview, and the staged files for a spec to check
	if (path == "/staged") {
		jsonResponse(response, [...stagedFiles.values()])
		return true
	}

	// A photo's preview or slide: a solid-color image of its own
	if ((match = path.match(new RegExp(`^/(?:${hex}|@me)/attachments/(${hex})`)))) {
		const serial = parseInt(match[1].slice(-6), 16)
		response.writeHead(200, { "Content-Type": "image/png" })
		response.end(png(64, 48, [(serial * 70) % 256, (serial * 130) % 256, (serial * 190) % 256]))
		return true
	}

	if ((match = path.match(new RegExp(`^/gallery/(${hex})$`)))) {
		htmlResponse(response, page(read(join(here, "fixtures/gallery.html")).replaceAll("${COLLECTION}", match[1])))
		return true
	}

	if ((match = path.match(new RegExp(`^/(${hex})/tiles$`)))) {
		htmlResponse(response, galleryTiles(match[1]))
		return true
	}

	// The collection's add: the create form in a modal, and the POST that adopts the staged files its order names,
	// and stores any file posted with it, as the create action's include does; with ?action= it runs that action on
	// the unsaved post instead, which is where the widget stages each file before the Save
	if ((match = path.match(new RegExp(`^/(${hex})/add$`)))) {
		if (query.has("action")) {
			await stagingAction(request, response, query, match[1])
			return true
		}
		if (request.method != "POST") {
			htmlResponse(response, photoCreate(match[1]), modalHeaders)
			return true
		}
		// The Save keeps what fits under the maximum, the posted files first, and drops the rest
		const form = await formData(request)
		const posted = postedFiles(form, "photos").slice(0, photoMaximum)
		const files = [...posted, ...adoptStaged(form.getAll("photos.order"), photoMaximum - posted.length)]
		if (files.length < photoMinimum) {
			inlineError(response, "At least 1 file is required")
			return true
		}
		newPhotoPost(match[1], files)
		htmlResponse(response, "", { "HX-Trigger": '{"closeModal":"true","refreshPage":"true"}' })
		return true
	}

	// A saved post for a spec to start from, and a post's files for a spec to check
	if (path == "/seed" && request.method == "POST") {
		const body = JSON.parse((await readBody(request)).toString("utf8"))
		jsonResponse(response, newPhotoPost(body.collection, body.files.map((name) => ({ name, type: "image/png" }))))
		return true
	}

	if ((match = path.match(new RegExp(`^/posts/(${hex})$`))) && photoPosts.has(match[1])) {
		jsonResponse(response, photoPosts.get(match[1]))
		return true
	}

	// Everything below belongs to one saved post
	match = path.match(new RegExp(`^/(${hex})/(modal|edit|photos)$`))
	const post = match ? photoPosts.get(match[1]) : undefined

	if (post == null) {
		return false
	}

	switch (match[2]) {

		case "modal":
			htmlResponse(response, photoModal(post), modalHeaders)
			return true

		// Saving answers as the edit action does: a 303 to the modal
		case "edit":
			if (request.method == "POST") {
				await readBody(request)
				response.writeHead(303, { "Location": `/${post.id}/modal` })
				response.end()
				return true
			}
			htmlResponse(response, photoEdit(post), modalHeaders)
			return true

		case "photos":
			await photosAction(request, response, post, query)
			return true
	}

	return false
}

// The Articles in a Custom collection, highest rank first, as their author sees the collection's tab
const articles = [
	{ id: "6ad24ab9c00dfca0c02cd471", token: "an-article", title: "An Article" },
	{ id: "6ad24ab9c00dfca0c02cd472", token: "the-second-article", title: "The Second Article" },
]

// The tags a Photo Gallery lists, in its author's order
const galleryTags = ["travel", "food"]

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

// heading is a title's opening tag, exactly as a modal.html writes it
function heading(file, tag) {
	const match = stripComments(read(join(qwerty, file))).match(new RegExp(`<${tag}[^>]*>`))
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
		.replaceAll("${H2}", heading("qwerty-episode/modal.html", "h2"))
		.replaceAll("${ID}", episode.id)
		.replaceAll("${TITLE}", episode.title)
		.replaceAll("${BACK}", arrow("episode-arrow-back.html", above))
		.replaceAll("${NEXT}", arrow("episode-arrow-next.html", below))
		.replaceAll("${LINKS}", link("prev", above) + link("next", below))
}

// entryNeighbor is one link of qwerty-timeline-entry/entry-neighbors.html, the modal's previous and next entries
function entryNeighbor(direction, entry) {
	const arrow = `<span class="qwerty-entry-arrow"><i class="bi bi-arrow-${direction == "prev" ? "left" : "right"}"></i></span>`
	const text = `<span class="qwerty-entry-neighbor-text"><span class="text-xs text-gray">${entry.short}</span><span class="qwerty-entry-neighbor-title">${entry.title}</span></span>`
	const next = direction == "next" ? " qwerty-entry-neighbor-next" : ""
	return `<a class="qwerty-entry-neighbor${next} turboclick" data-modal-go="${direction}" href="/${entry.id}" hx-get="/${entry.id}/modal" hx-target="aside" hx-push-url="false">${direction == "prev" ? arrow + text : text + arrow}</a>`
}

function entryModal(index) {
	const entry = entries[index]
	const prev = entries[index - 1]
	const next = entries[index + 1]
	const links = (prev ? entryNeighbor("prev", prev) : "") + (next ? entryNeighbor("next", next) : "")
	return read(join(here, "fixtures/entry-modal.html"))
		.replaceAll("${H1}", heading("qwerty-timeline-entry/modal.html", "h1"))
		.replaceAll("${ID}", entry.id)
		.replaceAll("${TITLE}", entry.title)
		.replaceAll("${DATE}", entry.date)
		.replaceAll("${NEIGHBORS}", `<div role="navigation" class="qwerty-entry-neighbors" aria-label="Timeline">${links}</div>`)
}

function eventModal() {
	return read(join(here, "fixtures/event-modal.html"))
		.replaceAll("${H1}", heading("qwerty-event/modal.html", "h1"))
		.replaceAll("${ID}", calendarEvent.id)
		.replaceAll("${TITLE}", calendarEvent.title)
		.replaceAll("${DATE}", calendarEvent.date)
}

// modalFor renders the modal of the episode, entry, or event with this id, or "" when there is none
function modalFor(id) {
	const index = episodes.findIndex((episode) => episode.id == id)
	if (index >= 0) {
		return episodeModal(index)
	}
	const entryIndex = entries.findIndex((entry) => entry.id == id)
	if (entryIndex >= 0) {
		return entryModal(entryIndex)
	}
	if (calendarEvent.id == id) {
		return eventModal()
	}
	return ""
}

// listRoute answers the list spec's Save with every value it received, by name, in the order posted
async function listRoute(request, response, path) {

	if (path != "/list" || request.method != "POST") {
		return false
	}

	const posted = {}

	for (const [name, value] of (await formData(request)).entries()) {
		posted[name] = [...(posted[name] || []), value]
	}

	htmlResponse(response, escapeHTML(JSON.stringify(posted)))
	return true
}

// profileTab is the first tab link of qwerty-common/profile-tabs.html, selected, for an Articles collection
function profileTab() {
	const link = stripComments(read(join(qwerty, "qwerty-common/profile-tabs.html"))).match(/<a [^>]*>/)[0]
	return link.replaceAll("{{$tabID}}", "articles").replaceAll("{{$userID}}", "author")
		.replace(/\{\{if [^}]*\}\}true\{\{else\}\}false\{\{end\}\}/, "true") + "Articles</a>"
}

// sortForm is qwerty-common/layout.html's sortable branch up to its cards: the form's opening tag, and anything it loads first
function sortForm() {
	const source = stripComments(read(join(qwerty, "qwerty-common/layout.html")))
	const branch = source.split("{{- else -}}")[1].split('{{- template "layout-cards" $cards -}}')[0]
	return branch.replaceAll("{{$class}}", "cols-1").replaceAll("{{$sortURL}}", "/articles/sort").trim()
}

// articleCard is qwerty-common/layout-column.html's card for an Article, with its drag handle and without its pencil
function articleCard(article) {
	const source = stripComments(read(join(qwerty, "qwerty-common/layout-column.html")))
	const link = source.match(/<a href="\/\{\{\.Token\}\}"[^>]*>/)[0].replace("{{.Token}}", article.token)
	const handle = source.match(/\{\{- if \$canSort -\}\}([\s\S]*?)\{\{- end -\}\}/)[1].replace("{{.StreamID}}", article.id)
	return `<div class="pos-relative hover-trigger">${link}${article.title}</a>${icons(handle)}</div>`
}

// profileArticles is the Articles tab, as list.html swaps it into #profile-tabs, in Custom order
function profileArticles() {
	return `<div id="profile-tabs"><div role="tablist" class="pills">${profileTab()}</div>${sortForm()}${articles.map(articleCard).join("")}</form></div>`
}

// tagPills is qwerty-collection/tag-pills.html's row for the gallery with $selected open, its row and pills taken from the template
function tagPills(selected) {
	const source = stripComments(read(join(qwerty, "qwerty-collection/tag-pills.html")))
	const row = source.match(/<div role="tablist"[^>]*>/)[0]
	const [all, tag] = source.match(/<a [^>]*>[^<]*<\/a>/g)
	const fill = (link, value) => link
		.replace(/\{\{if ne `` \$query\}\}[?&]\{\{\$query\}\}\{\{end\}\}/g, "")
		.replace(/\{\{if eq (``|\.) \$selected\}\}true\{\{else\}\}false\{\{end\}\}/, value == selected ? "true" : "false")
		.replaceAll("{{$collectionID}}", "gallery")
		.replaceAll("{{$profileTab}}", "/@author?tab=gallery")
		.replaceAll("{{. | urlquery}}", encodeURIComponent(value))
		.replaceAll("{{.}}", value)
	return row + fill(all, "") + galleryTags.map((value) => fill(tag, value)).join("") + "</div>"
}

// galleryTab is the gallery's tab, as list.html swaps it into #profile-tabs, with photos taller than the window below the pills
function galleryTab(selected) {
	return `<div id="profile-tabs"><div role="tablist" class="pills"><a role="tab" aria-selected="true">Gallery</a></div>${tagPills(selected)}<div style="height: 2000px">${selected || "All"} photos</div></div>`
}

// profileUsername is qwerty-outbox/profile-header.html's handle, whose Clipboard behavior copies the full @user@host
function profileUsername() {
	const block = stripComments(read(join(qwerty, "qwerty-outbox/profile-header.html"))).match(/<div id="profile-username"[\s\S]*?<\/div>/)[0]
	return icons(block.replaceAll("{{.Username}}", "author").replaceAll("{{.Hostname}}", "example.social"))
}

function page(body) {
	return read(join(here, "fixtures/shell.html")).replace("${BODY}", body)
}

// visualEditor renders an EditorJS editor template for a new Article, whose content.raw is empty
function visualEditor(file) {
	return stripComments(read(file))
		.replaceAll("{{.ContentRaw}}", "")
		.replaceAll("{{.StreamID}}", "6ad24ab9c00dfca0c02cd460")
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
	"/js/carousel.js": () => ["text/javascript", concat(join(qwerty, "qwerty-theme/carousel"))],
	"/.themes/global/resources/sortable-1.15.7/Sortable.min.js": () => ["text/javascript", read(join(templates, "theme-global/resources/sortable-1.15.7/Sortable.min.js"))],
	"/episode": () => ["text/html", page(`<aside>${episodeModal(0)}</aside>`)],
	"/entry": () => ["text/html", page(`<aside>${entryModal(0)}</aside>`)],
	"/calendar": () => ["text/html", page(`<button id="open-event" hx-get="/${calendarEvent.id}/modal" hx-push-url="false">${calendarEvent.title}</button><aside></aside>`)],
	"/podcast-list": () => ["text/html", page(read(join(here, "fixtures/podcast-list.html")).replace("${DATE}", dateCell()))],
	"/list": () => ["text/html", page(read(join(here, "fixtures/list.html")))],
	"/tabs": () => ["text/html", page(read(join(here, "fixtures/tabs.html")))],
	"/editorjs": () => ["text/html", page(visualEditor(join(qwerty, "qwerty-article/edit-content-editorjs.html")))],
	"/editorjs-emissary": () => ["text/html", page(visualEditor(join(templates, "stream-article-editorjs/editor.html")))],
	"/@author": () => ["text/html", page(`<div hx-target="main" hx-swap="innerHTML"><main>${profileArticles()}</main></div>`)],
	"/articles/list": () => ["text/html", profileArticles()],
	"/@photographer": () => ["text/html", page(`<main><div><div style="height: 300px">The profile's header</div>${galleryTab("")}</div></main>`)],
	"/gallery/list": (url) => ["text/html", galleryTab(url.searchParams.get("tag") || "")],
	"/handle": () => ["text/html", page(profileUsername())],
	...Object.fromEntries(articles.map((article) => [`/${article.token}`, () => ["text/html", `<h1>${article.title}</h1>`]])),
}

createServer(async (request, response) => {
	const url = new URL(request.url, "http://x")
	const path = url.pathname

	// The photo gallery, its posts, and their photos action
	if (await photoRoute(request, response, path, url.searchParams)) {
		return
	}

	// The list spec's Save
	if (await listRoute(request, response, path)) {
		return
	}

	// The bootstrap icons, as static files
	if (path.startsWith("/icons/")) {
		const file = join(templates, "theme-global/resources/bootstrap-icons-1.13.1", path.slice(7).replace(/\.\./g, ""))
		if (existsSync(file)) {
			response.writeHead(200, { "Content-Type": file.endsWith(".css") ? "text/css" : "font/woff2" })
			return response.end(readFileSync(file))
		}
	}

	// An episode's, an entry's, or the event's modal, with the headers Emissary's as-modal sends
	const modal = path.match(/^\/([0-9a-f]{24})\/modal$/)
	const modalBody = modal ? modalFor(modal[1]) : ""
	if (modalBody != "") {
		response.writeHead(200, { "Content-Type": "text/html", "HX-Retarget": "aside", "HX-Reswap": "innerHTML", "HX-Push-Url": "false" })
		return response.end(modalBody)
	}

	// Saving an episode answers as its edit action does: a 303 to its modal, with no closeModal event
	const save = path.match(/^\/([0-9a-f]{24})\/edit$/)
	if (save && request.method == "POST") {
		request.resume()
		response.writeHead(303, { "Location": `/${save[1]}/modal` })
		return response.end()
	}

	// Posting a new order answers as Emissary's sort step does, with nothing to swap
	if (path == "/articles/sort" && request.method == "POST") {
		request.resume()
		response.writeHead(200, { "HX-Reswap": "none" })
		return response.end()
	}

	if (routes[path]) {
		const [type, body] = routes[path](url)
		response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" })
		return response.end(body)
	}

	response.writeHead(404)
	response.end("not found")
}).listen(port, "127.0.0.1", () => console.log(`fixtures on http://127.0.0.1:${port}`))
