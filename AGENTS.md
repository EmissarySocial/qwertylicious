# Qwertylicious — Notes for AI Agents

Qwertylicious is an Emissary template package for long-form writing, installed onto a running Emissary server through a Git package adapter rather than compiled or deployed on its own. See [README.md](README.md) for the product description. Every top-level folder except `meta/` holds one definition file (`template.hjson`, or `theme.hjson` for the theme), and the `.html` files beside it are the views its actions render.

## The templates

The ID a template registers under is the `templateId` inside its file, not the folder name. Emissary's loader passes the folder name in, but the unmarshalled `templateId` replaces it (`service.Template.Add`). So several folders here carry a `qwerty-` prefix that their ID does not.

| Folder | ID | Model | What it is |
| ------ | -- | ----- | ---------- |
| `qwerty-outbox` | `qwerty-outbox` | Outbox | The profile page, with role `user-outbox`. It is the only page under a profile: the profile card and tabs, then the open tab (a collection, or About) loaded in place |
| `qwerty-article` | `qwerty-article` | Stream | An Article, which lives only inside a collection (`containedBy: ["qwerty-collection"]`) |
| `qwerty-inbox` | `qwerty-inbox` | Inbox | The user's inbox, with role `user-inbox` |
| `qwerty-collection` | `qwerty-collection` | Stream | A tab on the profile, with its own sharing and feed, in one of eleven formats (`data.layout`). Five list Articles as cards. Photo Gallery, Map, Timeline, Calendar, and Podcast hold their own kinds of item (the next three rows), and its `add` action picks the template from the format. Notes holds nothing (see "The Notes collection lists the profile's Notes" below). A collection never changes kind: Edit Collection offers an Article collection only the Article layouts, a Timeline only its order (`data.timelineOrder`), and the rest no format at all. It has no page of its own: its `view` redirects to its tab, and `list` is the tab's content. In progress: see emissary-specs `projects/QWERTY-COLLECTIONS.md` |
| `qwerty-photo` | `qwerty-photo` | Stream | A post of 1 to 64 photos (a carousel) in a Photo Gallery collection. Edit adds photos with `upload-attachments`' `fill` action, which never deletes a photo to make room, so uploads past 64 are left out; the modal shows the author how many of the 64 are used. It publishes as soon as it is uploaded, and the gallery opens it in a modal (its `modal` action). Its first photo is its thumbnail (`set-thumbnail`), and `data.photoCount` marks a carousel in the grid. It can be pinned (`feature`), and pinned posts lead the gallery |
| `qwerty-entry` | `qwerty-entry` | Stream | An entry in a Map, Timeline, or Calendar collection: one type for all three (merged from `qwerty-placemark` and `qwerty-event` on 2026-10-15). It has the Stream's own `location`, chosen with the `place` widget, and its own `startDate` and optional `endDate`. Its forms follow its collection's format, read with `(.Parent "view").DataString "layout"`: on a Map it is a Place, whose location is required and whose forms have no dates, and on a Timeline or Calendar it is an Event, whose start is required and location optional. Its page shows whatever it holds, without reading the collection, with a byline as an Article's. The calendar opens it in a modal (its `modal` action, `as-modal` with `background:"view"`), so `/{id}/modal` also works as a page; the page and the modal share `entry-byline.html` and `entry-body.html`. Its times are kept in its location's timezone (`localize-dates` and `anchor-dates`), and its `data.tags` filter the map and the timeline. The collection reads `endDate` through `StreamSummary`, which carries it from the Emissary build of 2026-10-15 |
| `qwerty-episode` | `qwerty-episode` | Stream | An episode in a Podcast collection, modeled on Bandwagon's songs: a name, a Markdown description, an optional photo, and one audio track (`upload-attachments` category `Audio`, with its ID in `data.attachmentId` and its URL in `data.audioUrl`, which the upload widget previews). Its `audio` action serves the track transcoded (`view-attachment`, MP3 or Ogg), and the players and the feed ask for `/{id}/audio?format=mp3`. Every save writes `data.enclosureUrl`, which Emissary's feeds turn into an RSS enclosure and a JSON Feed attachment, so the collection's own `feed` is the podcast's feed. The collection's tab lists the episodes (`items-podcast.html`), newest first or oldest first as the author picks in Edit Podcast (`data.episodeOrder`), and each one opens in a modal with its player and its description (`modal.html`), as a photo opens over its gallery. See "Podcast episodes play in their modal" below. An episode without audio is listed and opens, but has nothing to play |
| `qwerty-common` | `qwerty-common` | None | No actions. Holds the shared card-layout views (`layout.html` and `layout-*.html`), and the `colors`, `fonts`, and `layouts` datasets. `qwerty-outbox` and `qwerty-collection` extend it |
| `qwerty-replies` | `qwerty-replies` | None | The Replies widget, extended by every collection item. It supplies the `replies-tabs` and `replies-panel` partials, and the `replies-list` and `reply` actions. See "Every collection item has a Replies tab" below |
| `qwerty-theme` | `qwerty-theme` (a `themeId`) | — | The site theme, extending Emissary's `global` |
| `qwerty-search` | `qwerty-search` | Stream | **Parked**: its manifest is `z-template.hjson`, so it never loads (see below) |
| `qwerty-settings` | `user-settings` | Settings | Replaces Emissary's built-in settings template |
| `qwerty-guest` | `guest` | Identity | Replaces Emissary's built-in guest template |
| `qwerty-widget-editor` | `base-widget-editor` | Stream | Replaces Emissary's built-in widget-editor base |
| `qwerty-article-base` | `article-base` | Stream | Replaces Emissary's article base, which `article-editorjs` and `article-markdown` extend |
| `qwerty-article-editorjs` | `article-editorjs` | Stream | Replaces Emissary's Editor.js article, with `containedBy: ["top", "home", "folder", "article"]` |
| `qwerty-article-markdown` | `article-markdown` | Stream | Replaces Emissary's Markdown article, with the same `containedBy` |
| `admin-common` | `admin-common` | None | Replaces Emissary's shared admin template |
| `admin-domain` | `admin-domain` | Domain | Replaces Emissary's domain admin |
| `admin-navigation` | `admin-navigation` | Stream | Replaces Emissary's navigation admin |
| `admin-users` | `admin-users` | User | Replaces Emissary's user admin |

`meta/` holds the logo and a font list, and is not a template.

**Ten of these IDs are also shipped in Emissary's `_embed/templates`.** Emissary registers templates by ID, so whichever location loads last wins. That is the order of the `templates` entries in the server's config, and a qwertylicious entry listed after Emissary's own replaces Emissary's copy for the whole server, not only for qwertylicious users. To find the definition actually serving a role, check both repositories and the config's load order.

This file lives at the repo root and is the only place to add notes. Do not create files inside a template folder.

## Browser tests live in `tests/playwright`

Playwright specs check the theme's styles and scripts in Chromium and WebKit, light and dark (see [tests/playwright/README.md](tests/playwright/README.md)). The loader reads only top-level folders that hold a definition file, so `tests/` is never loaded as a template. The fixtures copy rendered markup, so a change to a template's markup needs the same change in its fixture.

## A bundle folder holds only source — every file in it is concatenated

`bundles:` in a `template.hjson` or `theme.hjson` declares a folder by name and a content type. Emissary's `populateBundle` then reads **every** file in that folder, skipping only subdirectories — there is no extension filter — concatenates them all, and runs the result through a minifier for that content type. A stray `AGENTS.md`, `README.md`, or editor backup is therefore fed to the CSS or JS minifier as if it were code, corrupting the served bundle. Here that means [qwerty-article/stylesheet](qwerty-article/stylesheet/), [qwerty-outbox/stylesheet](qwerty-outbox/stylesheet/), [qwerty-theme/stylesheet](qwerty-theme/stylesheet/), [qwerty-theme/maps](qwerty-theme/maps/), [qwerty-theme/carousel](qwerty-theme/carousel/), [qwerty-theme/podcast](qwerty-theme/podcast/), and `qwerty-search`'s `javascript` and `hyperscript` folders.

**A bundle's URL names the template by ID, never by role.** `/.templates/{templateId}/{bundleId}` loads the template by its `templateId`. So `qwerty-outbox`'s stylesheet is `/.templates/qwerty-outbox/stylesheet`. `/.templates/user-outbox/stylesheet` finds Emissary's own built-in `user-outbox` template instead, which has no bundles, and answers 404 ("Bundle not found"). The profile views used that wrong URL from 2026-10-09 (`55d3a88`) until 2026-10-14, so the profile's own CSS never loaded during that time.

A theme's `resources/` folder is different — it is served as plain static files, one URL per file, not concatenated. Nothing there corrupts a bundle, but anything you drop in becomes publicly downloadable, so it is still not a place for notes.

## Maps load Leaflet and the theme's `maps` bundle asynchronously

A Map collection's tab (`qwerty-collection/items-map.html`) and an entry's page with a location (`qwerty-entry/view.html`) draw their maps with `qwerty-theme/maps/qwerty-maps.js`, served as the theme's `maps` bundle at `/.themes/qwerty-theme/maps`. A map is a `.qwerty-map` element whose `data-*` attributes carry the tiles, center, and zoom, and its markers are `.qwerty-map-marker` elements inside it. A marker with `data-modal-url` opens that modal on click; any other marker's pop-up is HTML the server writes, so the script never builds HTML from data. htmx loads `<script src>` asynchronously when it swaps a page in, so Leaflet and the bundle may arrive in either order. Each one calls `qwertyMaps()` when it loads, and the call does nothing until `window.L` exists. A Map collection's default view is its own `location` and `data.zoom`. The author picks them in Add a Collection, where the two fields use `show-if` to appear only when Map is chosen, and can reset them later with the map's "Set Default View" button, which posts to the `map-view` action. An empty map shows only the map, with no welcome block. A Map, like a Photo Gallery, sets replies with a toggle in its edit modal ("Edit Map"), not with a menu item. A Place opens like a photo: its `view` includes its `modal`, which draws it over its map on the profile (`background-url`) with its own URL and `head.html`, and falls back to its `page` action. Clicking a Place's marker opens its modal directly (`data-modal-url`, fetched with `htmx.ajax`), with no pop-up.

## The photo carousel is one delegated script

A photo post's carousel (`qwerty-photo/photo-figure.html`) is run by `qwerty-theme/carousel/qwerty-carousel.js`, the theme's `carousel` bundle, which `includes-foot.html` loads once per page. It is modelled on the attachment viewer in conversations-mls (`modal-attachments.tsx`): a transform-driven track, the on-screen arrows, the Left and Right keys, and a press-and-drag swipe that locks to an axis after 8px and commits past 50px.

- **Delegated listeners:** every listener sits on `document`, so a carousel that htmx swaps in later needs no setup, and the script guards itself with `window.qwertyCarousel` so it installs once. A carousel's place is its `data-index` attribute.
- **Neighboring posts:** past the first or last photo, or on a post of one photo, the arrow keys click the figure's hidden `a.qwerty-carousel-post-prev` and `a.qwerty-carousel-post-next`. The server computes those neighbors in the gallery's order (pinned posts, then the rest, each newest first), using `Siblings`. So they work beyond the tiles the gallery has loaded.
- **Modal or page:** `photo-figure` takes `(array $builder $mode)`. In `"modal"` mode the links re-open the modal, and in `"page"` mode they load the next page.
- **What the keys drive:** they act on the carousel in `#modal` when one is open, and otherwise on the one in `<main>`. They never act while focus is in a text field.
- **Swipes and buttons stay within the photos.** Only the keys go on to the next post.

## The corner pencil toggles between an item and its editor

Every item that has a view and an editor puts a pencil in the top right corner: an episode's, a photo's, an entry's, and a Note's modal (Emissary's `outbox-message`), and an Article's page (Ben, 2026-10-17). It replaces the old Edit and Cancel buttons.

- **On the view,** an outline pencil opens the editor: the edit modal in place of the modal, or the Article's edit page.
- **On the editor,** a filled, selected (`primary`, `aria-pressed="true"`) pencil returns to the view, as Cancel did. An item's edit modal draws it with a first `view-html` step, `edit-pencil.html`, before its `edit` form.
- **Styles live in the theme**, `.edit-circle` for the circle and `.corner-pencil` for the corner (`qwerty-theme/stylesheet/02-forms.css`), because the public Article page loads no stylesheet of its own (see "The public Article page styles itself").
- **Its parent must be positioned:** `#modal-window` is, and an Article's card is `.pos-relative`.

## Podcast episodes play in their modal, from one delegated script

A Podcast's tab (`qwerty-collection/items-podcast.html`) is only the feed's link and a table of episodes. An episode opens in a modal (`qwerty-episode/modal.html`), with its own URL, the same way a photo or a Place does: its `view` includes its `modal`, which draws its podcast's tab behind it (`background-url`), and falls back to its `page` action. That modal-over-its-collection pattern is the one every collection item is moving to (Ben, 2026-10-17).

The player and the keyboard are `qwerty-theme/podcast/qwerty-podcast.js`, the theme's `podcast` bundle, which `includes-foot.html` loads once per page. It does not use Emissary's `MediaPlayer` behavior.

- **One `<audio>` element, on `<body>`.** The script makes it the first time something plays. It outlives the modals, so when an episode ends the next one can start without a click: browsers (iOS Safari above all) refuse to start audio without a click or key press, except on an element that has already played. A new `<audio>` in each modal would break that.
- **The list's play button starts the audio in its own click,** before its `hx-get` opens the modal, for the same reason. The play, pause, and skip buttons carry `turboclick`, which fires on mouse-down and swallows the browser's own click that follows, so one press toggles once. A mouse-down is a user gesture, so the browser still allows the audio.
- **A click anywhere on a list row opens its episode,** by clicking the row's name link (`[data-episode-row]`). The row's own buttons and links keep their jobs, and keyboard users reach the modal through the name link.
- **The modal's arrows** (`[data-episode-go]`, `qwerty-episode/episode-arrow-back.html` and `episode-arrow-next.html`) open the episodes above and below, as the keys do. They sit on either side of the play button: gray circles, smaller than it. They are Bootstrap's skip icons. At either end of the list one is disabled (the `disabled` attribute): grayed out on a super-light circle, so the controls keep their shape. An episode without audio shows them on its "no audio yet" card, around a disabled play button, so the controls always take the same space. The disabled styles also cover `:hover`, because the theme's `button[disabled]:hover` would otherwise paint the circle the modal's own background color. The episode's own page passes no neighbors to `episode-player`, and draws no arrows.
- **Keys:** Up or Left opens the episode above in the list, and Down or Right the one below; either way, the episode that was playing stops. Space plays or pauses, except when it would already press a focused button, link, or tab. The keys do nothing while focus is in a text field. The modal finds its neighbors with `Siblings` in the list's order, as hidden links that the script clicks.
- **No `<input>` in the modal.** Emissary's `Modal` behavior focuses the first `<input>`, which would stop the keys from working. That is why the progress bar is a `div` that seeks on a pointer press, not a range input.
- **When an episode ends,** the script opens the next one and plays it. It plays a modal only when the modal's `data-episode-id` is the one it asked for, and moves past an episode without audio.
- **Closing the modal stops the audio,** on `closeModal`.
- **Moving between episodes fades with plain CSS, never a view transition.** Safari leaves the underlay's `backdrop-filter` out of a view transition's snapshots, so the page behind the modal turned sharp for the length of the fade. Clearing the page's view-transition names fixed it in Chromium but not in Safari (Ben, 2026-10-17). Instead, `goTo` marks the leaving episode `data-leaving` and `<html>` with `.qwerty-episode-arriving`. `collections.css` fades in the `.qwerty-episode` without `data-leaving`, and the script removes the class on `animationend`. The underlay is live throughout, so it keeps its blur in every browser.
- **The header's text is top-aligned to the photo.** Centered, a title that wrapped moved the podcast's name and the title between episodes.
- **The title is written with `id="modal-title"`.** Emissary's `Modal` behavior gives the modal's first heading that id when it has none, and `#modal #modal-title` makes it 32px. Added by the script, it lands after the first paint, so each new episode's title grew from 24px into place (Ben, 2026-10-17).
- **`.text-gray` is an opacity, not a color.** On a table cell it fades the cell's background too, so the list's hovered row showed a darker patch behind the date. Put it on the text inside the cell.
- **The modal is outside the page's container,** so the `sm:` classes never apply inside it.
- **The script also reads** `[data-podcast-play]`, the list's play buttons, which carry the same `data-track-*` values as a player, and `[data-episode-url]`, the list's rows, which it marks `.playing`.

## Collection items take their sharing from the collection

Every item template (`qwerty-article`, `qwerty-photo`, `qwerty-entry`) sets `inheritPermissions: true`, so each save copies the collection's sharing onto the item, and a published item is visible to the collection's `viewer` role, not to `anonymous`. No item has a Sharing action of its own. The collection's `sharing` action ends with `share-children`, which re-saves the items so a change reaches the ones already there. Items saved before 2026-10-15 keep their old sharing until the collection's sharing is saved again. See Emissary's `service/AGENTS.md`.

## The calendar's grid is UTC dates, and each event sits on its own clock

`qwerty-collection/items-calendar.html` does its date math in the template: `AddDate`, `printf "%d"` to turn a `time.Weekday` into a number, and `Format "2006-01-02"` keys compared as strings. The grid's days are UTC dates. Each event is placed and timed on its own clock, with `inTimezone .StartDate .Location.Timezone`, so it shows on the day and at the time its author typed in its place's timezone (`qwerty-common/event-dates.html` does the same, with the zone's abbreviation). "Today" is the server's local date, moved onto that UTC grid.

## The theme's `<body>` pushes every `hx-get` into the address bar

`qwerty-theme/page.html` sets `hx-push-url="true"` on `<body>`, and htmx inherits it, so any `hx-get` or `hx-post` without its own `hx-push-url` writes its URL to the address bar. A button inside a modal, such as a photo's Pin, sets `hx-push-url="false"` to keep the modal's own URL there. A profile's `refreshPage` listener (`qwerty-outbox/outbox.html`) rebuilds the page from that address bar's `?tab=`.

Until 2026-10-16, a photo's Edit, Pin, and Remove Photo actions refreshed the profile onto its default tab, not the gallery being worked in. Two fixes went in:

- **Gallery tiles** set `hx-push-url="false"`.
- **The refresh listener** falls back to the tab that is open on screen (`#profile-tabs [role=tab][aria-selected=true]`) when the address bar names none.

*Retracted 2026-10-16:* this section said opening a photo pushed `/{id}/modal`, and that an `as-modal` with a `background` sends no `HX-Push-Url: false`. Emissary's `WrapModal` writes `HX-Push-Url: false` on every modal, and htmx obeys that header over the element's own attribute, so a modal never pushed its URL. The listener's fallback is the fix that matters, since the address bar can lack `?tab=` for other reasons, and it is what keeps refreshes on the gallery while a photo's own URL is in the address bar (below).

Give any new modal opener on a profile `hx-push-url="false"` all the same; it costs nothing, and says what is meant.

## A photo's own URL opens it over its gallery

A photo's URL, `/{id}`, is the one to share. Opened directly, it draws its owner's profile on the gallery's tab, with the photo as a modal over it, through `as-modal`'s `background-url` (Emissary's `model/step/STEPS.md`). Its `<head>` carries the photo's title and link-preview tags (`qwerty-photo/head.html`), not the profile's. Opened from a tile, the same modal shows `/{id}` in the address bar through `replace-url`, and Emissary's global `modal-url.js` puts the gallery's address back when it closes. Mastodon and other servers still get the photo's JSON-LD at `/{id}`, because content negotiation happens before any action runs, on the bare route only.

Three rules follow from it:

- **`/{id}` answers an htmx request with the modal.** Anything that reloads the photo's own page with `hx-get` uses `/{id}/page`, as `view.html`'s refresh listener and the carousel's page-mode neighbor links do.
- **The background URL comes from the gallery's parent.** ``/@{{(.Parent `view`).ParentID}}?tab={{.ParentID}}`` works because a gallery is always a child of its owner's outbox. When that lookup fails, or the visitor cannot see the profile, the photo's own page is drawn behind the modal instead (`background: "page"`).
- **A page drawn behind the modal leaves out its own link-preview tags.** `qwerty-outbox/outbox.html` writes its canonical link and `og:` tags inside `<main>`, and skips them when `.IsBackground` is true, so the page carries only the photo's. `IsBackground` is new in Emissary on 2026-10-16, so this repo now needs at least that Emissary.

## A tab's own query parameters ride along in the profile's URL

A Calendar's `?view=` and `?startDate=`, and a Map or Timeline's `?tag=`, are the tab's own state. Its links reload only `#profile-tabs` and push the profile's URL with those parameters (`/@user?tab={id}&view=week`), and `qwerty-outbox/outbox.html` passes them on to the tab's `/list` URL, escaped, so a reload or a shared link opens the same view. The owner's `refreshPage` and SSE reloads copy them from the address bar too. Do not name a new parameter `createDate`, `publishDate`, `rank`, or `label`: a Stream's children query applies those names as filters on its own. A Photo Gallery's infinite scroll uses exactly that: its sentinel asks `gallery-page` for `?createDate=LT:{last}`.

## A `z-` filename prefix is how a template is parked, not a naming quirk

[qwerty-search](qwerty-search/) contains `z-template.hjson` rather than `template.hjson`, so Emissary never registers that template while its views stay in the repo. Renaming the file back is what re-enables it — don't "tidy" the prefix away, and don't assume a folder with views is live without checking that its manifest is actually named `template.hjson`.

## The profile page is the frame, and every tab loads inside it

`/@user` (`qwerty-outbox/outbox.html`) is the only page under a profile. It draws the profile card (`profile-header.html`), then `#profile-tabs`: the tab bar (`qwerty-common/profile-tabs.html`: the collections in the owner's order, then About) above an empty panel, while it loads the open tab. Each tab's content, a collection's `/{id}/list` or `/@user/about` (`about.html`), is a new `#profile-tabs` that draws the tab bar again with its own tab selected. There is no Replies page.

- **The open tab lives in the URL** as `?tab={collectionId}` or `?tab=about`. `outbox.html` uses `.QueryParam "tab"` only when it names a visible collection or `about`. Anything else falls back to the first tab (About when there are no collections), so a crafted value never reaches the page.
- **A tab's content brings its own tab bar, and pushes the profile's URL.** Each tab swaps out `#profile-tabs` whole (`outerHTML`), so the server marks the selected tab and no script moves `aria-selected`; renamed and new collections also show on the next click. It sets `hx-push-url` to `/@user?tab=…`, never to the partial's own URL, so back, reload, and a copied link all ask for a full page. Every tab keeps a stable `id` (`tab-{id}`, `tab-about`) so htmx can return keyboard focus to it after the swap.
- **Only the profile page's `#profile-tabs` has `hx-trigger="load"`.** The swapped-in copies carry none, so a page restored from htmx's history cache does not load the first tab again over the one that was open.
- **The owner's only menu is one ⋯, drawn by the tab bar right after About.** The profile card has none. `profile-tabs` takes `(array $outbox $selected $collection)` and draws `qwerty-common/profile-menu.html`, so the menu is written once. It holds Edit Profile and Manage Collections, then, on a collection's tab (`$collection` is its builder), a line and that collection's items: Edit {its name}, its sharing status, Replies for a Timeline or Calendar, and its add item. About and the profile page's loading copy pass `false`, and get only the profile items. The menu sits beside the `tablist`, not inside it, so the tabs keep valid ARIA. Edit Profile names its own `hx-target`, because the loading copy sets `hx-disinherit="*"`. There is no Sign Out here.
- **Both copies of the tab bar read the same query.** A collection's `list.html` reaches the profile through `.ParentOutbox "view"` and calls `.Outbox`, as `outbox.html` does. Do not switch it to `.Siblings`: that hides anything outside its publish window, and a collection is never published.
- **Partials redirect when visited directly.** A collection's `view` redirects to `/@{owner}?tab={id}`. The outbox's `about` action renders `about.html` only for an htmx request (`.IsPartialRequest`), and otherwise redirects to `/@user?tab=about`.
- **The loading state must not pass its htmx settings down.** The profile page's `#profile-tabs` has `hx-target="this"` and `hx-push-url="false"` for its first load, and sets `hx-disinherit="*"` so the tabs inside it keep their own. The swapped-in copies have no htmx attributes, so the cards inside them navigate the whole page.
- **Reloads carry the tab.** The owner's `refreshPage` and SSE reloads `hx-get` `/@user` with `hx-vals` that copy `?tab=` from the address bar. Without it, a reload after Sharing or Settings would jump back to the first tab.

## Never put a template action where an attribute name goes

Emissary minifies each view's HTML before Go parses it, and the minifier lowercases attribute names. So `<a {{if eq $collectionID $selected}}aria-selected="true"{{end}}>` reaches the parser as `$collectionid`, an undefined variable, and the whole template fails to load (found 2026-10-15). Keep actions inside attribute values instead: `aria-selected="{{if …}}true{{else}}false{{end}}"`. Inside a double-quoted attribute, write template strings with backticks (`{{if eq `about` $selected}}`), not double quotes.

## `extends` composes templates, and the base templates live in Emissary

A template inherits actions, states, roles, schema, and datasets from each entry in its `extends` array, and a value defined locally wins over an inherited one. `user-outbox` and `base-intent` are **not in this repo** — they ship inside Emissary's `_embed/templates`, so an unexplained action or role usually comes from there. `qwerty-common` is `model: None` with no actions. It holds the shared card-layout views and the `colors` and `fonts` datasets, and `qwerty-outbox` extends it (since 2026-10-12, for QWERTY-COLLECTIONS §1.1).

**Views are inherited too, and a local view wins.** `extends` copies each parent view into the child unless the child already has one with that name. So a shared view in `qwerty-common` is shadowed by any same-named file left in the extending template's folder. That is why the shared layouts are named `layout-row`, `layout-row-reverse`, `layout-column`, and `layout-columns`, and not `outbox-*`. Each takes `(array $posts $canEdit)`, a slice of stream summaries and whether to add the author's hover-only Edit link, and fetches nothing. `layout` chooses among them: call it as `{{template "layout" (array $layout $posts $canEdit)}}`, because a `{{template}}` call takes one value and the funcmap has no `dict`, but it does have `array`. The caller handles the empty state.

## Option providers are `{templateId}.{datasetName}` and resolve through inheritance

A form field like `options:{provider:"qwerty-outbox.layouts"}` is split on the dot: Emissary loads the template named by the first segment and looks up the second in its `Datasets` map. The name must be the template the form belongs to, even when the dataset is *defined* in `qwerty-common`, because datasets are copied down at inheritance time. Providers whose names have no dot (`circles`, `syndication-targets`) are built into the server instead.

**A wrong provider name fails silently in the UI.** The lookup reports the error to the server log and returns an empty group, so the form still renders — as an empty dropdown with no visible complaint. When a select is mysteriously blank, check the provider name before anything else.

## The Notes collection lists the profile's Notes, and holds none of its own

A collection whose `data.layout` is `notes` is the magic Notes collection (emissary-specs QWERTY-COLLECTIONS §1.7). Its tab (`qwerty-collection/items-notes.html`) lists `(.ParentOutbox "view").Outbox.Where "templateId" "outbox-message"`: the Notes saved on the profile itself, where the Mastodon API, imports, and intents put them. `Outbox` already leaves out replies and applies sharing.

- **A Note is never a child of the collection.** The owner's composer is the outbox's `add-note` action, an inline `add-stream` with `location: outbox`, rendered with `$outbox.View "add-note"`. So deleting the collection hides the Notes from the website but deletes none of them, and its `add` action halts.
- **The template ID is hard-coded to `outbox-message`.** `user.NoteTemplate` exists, but nothing writes it, and the Mastodon API and imports hard-code `outbox-message` (checked 2026-10-17). If a qwertylicious Note template arrives, change the query here and in the composer together.
- **Paging rides on the Outbox query's own `?publishDate=` filter.** `notes-list.html` shows 12 and a `revealed` sentinel that asks the collection's `notes-page` for `publishDate=LT:{last}`. `ParentOutbox` passes the request through, so the filter reaches `Outbox`. Never call `profile-tabs` from a view with that parameter set, because its collection query would be filtered too.
- **A Note opens as a modal over the Notes tab.** Emissary's `outbox-message` draws its modal over `/@{owner}?tab=notes`, and `outbox.html` resolves `?tab=notes` to this collection's ID. The list opens it with `hx-get="/{id}/modal"`, like a photo, for the owner and for guests. Any other signed-in visitor gets their own inbox's document browser instead (`/@me/newsfeed/browse?url={note's URL}`).
- **One per profile.** Add a Collection offers `layoutsWithoutNotes` once the profile has one, and a POST for a second halts without saving. Inside `as-modal` an `inline-error` cannot show, because `as-modal`'s POST always sends `closeModal`.
- **No settings to pass down.** Its Edit Notes modal has only the name and description, and its ⋯ menu has no Replies or add item: every Note accepts replies. Its `feed` redirects to `/@user/feed`.
- **Its content goes through `htmlMinimal`.** A Note can arrive through the Mastodon API, so its HTML is sanitized rather than trusted.

## Steps that look safe and are not

- **`inline-error` cannot keep an `as-modal` form open.** `as-modal`'s POST always sends `closeModal`, so a refused save closes the modal anyway. Check before the modal, or accept the input and show the state afterwards, as an episode without audio does.
- **A create step can read its collection.** `add-stream` puts the new item in its collection before its steps run, so `create` can branch on `(.Parent "view").DataString "layout"`, as `qwerty-entry` does.
- **A delete step must never fall back to "all".** `qwerty-photo`'s old `delete-photo` deleted every photo when its `?attachmentId=` was missing. A delete names exactly what it removes, or does nothing (see `delete-thumbnail`).
- **`view-html` renders only on GET** unless it is given `method: "post"`, which a POST action that answers with a fragment needs (`qwerty-photo`'s `feature` and `unfeature`).

## A remote value goes only into an `href`

A remote actor's profile metadata, such as a link on their profile (`qwerty-inbox/browse-actor.html`), goes into an `href`, where html/template's URL filter blocks `javascript:` and `data:` links. Never put a remote value into hyperscript or any `script` attribute, where nothing filters it. This is the general form of the rule against `safeURL` on reply links, below.

## The public Article page styles itself

`qwerty-article/view.html` links `/.templates/user-article/stylesheet`, which is not this template's ID, so the Article's own stylesheet never reaches its public page. Its partials, such as `head-banner.html` and `head-byline.html`, style with utility classes and inline styles instead. Fixing the link would change how the public page looks, so check it against the edit page's styles first.

## Push notifications are wired by a script, not the form

`qwerty-settings/notifications-push.html` connects the browser's Web Push subscription to the Device Options toggle on the notifications form.

- **The toggle's id must stay an `id:` field.** The script finds it by `id="push-device-toggle"`. As a `path:`, the toggle widget makes its own id (`toggle-<path>-<value>`), and the wiring silently stops finding it.
- **The script polls for the toggle.** Its `view-html` runs before the `edit` form, so the toggle is not there yet. It waits for `role="switch"` and the toggle's hidden input, or an early `setTrue` or `setFalse` is lost.
- **The toggle is browser state, applied on Save.** It is not a schema field. The script sets it from the real subscription, and acts on Save, because `Notification.requestPermission()` needs that click. Save is an htmx request, so the script listens for `htmx:beforeRequest` from the form that holds the toggle.
- **Send the toggle's events through hyperscript.** The widget's state is its `@value`, changed by `setTrue` and `setFalse`. Fire them with `_hyperscript.internals.runtime.triggerEvent`, because `on` handlers do not reliably catch a plain `dispatchEvent`.
- **409 retries once, 403 never.** A 409 means the browser's endpoint belongs to another user, so the script unsubscribes and subscribes once more. A 403 means the server refused the endpoint (`WebPush.EndpointIsAllowed`), and subscribing again would destroy a good subscription.

## Quote every number in a `set-data` value

`set-data` runs each value through a text template, so the value reaches the schema as a string. hjson reads a bare `11` as a float, and rosetta turns a float into a string with two decimals (`convert.floatToString`), so an integer field receives `"11.00"` and refuses it with "Value must be an integer". Write `"data.zoom":"11"`, not `"data.zoom":11`. A bare number in `qwerty-collection`'s `create` broke Add a Collection, from the menu and from Manage Collections alike (found 2026-10-16).

## hjson does not reject a malformed key — it silently creates a different one

hjson is deliberately lenient, so a typo in a key name is not a parse error; the field simply arrives under the wrong name and whatever read it gets a zero value. [qwerty-common/template.hjson](qwerty-common/template.hjson) currently demonstrates the failure: line 22 reads `{Label":"Light Green", Value:"#aad816"}`, whose stray quote parses into a key literally named `Label"`, so that swatch has no `Label` at all and renders blank in the color picker while every sibling is fine. Nothing warns you. After editing a `template.hjson`, confirm the change actually took effect in the rendered page rather than trusting that it parsed.

## The server caches template folders — restart before concluding an edit did nothing

Emissary loads Git and filesystem template packages into memory at startup. An edit to a `template.hjson` or an `.html` view will not appear until the server reloads that package, so a change that seems to have no effect is usually a stale copy rather than a broken template.

## Pin the htmx and hyperscript resource paths

[qwerty-theme/includes-foot.html](qwerty-theme/includes-foot.html) resolves to `htmx-1.9.12/htmx.min.js` and `hyperscript-0.9.93/_hyperscript.min.js`, matching Emissary's own default theme. Emissary still ships legacy unversioned `htmx/` and `hyperscript/` folders holding much older engines, and pointing at one of those does not 404 — the old parser simply fails on the shared behaviors bundle and every hyperscript behavior on the page stops installing, silently. This theme has been the stale one before; on any htmx or hyperscript upgrade, sweep this repo too, not just Emissary's `_embed`.

## An unset hyperscript `:variable` is `undefined`, not `nil`

In hyperscript 0.9.93 the `is nil` / `is not nil` operators compare against `null` only, so on a fresh element `:foo is not nil` is TRUE and an init guard written that way exits immediately and never runs. Use `exists` / `does not exist` for presence checks, or the `no` operator, which covers null, undefined, and empty together.

## `hx-swap="none"` is inherited and silently discards descendants' responses

htmx inherits `hx-swap` down the DOM, so putting `hx-swap="none"` on a container poisons every `hx-boost` or `hx-get` inside it: the request fires, the server answers 200, and htmx throws the response away with no console or server error. When a boosted link "does nothing," check its ancestor chain for an inherited `hx-swap="none"` before suspecting JavaScript. `hx-disinherit="hx-swap hx-push-url"` on the container fixes it while leaving the container's own swap behavior intact.

## `class="turboclick"` on a container is intentional

Emissary's turboclick fires its synthetic click on the element actually pressed, not on the nearest `.turboclick` ancestor, so nested links, buttons, `hx-get`s, and hyperscript `on click` handlers all still fire. Container-level turboclick is correct — don't "fix" it by moving the class onto children. If a click inside a turboclick region does nothing, the cause is almost certainly the `hx-swap` trap above.

## `css` and `cssValue` are two different trust levels — pick deliberately

Both cast a string to trusted CSS, but they earn it differently. `css` is a raw, unvalidated cast, kept for exactly one job: emitting the site owner's own hand-written stylesheet in [qwerty-outbox/stylesheet.html](qwerty-outbox/stylesheet.html), where the input is the owner's `data.stylesheet` field. `cssValue` validates a single computed property value against a conservative character allowlist and rejects `expression` and `url` spellings, returning empty rather than emitting anything unsafe. Anything a template *builds* — a concatenated gradient, an interpolated color — goes through `cssValue`.

## Every collection item has a Replies tab

`qwerty-article`, `qwerty-photo`, and `qwerty-entry` extend `qwerty-replies`. Each view calls `{{template "replies-tabs" (array . "Article" "page")}}`, then shows `{{template "replies-panel" .}}` instead of its content when `?tab=replies`. The photo modal passes `"modal"`, so its tabs re-open the modal (`/{id}/modal?tab=replies`) instead of reloading `<main>`. The tab bar is left out when the item neither accepts replies nor has any, so a private collection's items show none. A podcast episode passes a fourth value, `"count"`. Its second tab then reads "0 Replies", "1 Reply", or "3 Replies" from `.ReplyCount`, and the bar is left out whenever replies are closed (`.RepliesClosed`, from the podcast), even if some arrived earlier. The episode's views also show the notes for `?tab=replies` while replies are closed.

- **Only a public item accepts replies.** Emissary records a reply only when the item's `AcceptsReplies` is true: its policy is not "nobody", and it is shared with everyone. So an item in a collection shared with Circles cannot receive replies, and `replies-panel.html` says so.
- **A signed-in visitor's Reply opens their own inbox's reply form** (`/@me/newsfeed/browse-reply?url=…`), as `base-social/reply-button.html` does. Only a signed-out visitor gets the intent below.
- **The Reply button is an Activity Intent:** `/{id}/intent?intent=create&inReplyTo={permalink}` opens `base-intent`'s modal, which sends the visitor to their own server to write the reply. A server that publishes no intent template falls back to a known software's share URL (Camper), so on Mastodon the visitor writes a new post that links here, not a threaded reply. `qwerty-article` replaces `base-intent`'s modal with its own `intent.html`, which must read `?intent=` itself: until 2026-10-16 it sent every intent as a Follow, so an Article's Reply button followed the author instead.
- **Who may reply is the collection's `replyPolicy`,** chosen on a Timeline or a Calendar in its `replies-policy` modal ("Replies: Everyone" or "Replies: Closed" in its ⋯ menu) by Emissary's own `set-reply-policy` step. Reply controls live in Emissary, not here (emissary-specs REPLY-CONTROLS): Emissary enforces the policy when a reply arrives (`model.Stream.AcceptsReplyFrom`, which still admits the author and mentioned actors), and publishes it to other servers. An Article collection, a Photo Gallery, a Map, and a Podcast offer it instead as one toggle in Edit Collection, over Emissary's virtual boolean `allowReplies` (TRUE is `everyone`, FALSE is `nobody`), with `share-children` after the save, and its ⋯ menu has no Replies item. Items inherit it with their sharing, so their publish dialog offers no reply choice: an item's own choice would be overwritten on its next save. Closing replies keeps the ones already received.
- **The list reads the Replies collection,** `ReplyLinksAfter`, 20 at a time with a `revealed` sentinel, and loads each reply through `.ActivityStream`. Never switch it to `RepliesAfter`: that returns every cached document whose `inReplyTo` points here, including replies refused while replies were closed. `.ActivityStream` also stamps the viewer's rules, so a reply they hide shows `base-social`'s `hidden-placeholder`, which re-draws it through the `reply` action with `?reveal=true`.
- **Never load a reply's author with `AttributedTo.Load`.** It returns an error when the author's server is gone, and an error aborts the whole tab. `reply-item.html` loads the author through `.ActivityStream`, which reports the error and returns an empty document.
- **Never mark a reply's links `safeURL`.** They come from other servers, and `html/template`'s own filter is what turns a `javascript:` link into `#ZgotmplZ`.
- **No live updates yet:** a new reply shows on the next load. Emissary sends its `new-replies` SSE event only for replies written on this server.

## A new funcmap helper couples this repo to a minimum Emissary version

Go's `html/template` resolves function names at **parse** time, so calling a helper that the running server's template funcmap does not define does not degrade that one expression — the entire template fails to parse and the page dies. Helpers like `cssValue` arrive in Emissary through its pinned `benpate/rosetta` dependency, so a template edit that adopts a newly added helper cannot deploy until Emissary itself ships a build carrying it. Check that the helper exists in the target server's build before using it in a template here.

Today that means `inTimezone` (event times, `qwerty-common/event-dates.html` and the calendar), the `share-children`, `localize-dates`, and `anchor-dates` steps, `upload-attachments`' `fill` action, the Stream builder's `AcceptsReplies` and `RepliesClosed` with the Stream's `replyPolicy` field, and the `set-reply-policy` step, all from the Emissary build of 2026-10-15. The Stream builder's `CircleSharingStatus`, which labels a collection's Sharing menu item, is from the build of 2026-10-17. An older server fails to load the templates that use them.
