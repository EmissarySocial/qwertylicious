# Qwertylicious — Notes for AI Agents

Qwertylicious is an Emissary template package for long-form writing. A running Emissary server installs it through a Git package adapter; it is never compiled or deployed on its own. See [README.md](README.md) for the product. Each top-level folder with a `template.hjson` (or `theme.hjson`) is one template, and the `.html` files beside it are its views. `meta/` and `tests/` are not templates.

Notes go in this file, never inside a template folder (see "A bundle folder holds only source").

## The templates

**A template registers under the `templateId` in its file, not its folder name** (`service.Template.Add`). `placemark`, `event`, and `timeline-entry` are roles, not IDs.

| ID | Model | What it is |
| -- | ----- | ---------- |
| `qwerty-outbox` | Outbox | The profile page (role `user-outbox`): the profile card, the tabs, and the open tab loaded in place |
| `qwerty-collection` | Stream | A profile tab in one of twelve formats (`data.layout`). Five list Articles. Photo Gallery, Map, Timeline, Calendar, and Podcast each hold their own item template, which `add` picks from the format. Notes and About hold nothing |
| `qwerty-article` | Stream | An Article, only inside a collection |
| `qwerty-photo` | Stream | A post of 1 to 16 photos in a Photo Gallery |
| `qwerty-placemark` | Stream | A place on a Map: a required `location`, no dates |
| `qwerty-timeline-entry` | Stream | A Timeline entry: date-only `startDate` and optional `endDate`, optional location |
| `qwerty-event` | Stream | A Calendar event: a required `datetime` start, optional location |
| `qwerty-episode` | Stream | A Podcast episode: one audio track and a Markdown description |
| `qwerty-common` | None | No actions. Shared views (the card layouts, `profile-tabs`, `profile-menu`, `event-dates`) and the datasets. The outbox, the collection, the episode, and the three entry templates extend it |
| `qwerty-replies` | None | The reply and response partials, and the `replies-list` and `reply` actions. Every collection item extends it |
| `qwerty-theme` | — | The site theme (a `themeId`), extending Emissary's `global` |
| `qwerty-search` | Stream | **Parked** (see "A `z-` filename prefix parks a template") |

**A collection never changes format.** Edit Collection offers an Article collection only the Article layouts, and every other format only its own settings (a Photo Gallery's or Podcast's order, a Calendar's view). A collection has no page of its own: `view` redirects to its tab, and `list` is the tab's content.

**Every `settings-*` action begins with a `require` that refuses any other format, because every action is also its own URL.** Edit Collection (`settings`) holds the modal, `settings-title`, and `refresh-page`, and its `switch` on `data.layout` includes one `settings-*` action per format. Reached directly, `settings-notes` would share a private collection with everyone and copy its reply policy onto every Note, and `settings-articles` would give any collection an Article layout. `settings-articles` is the switch's default, so its guard lists the switch's other cases, and the two lists must agree.

**The three entry templates duplicate their views on purpose,** because they are expected to diverge. Each has the Stream's own `location` (the `place` widget) and `data.tags`, which filter its collection. The page and the modal share `entry-body.html`, which draws the static map. `entry-byline.html` is on the page only.

**No ID here may also ship in Emissary's `_embed/templates`.** Emissary registers templates by ID, and the location loaded last (the order of the config's `templates` entries) wins for the whole server, not just for Qwerty users. To find the definition serving a role, check both repositories and the load order.

## Browser tests live in `tests/playwright`

Playwright checks the theme's styles and scripts in Chromium and WebKit, light and dark ([tests/playwright/README.md](tests/playwright/README.md)). The fixtures copy rendered markup, so a markup change needs the same change in its fixture.

## A bundle folder holds only source, because every file in it is concatenated

`bundles:` names a folder and a content type. Emissary's `populateBundle` concatenates **every** file in that folder, dotfiles included, skipping only subdirectories, and minifies HTML, CSS, and JavaScript bundles. A stray `README.md`, `.DS_Store`, or editor backup ships inside the served bundle. The bundle folders are `qwerty-article/stylesheet`, `qwerty-outbox/stylesheet`, and `qwerty-theme`'s `stylesheet`, `maps`, `carousel`, and `podcast`.

**A bundle's URL names the template by ID, never by role:** `/.templates/qwerty-outbox/stylesheet`. `/.templates/user-outbox/stylesheet` finds Emissary's own `user-outbox`, which has no bundles, and answers 404.

A theme's `resources/` folder is served one file per URL, so nothing there corrupts a bundle, but anything dropped in is publicly downloadable.

## Dark mode flips each gray's lightness, and never reverses the light list

[01-colors.css](qwerty-theme/stylesheet/01-colors.css) defines `--gray00` through `--gray100` for each colorway (stone, neutral, slate), and its dark block redefines them. **A dark gray is its light gray with the lightness flipped,** so light mode's token mapping (`--text-color: var(--gray80)` and the rest) works unchanged in dark mode.

- **Never reverse the light list.** The light scale is packed near white (six steps from `gray00` to `gray05`), so a reversed list puts every token at the wrong lightness.
- **The anchors are computed.** Each light anchor (`gray10` through `gray90`) has its OKLab lightness flipped, raised to the power 0.7, and mapped from `#161616` (`gray00`) to `#ffffff` (`gray100`), keeping its hue with its tint capped at the light palette's.
- **The fine steps follow the anchors.** `gray01` to `gray05` split `gray00`–`gray10` into equal steps, and `gray15` is the midpoint of `gray10` and `gray20`.
- **`--white` and `--black` never flip.** Use them for color on photos and saturated accents; page surfaces use `--gray00` and `--gray100`.

## The theme's settings are Domain `themeData`, and each select lists its default first

The settings form in [theme.hjson](qwerty-theme/theme.hjson) ends with two selects, Colors and Navigation, which [page.html](qwerty-theme/page.html) reads through `.ThemeData`.

- **The default must stay first.** A Domain that never saved the form has no value, and `.ThemeData` falls back to the schema's `default`. The select marks no option selected, so the browser shows the first, and the first save writes it. With the default first, the page and the form agree.
- **An invalid post is dropped, not saved.** The form refuses a value outside the enum (and the empty string, through `required`) and logs it only at debug level.

**Colors** (`themeData.colorway`) goes into `<html data-theme>`. A new colorway needs a light and a dark `:root[data-theme]` block, a schema `enum` entry, and a select option. An undefined name falls back silently to Emissary's global grays, which `includes-head.html` loads first. `theme-global`'s own pages (sign in, password reset, OAuth) write their own `<html>` and always use the global grays.

**Navigation** (`themeData.navigation`) at `authenticated` leaves out `navigation-desktop` (the skip link, the sidebar, and the mobile menu) for a visitor who is neither a signed-in User nor a guest Identity. Guests keep it, because its Profile link is their way back to `/@guest`. Anonymous visitors sign in at `/signin`. Any other value shows the navigation, so a bad value fails open.

## Every nested rule in the theme's button block weighs as much as an ID

[qwerty-theme/stylesheet/02-forms.css](qwerty-theme/stylesheet/02-forms.css) styles buttons in one block whose selector list includes `#menu-bar button` and `#menu-bar .button`, with `&:hover`, `&.primary`, and the rest nested inside it. A nested `&` resolves as `:is(...)`, which takes the specificity of its most specific argument, so every one of those nested rules applies to every button on the page with one ID's weight, not only in the menu bar. No class selector outranks them: Emissary's `upload-multiple` X turned light gray with a dark glyph under the mouse until its colors were made `!important` (Emissary `theme-global/AGENTS.md`, 2026-11-04). A widget or template that styles its own buttons on a Qwerty page meets the same wall. Moving the `#menu-bar` selectors into a block of their own, or wrapping them in `:where()`, would end it, but would also change which rule wins for every button the theme draws, so it waits for Ben.

## Icon buttons name themselves in `data-tooltip`, never `title`

[03-widgets-tooltips.css](qwerty-theme/stylesheet/03-widgets-tooltips.css) draws `data-tooltip` instantly, centered above the element, as its `::after` with a `::before` arrow.

- **Leave `title` off,** or the browser's delayed label appears beside it.
- **Put the same text in `aria-label`,** so what is shown and what is read agree.
- **The element's own `::before` and `::after` are taken,** and it becomes `position: relative`.
- **Hover shows it only where there is a pointer** (`@media (hover: hover)`); `:focus-visible` shows it everywhere.

## Collection items open as modals over their tab

A photo, place, timeline entry, event, and episode share one pattern. Its `view` includes its `modal`, drawn over its collection's tab through `as-modal`'s `background-url` (``/@{{(.Parent `view`).ParentID}}?tab={{.ParentID}}``), with its own URL (`replace-url`) and `head.html`. When that lookup fails or the visitor cannot see the profile, the item's `page` action is drawn behind it instead (`background: "page"`). Emissary's `modal-url.js` restores the tab's address on close, and peers still get JSON-LD at `/{id}`, because content negotiation runs before any action.

- **`/{id}` answers an htmx request with the modal.** Anything that reloads an item's page with `hx-get` uses `/{id}/page`.
- **A page drawn behind a modal leaves out its link-preview tags.** `qwerty-outbox/outbox.html` skips its canonical link and `og:` tags when `.IsBackground` is true.
- **Write the title with `id="modal-title"`.** Emissary's `Modal` behavior adds that id after the first paint, and `#modal #modal-title` resizes the title to 32px, so without it every title visibly jumps.
- **Sizes:** a photo is `class:large` (1024px), and Add Photos and Edit Photo are `class:medium` (800px). An episode, timeline entry, and event are `class:medium` (800px), and their editors keep the default (600px), as a place does.
- **The modal is outside the page's container,** so `sm:` classes never apply in it. Use Emissary's `mobile-hide`, a window media query.
- **No `<input>` in a modal that uses the keyboard.** The `Modal` behavior focuses the first `<input>`, which swallows the keys. That is why the podcast progress bar is a `div`.
- **A timeline entry's modal starts with a sticky bar** (`entry-neighbors.html`) linking the previous and next entries in the tab's order and `?tag=` filter. It walks the whole list rather than using `WhereGT`, because date-only entries often share a date. Its arrows and the Left and Right keys go through the carousel bundle's `[data-modal-go]` handler. The bar comes before the `h-event`, so the corner pencil and X paint over its right end, and it keeps room for them.

**A photo post** holds 1 to 16 photos, which change through its `photos` action (see "A photo post's photos change through one action"). Its first photo is its thumbnail (`set-thumbnail`), and a post of more than one shows as a carousel (marked by `data.photoCount`). It publishes as soon as it is saved. Pinned posts (`isFeatured`) lead a Chronological gallery. Its `data.tags` (`tagPaths`) are the #hashtags its gallery's filters match.

## A Photo Gallery or Article collection sorts by date or by rank

`data.sortType` is `publishDate` (Chronological, newest published first, which `create` sets) or `rank` (Custom). Every view reads anything but `rank` as Chronological, so a collection saved before the field existed has none, and the older `createDate` still validates. These places read it and must agree:

- **A Photo Gallery:** `items-gallery.html`, `items-gallery-page.html`, `qwerty-photo/photo-figure.html` (the modal's neighbors), and `qwerty-photo`'s `edit` action.
- **An Article collection:** `items.html`, and `qwerty-article`'s `properties` action.

The rules:

- **Custom is rank, highest first, and ignores pins and Featured.** Emissary ranks a new child one above its highest sibling, so a new item lands on top, and a collection switched to Custom keeps its creation order. The photo's Edit form and the Article's Properties form leave out their toggles, so `isFeatured` survives a switch back.
- **The `sort` step must match the list's own direction,** which is `desc` everywhere except a Podcast set to `asc`. The gallery's tiles post only the pages loaded so far, which hold the highest ranks. A descending sort numbers them down from the highest rank among them, so the photos not yet loaded keep their places; an ascending sort numbers them from 1 and collides with those photos.
- **A drag starts only from the handle** (Sortable's `handle` option). Emissary's turboclick skips `.drag-handle`, and the gallery's handle halts its own click, or pressing it would open the photo instead.
- **`gallery-tiles` takes `(array $posts $canEdit $isCustom $canSort $tag)`.** `$isCustom` hides the pin mark, `$canSort` adds the handle and the hidden `keys` input that the form posts, and a `$tag` opens each tile's modal with `?tag=`.
- **An Article collection's Sortable lives in `qwerty-common/layout.html`.** A non-empty `$sortURL` draws the list as a form that posts the new order there, and each card template adds its handle and key. Sortable drags `>div`, the card's outer wrapper, so nothing else may sit directly inside that form.
- **Every sortable list installs Emissary's `sortContainer`, and no template loads Sortable itself.** The behavior loads the library once per page, so revisiting a tab does not run it again. `data-sortable-handle` and `data-sortable-draggable` carry the list's options. The rule and its reasons are in Emissary's `_embed/templates/theme-global/AGENTS.md`.
- **A sort form's `hx-push-url="false"` must stop at the form.** The form needs it, or posting a new order pushes `/sort` into the address bar. htmx passes it down to every card, though, so without `hx-disinherit="hx-push-url"` an article opened from a Custom collection keeps the tab's address, and a reload returns to the tab. The gallery's form carries the same pair, though each tile sets its own. `tests/playwright/articles.spec.mjs` checks both halves.
- **Ranks can tie.** `MaxRank` is a read-then-write, so two items created at once on two servers can share a rank, and `?rank=LT:` paging then skips one of them at a page boundary.

## A Photo Gallery, Article collection, Calendar, Map, or Timeline filters by the tags it lists

These five formats' Edit Collection forms hold `data.tags`, an ordered list edited with the `list` widget in their Featured tab. Each value becomes a pill above the items, in the author's order, after an All pill, and a pill shows the items whose own `data.tags` carry it. A collection with no tags draws no pills. Photos, Articles, events, places, and timeline entries all declare `tagPaths: ["data.tags"]`, which is what the filter matches. Until 2026-11-05 a Map's or Timeline's pills were the tags its items carried, so one saved earlier shows no pills until its owner fills the list.

- **The list is collected with `range`, never through `tagPaths` or a bare `if`.** `tagPaths` would pass the tags through `NormalizeTags`, which sorts them alphabetically and loses the author's order. Read in the same request as a save, the list is a `*sliceof.String`, which an `if` calls true even when it is empty, and `range` iterates it, the list MongoDB returns, and a missing key alike. `tag-pills.html` drops a repeated tag as it draws the row.
- **A value is stored and shown as typed** (Ben, 2026-11-05). The `list` widget trims each value and drops blanks and repeats that differ only in case, and nothing adds or strips a "#", so a value typed as "#travel" shows as "#travel" and matches no item, whose stored tag names carry no "#".
- **The Featured tab is always second, right after General** (Ben, 2026-11-05). The schema allows 12 values of 64 characters at most.
- **The list has no label or description of its own** (Ben, 2026-11-05). A `label` element above it says what the values do, and the five copies change together. The `list` widget names each row's input from the element's label, so without one the rows have no accessible name.
- **The field must never set `required`, `minLength`, or an item `pattern`.** Its tab is hidden while General is open, and the browser cannot show the message for an invalid control there, so the Save would do nothing (Emissary `theme-global/AGENTS.md`).
- **It needs an Emissary built with benpate/form's `list` widget.** An older server fails the five edit forms' render with "Unrecognized form widget"; every other page still draws.
- **Only a listed tag filters, and the match ignores case.** An item's tags do pass through `NormalizeTags`, which swaps in whatever spelling the server already knows, so `Sunset` on the collection may meet `sunset` on an item. Eight views each check `?tag=` against the list, show All for anything else, and add `.CaseInsensitive` to the query, and they must agree: `items-gallery.html`, `items-gallery-page.html`, `qwerty-photo/photo-figure.html`, `items.html` (Articles), `items-calendar.html`, `items-map.html`, `items-timeline.html`, and `qwerty-timeline-entry/entry-neighbors.html`.
- **Only All drags.** A descending sort numbers the posted items down from the highest rank among them, so sorting a filtered few would move the hidden items between them. While a tag is selected, a Custom gallery draws no sort form and its tiles no handles, and a Custom Article collection passes `layout` no `$sortURL`.
- **The filter rides along.** In a gallery, `gallery-more` adds `&tag=` to the next page's URL, and each tile opens its modal with `?tag=`, so scrolling and the modal's neighbors keep to the filter. Saving a photo's edit returns to `/{id}/modal` without it, so the neighbors widen to All after an edit. In a Calendar, the pills keep `?view=` and `?startDate=`, and every toolbar link (Previous, Today, Next, and the three views) keeps `?tag=`. A Timeline entry opens with `?tag=`, and its neighbor bar walks the same filter. Articles, events, and places have no neighbors, so nothing more is needed there.
- **`tag-pills.html` draws the row for every format,** called as `(array $collection $tags $selected $query)`. `$query` is the tab's other parameters without a leading `&` (a Calendar's `view=…&startDate=…`), and is empty elsewhere. Every format passes its own list. `tag-empty.html` is the note under the pills when a gallery's, Article collection's, or Timeline's tag matches nothing; a Calendar's List says it in its own empty row, and a Map draws no markers.
- **A pill scrolls its row to the top of the window, and only the pills do.** Each one's `hx-swap` ends in `show:.qwerty-tag-pills:top`, which htmx looks up across the whole page once the new tab is in, so that class must stay on this row and nowhere else. htmx splits `hx-swap` at spaces, so the selector cannot hold one: `show:find .pills:top` is read as two settings, and neither scrolls. A short tab stops wherever the page ends. The profile tabs, the Calendar's toolbar, and the profile's first load keep `show:none`. `tests/playwright/tags.spec.mjs` checks it.

## A photo post's photos change through one action

Add Photos and Edit Photo both draw an `html-remote` element labelled Photos, the form library's plain loader, whose `url` names the post's `photos` action: `/{{.ID}}/photos` on Edit Photo, and the collection's `add` with the action in its query on Add Photos, `/{{.ParentID.Hex}}/add?action=photos`, because the post has no route of its own until it is saved (emissary-specs `projects/UPLOAD-MULTIPLE-WIDGET.md`, adopted here 2026-11-04). The element binds nothing to the Stream: it draws one empty shell, and Emissary's `edit-attachments` step on the `photos` action draws the whole zone inside it, so the field name, the types, and the limits live on the step alone (Ben, 2026-11-04). Earlier that day this was an `upload-multiple` widget of Emissary's form library, which Ben removed in favor of `html-remote` with a URL the template writes. The post's `photos` action is where the photos live: it runs `edit-attachments` on the `photo` category, then `set-thumbnail`, the `photoCount` `set-data`, and `save`, so every change re-picks the thumbnail and recounts.

- **On a saved post every change is immediate.** The row of tiles loads from `/{id}/photos`, the plus tile after it adds one photo at a time (its picker is single-select, and a drop of several takes the first) and uploads it at once with a bar across its tile, the X, which shows while the mouse is over its tile or focus is inside it, deletes after a confirm, and a drag of the tile or an arrow key on it re-ranks, each answered with the row drawn again. The tile is its own handle: Ben removed the handle buttons on 2026-11-04. The plus goes at the 16th photo and returns when one is deleted. Edit Photo's Save carries no photo and never waits for an upload, because the widget's requests are its own and not the form's (Ben, 2026-11-04); the `edit` action has no attachment step, so a stale form that still posts a file drops it. Cancel does not undo an upload; the tile's X does.
- **On a new post each photo is staged under the User at once** (Ben, 2026-11-04). The post does not exist until the Save, so the widget posts each dropped file to the collection's `add` with `?action=photos`, where Emissary's `add-stream` mints the post as it does for the form and runs its `photos` action on it; `edit-attachments` sees a post that is not saved, files the photo under the User, and answers with the tile the widget appends, halting there, so the `photos` action's later steps, its `save` among them, run only for a saved post; until 2026-11-05 the answer ran on into that `save`, and every dropped photo wrote one more empty post. The X on a staged tile deletes it the same way, with no confirm, and a reorder moves its hidden order input. The Save posts those IDs and no file, and `create`'s `{do:"include", action:"photos"}` after its form has `edit-attachments` adopt them onto the minted post, in tile order, before `process-content` and `save-and-publish`. The `photos` action's own `save` runs first, so a new post is written twice. A Save with no photo is stopped in the browser ("At least 1 file is required", beside the Save), and the step refuses one that gets past it, so the form stays open either way. A Save past the 16th photo is stopped in the browser too, and the step keeps the first 16 in tile order of one that gets past it; the rest stay staged. A staged photo whose form is never saved is deleted by Emissary's daily `PurgeStagedUploads` task after a day.
- **The element and the step are linked by nothing but a test.** Each `html-remote` URL must name an action on this template holding `edit-attachments`, by its last path segment or by `?action=` on the collection's add, and `create` must include that action: the include is what adopts the staged photos at the Save, and Emissary's `add-stream` runs an action on an unsaved post only when `create` includes it, so without the include every drop on Add Photos is refused with a 400. Emissary's `TestUploadMultiple_WidgetAndStepAgree` (`tests/uploadmultiple_test.go`) checks every template here whenever this repo is checked out beside Emissary.
- **Add Photos and Edit Photo are the same two-tab form** (Ben, 2026-11-04): Images holds Photos and Pin to top, and Text Content holds Title, Description, and #Hashtags. hjson cannot share a form, so its three copies in `template.hjson` must be changed together: Add Photos, and Edit Photo's two, because a Custom gallery's leaves out Pin to top. Only the title, the modal's buttons (Add Photos keeps the form's own Save and Cancel, Edit Photo draws Save and X through `edit-pencil`), Pin to top, and the steps after the form differ.
- **The limits are the step's:** at least 1 and at most 16 photos (`photoCount`'s schema maximum; 64 until Ben lowered it on 2026-11-04), images only, stored as webp. The browser reads them from the row on both forms, which the `photos` step draws on a saved post and on a new one alike, so the plus goes at the 16th photo on both. A post outside its limits, such as one seeded with no photo or one with more than 16 from before the limit was lowered, can still take a photo or be sorted, but its Save is stopped until a photo is added or deleted (Ben, 2026-11-04). All three forms' descriptions say the same limit, so a change to the step changes four lines.
- **It needs the Emissary build of 2026-11-04** for the widget, the step, and the theme's script and styles; an older server fails to load `qwerty-photo`.
- **`tests/playwright/photo.spec.mjs` drives it** against `server.mjs`, which answers the `photos` action as the step does, on a saved post and through the collection's `add` before the Save. Its `zoneLoaded` waits for the row and for `data-upload-multiple-ready="true"`, because the zone arrives in the same swap as its row and Emissary's script wires it only once the swap settles; a drop dispatched before then lands on a zone with no listeners. A post seeded with no photo draws an empty gallery tile that cannot be clicked, so the spec opens its editor with `htmx.ajax`.

## The corner pencil toggles between an item and its editor

Every item modal (photo, episode, place, timeline entry, event, and Emissary's Note) and the Article's page put a pencil in the top right corner.

- **On the view,** an outline pencil opens the editor, and in a modal an X beside it closes the modal. There is no Close button.
- **On a modal's editor,** `edit-pencil.html`, drawn by a first `view-html` step before the `edit` form, shows Save and an X (`aria-label="Cancel"`) that returns to the view. On the Article's edit page, a filled `primary` pencil (`aria-pressed="true"`) returns to the view.
- **Saving returns to the view.** After `as-modal`, the edit action removes `closeModal` (`remove-event`) and answers with a 303 to `/{id}/modal`, which htmx follows as a GET. It must stay a 303, because a 307 re-POSTs the form. The redirect drops the POST's `HX-Trigger` events, so the list behind the modal is not refreshed.
- **Styles live in the theme** (`.edit-circle` and `.corner-pencil` in `qwerty-theme/stylesheet/02-forms.css`). Emissary's global theme also defines `.corner-pencil`, for the Note on other themes. The pencil's parent must be positioned.

## The photo carousel is one delegated script

`qwerty-theme/carousel/qwerty-carousel.js` (the `carousel` bundle, loaded once by `includes-foot.html`) runs `qwerty-photo/photo-figure.html`'s carousel: a transform-driven track, arrows, the Left and Right keys, and a swipe that locks to an axis after 8px and commits past 50px.

- **Every listener sits on `document`,** so swapped-in carousels need no setup, and `window.qwertyCarousel` guards against installing twice.
- **Past the first or last photo, the keys go to the neighboring post,** by clicking the figure's hidden `a.qwerty-carousel-post-prev` and `-next`, which the server computes in the gallery's order and `?tag=` filter with `Siblings`. Swipes and buttons stay within the photos.
- **`photo-figure` takes `(array $builder $mode)`.** In `"modal"` mode the neighbor links re-open the modal; in `"page"` mode they load the next page.
- **The keys drive the carousel in `#modal` when one is open,** otherwise the one in `<main>`, and never while focus is in a text field.

## Podcast episodes play from one delegated script

A Podcast's tab (`items-podcast.html`) is the feed's link and a table of episodes by rank, highest first unless `data.sortDirection` is `asc`; the modal's neighbors and play-next follow the same order. An episode's date is its `publishDate`, edited through Emissary's virtual `publishDateTime`: UTC, like every date display, and a save within the same minute keeps the stored seconds. A Timeline is always in date order, oldest first. An episode uploads one track (category `Audio`, ID in `data.attachmentId`, URL in `data.audioUrl`), and its `audio` action serves it transcoded (`/{id}/audio?format=mp3`). Every save writes `data.enclosureUrl`, which Emissary's feeds turn into an RSS enclosure and a JSON Feed attachment, so the collection's `feed` is the podcast. A collection's description (`summary`) is Markdown on the page, but the feed's channel description carries its source text unconverted. The player is `qwerty-theme/podcast/qwerty-podcast.js` (the `podcast` bundle), not Emissary's `MediaPlayer`.

- **One `<audio>` element, on `<body>`.** It outlives the modals, because browsers (iOS Safari above all) start audio without a gesture only on an element that has already played. A new `<audio>` per modal breaks autoplay of the next episode.
- **The list's play button starts the audio in its own click,** before its `hx-get` opens the modal. Play, pause, and skip carry `turboclick`, which fires on mouse-down (still a user gesture) and swallows the click that follows.
- **A click anywhere on a row opens its episode** by clicking the row's name link (`[data-episode-row]`).
- **Keys:** Up or Left opens the episode above, Down or Right the one below, and Space plays or pauses unless it would press a focused control. The neighbors are hidden links computed with `Siblings`, mirrored by the `[data-episode-go]` arrows, which are disabled (not removed) at either end so the controls keep their shape.
- **When an episode ends,** the script opens and plays the next, accepting a modal only when its `data-episode-id` is the one it asked for, and skipping episodes without audio. Closing the modal stops the audio (`closeModal`).
- **Moving between episodes fades with plain CSS, never a view transition.** Safari leaves the underlay's `backdrop-filter` out of view-transition snapshots, so the page behind went sharp. `goTo` marks the leaving episode `data-leaving` and `<html>` `.qwerty-episode-arriving`, and `collections.css` fades in the arriving one.
- **`.text-gray` is an opacity, not a color.** On a table cell it fades the cell's background too, so put it on the text inside.

## Maps load Leaflet and the `maps` bundle in either order

A Map tab (`items-map.html`) and an entry's `entry-body.html` draw maps with `qwerty-theme/maps/qwerty-maps.js` (`/.themes/qwerty-theme/maps`). A map is a `.qwerty-map` whose `data-*` attributes carry tiles, center, and zoom, with `.qwerty-map-marker` children. A marker with `data-modal-url` opens that modal on click (through `htmx.ajax`); any other marker's pop-up is server-written HTML, so the script never builds HTML from data. htmx loads swapped-in `<script src>` asynchronously, so Leaflet and the bundle each call `qwertyMaps()` on load, and the call waits for `window.L`.

A Map's default view is its own `location` and `data.zoom`, set only in Edit Map. A new Map starts over Los Angeles at zoom 11. A saved zoom that the menu does not list shows blank in Edit Map, and saving keeps it.

## Collection items take their sharing from the collection

`qwerty-collection` sets `shareWithChildren: true`, so every item takes the collection's sharing and reply policy whenever it saves, and a collection whose sharing changed re-saves its items. No item has a Sharing action, and a published item is visible to the collection's `viewer` role, not to `anonymous`. Emissary does this in `Stream.Save`; see its `service/AGENTS.md`.

## Event times are site-relative, and the calendar grid is UTC dates

`items-calendar.html` does its date math in the template (`AddDate`, `printf "%d"` on a `time.Weekday`, `Format "2006-01-02"` keys compared as strings). An event's time is stored as the clock reading its author typed, in UTC, and shown unconverted, so it sits on the typed day and time. "Today" is the server's local date moved onto that grid. **Never add a timezone on one side only;** emissary-specs BUG-283 §7a has the design for real ones. A Timeline is date-only.

## The theme's `<body>` pushes every `hx-get` into the address bar

`page.html` sets `hx-push-url="true"` on `<body>`, and htmx inherits it. Give any new opener inside a profile `hx-push-url="false"`. Modals are safe anyway, because Emissary's `WrapModal` sends `HX-Push-Url: false`. A profile's `refreshPage` listener (`outbox.html`) rebuilds the page from the address bar's `?tab=`, falling back to the tab selected on screen when the address bar names none.

## A tab's own query parameters ride along in the profile's URL

A Calendar's `?view=` and `?startDate=`, and the `?tag=` of every format with tag filters, are the tab's state. Its links reload `#profile-tabs` and push `/@user?tab={id}&…`, and `outbox.html` passes them to the tab's `/list` URL, so reloads and shared links keep the view. **Never name a new parameter `createDate`, `publishDate`, `updateDate`, `expirationDate`, `rank`, or `label`:** a Stream's children query applies those as filters. A Photo Gallery's infinite scroll relies on exactly that (`?publishDate=LT:{last}`, or `?rank=LT:{last}` when Custom).

## A `z-` filename prefix parks a template

`qwerty-search` holds `z-template.hjson`, so Emissary never registers it while its views stay in the repo. Renaming the file to `template.hjson` re-enables it. Don't tidy the prefix away, and don't assume a folder with views is live.

## The profile page is the frame, and every tab loads inside it

`/@user` (`outbox.html`) draws the profile card (`profile-header.html`), then `#profile-tabs`: the tab bar (`qwerty-common/profile-tabs.html`: the collections in the owner's order) above a panel that loads the open tab. Each tab's content (a collection's `/{id}/list`) is a new `#profile-tabs` that redraws the bar with its own tab selected.

- **The open tab is `?tab={collectionId}`, `?tab=notes`, or `?tab=about`.** `outbox.html` accepts only a visible collection, or `notes` or `about` (mapped to the first collection in that format), and falls back to the first tab, so a crafted value never reaches the page.
- **A profile with no collections has no tabs.** `outbox.html` shows `outbox-empty.html` in their place: a visitor's note, or the owner's prompt to make one. Every `profile-tabs` caller can assume a collection exists.
- **A tab swaps `#profile-tabs` whole and replaces the profile's URL,** never the partial's, so reload and copied links ask for a full page. It replaces rather than pushes, so switching tabs adds no history: Back from an item returns to the tab it was opened from, not through every tab visited before. `hx-push-url="unset"` is what cancels `<body>`'s inherited push, as on the Article's corner pencil. Each tab keeps a stable `id` (`tab-{id}`) so htmx can restore focus.
- **Only the page's own `#profile-tabs` has `hx-trigger="load"`,** and it sets `hx-target="this"`, `hx-push-url="false"`, and `hx-disinherit="*"` for that first load. Swapped-in copies carry no htmx attributes, so a page restored from history does not reload the first tab, and cards inside navigate the whole page.
- **The owner's buttons follow the tabs,** beside the `tablist`, not in it, so the ARIA stays valid. `profile-tabs` takes `(array $outbox $selected)` and draws only the tabs. `list.html` draws `profile-menu.html` beside them with the collection's builder, and the page's loading copy draws none. The menu shows only to `.IsAuthor`, because a collection's author is the profile's owner, and a domain owner who can run its actions still sees no buttons. It holds icon-only `.edit-circle`s for Edit Collection, its sharing status (none on Notes or About), and its add item (Notes opens the outbox's `add-note`). About has only Edit Collection, which edits its message too. Every copy of the bar is a `.profile-tabs-row` flex row, which carries its bottom margin, so the buttons center on the tabs.
- **Both copies of the bar read the same query.** A collection's `list.html` reaches the profile through `.ParentOutbox "view"` and calls `.Outbox`. Never switch it to `.Siblings`, which hides anything outside its publish window, and a collection is never published.
- **Partials redirect when visited directly.** A collection's `view` redirects to its tab.
- **Reloads carry the tab.** The owner's `refreshPage` and SSE reloads copy `?tab=` from the address bar through `hx-vals`.

## Never put a template action where an attribute name goes

Emissary minifies each view before Go parses it, and the minifier lowercases attribute names, so `<a {{if eq $collectionID $selected}}aria-selected="true"{{end}}>` becomes `$collectionid`, an undefined variable, and the whole template fails to load. Keep actions inside attribute values (`aria-selected="{{if …}}true{{else}}false{{end}}"`), and write template strings there with backticks.

## `extends` composes templates, and the base templates live in Emissary

A template inherits actions, states, roles, schema, datasets, and views from each entry in `extends`, and a local definition wins. The bases `base-social`, `base-intent`, and `base-outbox` ship in Emissary's `_embed/templates`, so an unexplained action or role usually comes from there.

**A local view shadows an inherited one with the same name.** That is why `qwerty-common`'s shared layouts are named `layout-row`, `layout-row-reverse`, `layout-column`, and `layout-columns`. Each takes `(array $posts $canEdit $canSort)` and fetches nothing. Call the chooser as `{{template "layout" (array $layout $posts $canEdit $sortURL)}}`, with `""` for a list that cannot be dragged: `{{template}}` takes one value, and the funcmap has `array` but no `dict`. The caller handles the empty state.

## Option providers are `{templateId}.{datasetName}`

`options:{provider:"qwerty-collection.layouts"}` loads the template named before the dot and reads the dataset after it. Datasets are copied down by inheritance, so name the form's own template even when the dataset is defined in `qwerty-common`. Names without a dot (`circles`, `syndication-targets`) are built into the server.

**A wrong provider name fails silently:** the server logs it and the form renders an empty dropdown. Check the provider name first when a select is blank.

## Every profile starts with Articles, Notes, and About, from `defaultChildren`

`qwerty-outbox`'s `defaultChildren` lists three collections, which Emissary's `User.Save` creates when a User is first saved, however the account was made. Existing profiles get none.

- **Keep the entries in step with `qwerty-collection`'s `create`.** They never run `create`, so they restate its defaults (layout, `data.zoom`, `data.calendarView`, `data.sortType`, `data.sortDirection`, `replyPolicy`, and the label). Change both places together.
- **All three collections are public:** `groups.viewer.0` is the anonymous Group, `000000000000000000000000`.
- **Quote every value.** An unquoted `000…` in hjson is a string that runs to the end of the line, swallowing any key after it.
- **A bad entry stops every template from loading.** Emissary validates each entry through `qwerty-collection`'s schema at load.
- **A profile imported from another Qwerty server gets two of each,** because Emissary imports every Stream as new.
- **Defaults go one level deep.** A collection template's own `defaultChildren` would be created by `add-stream`, but never for the profile's three defaults.

## The Notes collection lists the profile's Notes, and holds none

A collection whose `data.layout` is `notes` lists `(.ParentOutbox "view").Outbox.Where "templateId" "outbox-message"` (`items-notes.html`): the Notes saved on the profile itself, where the Mastodon API, imports, and intents put them. `Outbox` already leaves out replies and applies sharing.

- **A Note is never the collection's child.** The owner writes one in the outbox's `add-note` (an `as-modal` around `add-stream` with `location: outbox`), so deleting the collection deletes no Notes, and the collection's `add` halts.
- **The Notes tab is always public, with no Sharing control.** The collection's sharing never reaches its Notes, so it could only hide the tab. A new collection starts Not Shared, so `create` and Edit Notes both run `set-sharing` (`viewer`, `anonymous`).
- **The template ID is hard-coded to `outbox-message`,** as in the Mastodon API and imports. If a Qwerty Note template arrives, change this query and the composer together.
- **Paging rides on the Outbox query's `?publishDate=` filter** (`notes-page`, `publishDate=LT:{last}`). Never call `profile-tabs` from a view with that parameter set, because its collection query would be filtered too.
- **A Note opens as a modal over `?tab=notes`** for the owner and guests; any other signed-in visitor gets their inbox's document browser (`/@me/newsfeed/browse?url=…`).
- **A link in a Note opens in a new tab.** The whole row is the modal's `hx-get`, so `.e-content`'s hyperscript adds `target="_blank"` and `rel="nofollow noopener noreferrer"` and stops each link's `click` and `keyup` from reaching the row (Emissary's `a11y` extension turns Enter into a click).
- **Pinned Notes lead the first page only** (up to 60), and the 12-a-page query leaves them out (`Where "isFeatured" false`), so paging never repeats one.
- **One Notes collection per profile.** Add a Collection offers `layoutsWithoutNotes` once one exists, and a POST for a second halts.
- **The reply toggle reaches Notes by two routes,** because `shareWithChildren` cannot: saving Edit Notes runs `share-reply-policy` on every `outbox-message`, and `add-note` stamps the policy on new Notes. A Note arriving through the API or an import keeps its own policy until Edit Notes is next saved.
- **Note content goes through `htmlMinimal`,** because a Note can arrive through the Mastodon API.

## The About collection shows the profile's About Me message, and holds nothing

A collection whose `data.layout` is `about` shows `(.ParentOutbox "view").StatusMessage` as Markdown (`items-about.html`). The message belongs to the profile, so Edit About edits two records: the collection's name and the profile's message.

- **About is an ordinary tab.** It sits wherever the owner drags it, and deleting the collection hides the tab while the message stays on the profile. There is no other way to hide it.
- **The About tab is always public, with no Sharing control,** because the message it shows is public on the profile already. `create` and Edit About both run `set-sharing` (`viewer`, `anonymous`), and `sharing` and `add` halt, as for Notes.
- **A profile may hold more than one About collection,** each showing the same message. Add a Collection offers About in both of its lists, so nothing enforces one per profile yet.
- **Profiles made before About existed have none,** because `defaultChildren` runs only when a User is first saved. Their owners add one through Add a Collection.
- **Edit About's form is written by hand** (`settings-about.html`), because an `edit` step draws its fields from one record. It copies the markup an `edit` step and Emissary's `WrapForm` produce for the same two fields, so it does not follow a later change to either; compare it with an Edit Notes modal after updating `benpate/form` or `WrapForm`.
- **Each field's name is its schema path** (`label`, `statusMessage`), because `set-data`'s `from-form` reads the form value and writes the object path under one name. `set-data` checks the schema's length limits but not the form's `required`, so an empty name falls back to `defaults: {label: "About"}`.
- **`with-parent` writes the message to the profile that owns the collection,** the same profile `.ParentOutbox` reads, never to whoever is signed in: a domain owner can open any collection's settings. Both saves run in the POST's one transaction, so the name and the message are saved together or not at all. `search-index` follows the profile's save, as on its settings page.

## Steps and template data that look safe and are not

- **`inline-error` cannot keep an `as-modal` form open.** `as-modal`'s POST always sends `closeModal`. Check before the modal, or accept the input and show the state afterwards.
- **`view-html` renders only on GET by default.** A POST that answers with a fragment needs `method: "post"` or `"both"`.
- **A delete step must never fall back to "all".** It names exactly what it removes, or does nothing.
- **A string with no `format` loses its line breaks.** rosetta falls back to `no-html`, so every Markdown field declares `format:"markdown"`.
- **Changing a location's `formatted` clears its coordinates** (`geo.Address.SetString`), and one `set-data` step applies its values in random order. Write `formatted` in its own step, first, as `qwerty-collection`'s `create` does.
- **Quote every number in a `set-data` value.** A bare hjson number reaches rosetta as a float, and a non-whole float becomes a string with two decimals, so `34.0522` saves as `34.05`.
- **hjson does not reject a malformed key; it creates a different one.** `{Label":"x"}` parses to a key named `Label"`, and whatever read `Label` gets nothing. Confirm an edit in the rendered page, not by its parsing.
- **A create step can read its collection,** because `add-stream` places the item before `create` runs. Prefer one item template per format over branching on the parent's layout.
- **A remote value goes only into an `href`,** where `html/template`'s URL filter blocks `javascript:` and `data:`. Never put one in hyperscript or any `script` attribute, and never mark it `safeURL`.

## An Article's stored format picks its editor and its save step

An Article's `content.format` is `EDITORJS` (the Visual Editor, and the default), `MARKDOWN`, or `HTML`, chosen in its Properties modal. Three places read it and must name the same three formats: the Properties select, the editor dispatcher (`edit-content.html`, which includes `edit-content-editorjs`, `-markdown`, or `-html`), and the `edit-content` action's `switch`. Anything else counts as `EDITORJS` in all three.

- **The server takes the format from the record, never the request,** so a browser cannot post Markdown into a Visual Editor article. Each editor defines `window._save()` in its own shape (EditorJS posts JSON; Markdown and HTML post a form field named `content`), and the dispatcher's `save()` and `publish()` call it. `_save()` throws on a failed response, so the page never navigates away from unsaved text.
- **A `fetch` form post sets `Content-Type: application/x-www-form-urlencoded` itself.** `fetch` with a `URLSearchParams` body adds `;charset=UTF-8`, and older Emissary builds accepted only the bare string, answering 400 "Unsupported encoding". Current Emissary (`tools/formdata`) matches the media type alone, but the explicit header keeps the editors working on any build.
- **Changing the format clears the text,** because one editor cannot read another's raw content. `properties` records the old format with `set-args` before its `edit` form applies, then blanks `content.raw` and `content.html` when the format changed. Switching to HTML instead copies the rendered `content.html` into `content.raw`, so nothing is lost. Either way it ends with `refresh-page`, so the edit page reloads into the new editor.
- **The select is `required` as a form option, never in the schema.** `Stream.Save` normalizes against the schema, which refuses an empty required value, so a schema `required` would stop every older Article without a format from saving. The form option only blocks choosing the blank entry.
- **Never restate `content.raw` or `content.html` in this schema.** A restated property replaces Emissary's whole definition. A plain `raw: {type:"string"}` falls back to `no-html`, which stripped every bold, italic, and link out of EditorJS's JSON on each save, and would strip an HTML Article bare.
- **The Visual Editor starts empty on a blank `content.raw`,** which is what an Article just switched to it holds; `JSON.parse("")` would stop EditorJS from starting.
- **The color picker is registered as `ColorPickerKeepingBreaks`, and that is what keeps a pasted line break.** EditorJS cleans a paste with only its inline tools' rules, and none of the others allows `<br>`, so a plain `ColorPicker.default` drops every pasted line break with no error (emissary-specs BUG-326). Emissary's `stream-article-editorjs` editor carries the same subclass, and `tests/playwright/editorjs.spec.mjs` pastes into both.

## The Article's stylesheet styles its two pages differently

`qwerty-article/view.html` and `edit.html` both link `/.templates/qwerty-article/stylesheet`, but its `#article > …` rules match only the public page; the edit card is `#article-editor`. Shared spacing lives in utility classes. The edit card is `overflow: visible` (`edit.css`) so EditorJS's popovers are not cut off.

**Never give this bundle a `.content` rule.** The Article is `article.content`, which the theme's `02-page.css` draws as the card's body. Emissary's `stream-article-base/stylesheet/viewer.css` makes `.content` a flex row of widget columns, which laid the Article out side by side when a copy lived here.

## A new Emissary feature sets a minimum Emissary version

A template that uses a funcmap helper (such as `toTime` or `cssValue`) fails to **load** on a server whose funcmap lacks it, because `html/template` resolves function names at parse time. A missing builder method, step option, or Emissary partial (such as `base-outbox`'s `follow-button`) fails only when a page **renders**, so the breakage hides until someone opens that page. An unknown `extends` entry halts first boot. Confirm the target server's Emissary has a feature before using it here.

**An unknown step option is ignored, not refused.** A Custom Photo Gallery needs the `sort` step's `direction` option and turboclick's `.drag-handle` exemption. On an Emissary without them, a drag numbers the posted photos from 1, and pressing a handle opens the photo.

**An unknown form path is dropped, not refused.** The episode editor's Publish Date needs Stream's `publishDateTime`. On an Emissary without it, the field renders empty and a save drops the value, logged only at debug level.

## The server caches template folders

An edit appears only after the server reloads the package: a restart, or automatically for filesystem folders when the `hotReloadTemplates` server setting is on. When an edit seems to do nothing, confirm which copy is serving before debugging (see Emissary's root `AGENTS.md`).

## Pin the htmx and hyperscript resource paths

[includes-foot.html](qwerty-theme/includes-foot.html) loads `htmx-1.9.12/htmx.min.js` and `hyperscript-0.9.93/_hyperscript.min.js`, matching Emissary's default theme. Emissary still ships unversioned `htmx/` (1.9.10) and `hyperscript/` (0.9.12) folders. Pointing at those does not 404: the old hyperscript fails on the shared behaviors, and every behavior on the page silently stops installing. On any upgrade, sweep this repo as well as Emissary's `_embed`.

## Hyperscript has no `nil`

In hyperscript 0.9.93, `nil` is an undefined variable, so `:foo is nil` is always false and `:foo is not nil` always true, and an init guard written that way never runs. Use `exists` / `does not exist`, or `no`, which covers null, undefined, and empty.

## `hx-swap="none"` is inherited and silently discards descendants' responses

A container with `hx-swap="none"` makes every `hx-get` or `hx-boost` inside it fire, get a 200, and throw the response away, with no error anywhere. When a link does nothing, check its ancestors first. `hx-disinherit="hx-swap hx-push-url"` on the container fixes it.

## `class="turboclick"` on a container is intentional

Emissary's turboclick fires on the element actually pressed, so nested links, buttons, `hx-get`s, and hyperscript handlers all still fire. Don't move the class onto the children. A dead click inside a turboclick region is almost always the `hx-swap` trap above.

## `css` and `cssValue` are two different trust levels

`css` is an unvalidated cast, used once: the owner's own `data.stylesheet` in [qwerty-outbox/stylesheet.html](qwerty-outbox/stylesheet.html). `cssValue` checks one property value against an allowlist and rejects `expression` and `url`, returning empty. Anything a template builds from data goes through `cssValue`.

## Every collection item has Replies, Likes, and Boosts

Every collection item extends `qwerty-replies`.

**A photo, episode, place, timeline entry, and event's modal draw `{{template "responses" .}}` under their content,** the item's own `responses.html`: Reply, Like, Boost, "⁂", and Share at the left, `responses-tabs` (Replies, Likes, Boosts) at the right, and `responses-list` below. Each tab redraws the item's `responses` action in place, and `?tab=likes` or `?tab=shares` opens that tab (Boosts keep the `shares` name in the URL and in `ShareCount`). Likes and Boosts list the first 60 through `responses-actor`, which loads each actor through `.ActivityStream`. The bar is written into each `responses.html` on purpose, not shared.

**An Article's and an event's own page show tabs instead:** `{{template "replies-tabs" (array . "Article" "page")}}` (the event passes `"Details"`), then `replies-panel` in place of the content when `?tab=replies`. The bar is left out when the item neither accepts replies nor has any.

- **Only a public item accepts replies.** Emissary records a reply only when `AcceptsReplies` is true: the policy is not "nobody" and the item is shared with everyone. So items in a Circles-only collection cannot receive replies.
- **Who may reply is the collection's `replyPolicy`,** one toggle in Edit Collection over Emissary's virtual `allowReplies`, reaching items through `shareWithChildren`. Items therefore offer no reply choice of their own; it would be overwritten on the next save. Closing replies hides received ones without deleting them. Emissary enforces the policy (emissary-specs REPLY-CONTROLS).
- **A signed-in visitor's Reply opens their inbox's reply form** (`/@me/newsfeed/browse-reply?url=…`). A signed-out visitor gets an Activity Intent (`/{id}/intent?intent=create&inReplyTo=…`), which `base-intent`'s CamperJS modal sends to their own server. No template here overrides that modal.
- **The list reads the Replies collection** (`ReplyLinksAfter`, 20 at a time). Never switch it to `RepliesAfter`, which returns every cached document whose `inReplyTo` points here, including replies refused while closed. `.ActivityStream` also applies the viewer's rules, so a hidden reply shows `base-social`'s `hidden-placeholder`.
- **Never load a reply's author with `AttributedTo.Load`.** An unreachable server returns an error that aborts the whole tab; `.ActivityStream` reports it and returns an empty document.
- **No live updates for most replies.** Emissary's `new-replies` SSE event fires only for replies written on this server or arriving from an account it follows.

## Like and Boost go to the Fediverse, in one click once an account is saved

The item modals' bar follows Emissary's Note (`stream-outbox-message/note-actions.html`). An Article draws Like, Reply, Boost, "⁂", and Share between its byline and its text (`head-social.html`), with its hashtags just above that bar on the public view (`head-tags.html`). A saved account is kept per site.

**An Article's hashtags are plain chips, because qwerty-article names no `tagUrl`.** The Stream builder's `.Tags` builds each tag's `Href` from the template's `tagUrl`, and `head-tags.html` links a tag only when that `Href` is set. A `tagUrl` would also publish that link in the Article's ActivityPub tags, so adding one is a federation change, not just a styling one.

- **Like is a Like intent, and Boost an Announce intent.** Its icon is Emissary's `announce` (the rocket); `share` is the arrow-square, kept for sharing a page elsewhere.
- **Each button has a hidden twin.** The visible one opens `/{id}/intent?intent=…`; once CamperJS finds a saved account whose server supports that intent (`camper-show-if-ready`), the twin replaces it and runs the intent in one click.
- **"⁂" appears once an account is saved** (`camper-show-if-has-accounts`) and opens the account manager.
- **A visitor signed in here gets `base-social`'s own Like button** in the item modals (`.UserCan "like-button"`). The Article always draws the intent twins.
- **Reply shows only while the item accepts replies,** as a pair of twins for the `reply` intent.
- **Share is last for every visitor, signed in or not,** and opens the OS share menu with the item's `Permalink` through Emissary's `Share` behavior. It is sent `hidden` and shown only where the browser has `navigator.share`, so desktop Firefox draws the bar without it.
- **The bar's buttons and tabs share one font size,** set in `qwerty-theme/stylesheet/03-app.css`, so the entries' own pages, which never load `collections.css`, match their modals. Below 640px the labels hide through `mobile-hide`, and each button keeps its name in `aria-label`; the label's leading space sits inside its span, so no gap is left.
- **Byline Follow works the same way** (`entry-byline.html`, `photo-figure.html`, `head-byline.html`), with the author's `ProfileURL` as the object. The Article's byline also draws the "⁂" manager beside Follow; the entry and photo bylines do not yet.
- **Each modal loads CamperJS itself,** because htmx-swapped modals bring their own scripts. It installs once and redraws on every `htmx:afterSwap`.

## Qwerty's Profile settings tabs are drawn by `qwerty-outbox`

Emissary's `/@me/settings/general` draws its Profile tabs from the user's outbox, so `qwerty-outbox` extends `base-outbox` and overrides `settings-tabs.html`. The General, Images, and Links forms are Emissary's; there is no Qwerty settings template.

**Collections is Qwerty's own tab.** `settings-collections-form` is a sortable list that posts on a changed order (`hx-trigger="update"`, Sortable's event) and answers with itself (`view-html`, `method: "both"`), so the new `tbody` re-installs `sortContainer`. The tab reloads itself on `refreshPage`, because Edit Collection ends with `refresh-page` and reloading the whole page would open General. Every Edit Collection modal links back here through `qwerty-collection/settings-title.html`, which carries the format's icon and title because `layout-tabs` writes its label as plain text.

**`?tab=` opens the settings page on any tab.** The page runs the outbox's `settings-general` with its own request, and `base-outbox` makes that a `switch` on `?tab=` for `images` and `links`. `qwerty-outbox` overrides it to add `collections`, and since an override replaces the whole action, it repeats base-outbox's cases. The action is `settings-general` whichever tab it drew, so `settings-tabs.html` picks the selected tab from the same parameter. **Its tab names must match the switch's cases,** trimmed and case-sensitive, or the page draws one tab and highlights another.

## Follow is Emissary's modal, from `base-outbox`

The profile card's Follow (`profile-header.html`) and a product-less Subscribe modal (`subscribe.html`) use Emissary's Follow modal and email pages, inherited from `base-outbox`. Emissary's emails and redirects reach `follow-email-sent`, `follower-confirm`, and `follower-unsubscribe` by name, so a local `follow` action replaces only `follow`, and all three must still exist.

- **The card draws Emissary's `follow-button`:** the modal until CamperJS finds a saved account that can follow, then one-click follow with a "⁂" account manager beside it.
- **Restyle by naming a view, never by defining an action.** A `follow-heading.html` or `follow-styles.html` in `qwerty-outbox` replaces Emissary's for every Qwerty profile.
