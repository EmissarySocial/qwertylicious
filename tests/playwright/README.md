# Playwright tests

Browser tests for qwertylicious's styles and scripts. Each spec runs four times: in Chromium and in WebKit (Safari's engine), each in light and dark mode.

## Running them

```sh
cd tests/playwright
npm install
npx playwright test               # every spec, every browser
npx playwright test --ui          # pick and watch tests in Playwright's UI
npx playwright test --project=webkit-dark
npx playwright show-report        # the HTML report of the last run
```

`@playwright/test` is pinned to 1.63.0, the version whose browsers are already installed. To move to a newer version, change it in `package.json`, then run `npx playwright install chromium webkit`.

## What the server serves

`playwright.config.mjs` starts `server.mjs` on port 8777. It reads its files from source on every request:

| Path | Source |
| --- | --- |
| `/css` | Emissary's `theme-global` and `theme-default` stylesheets, then `qwerty-theme/stylesheet` and `qwerty-outbox/stylesheet`, in the order a real page loads them |
| `/js/htmx.js`, `/js/hyperscript.js` | Emissary's htmx 1.9.12 and hyperscript 0.9.93 |
| `/js/global.js`, `/hs/global.hs` | Emissary's `theme-global` JavaScript and hyperscript bundles, including the `Modal` behavior |
| `/js/podcast.js` | `qwerty-theme/podcast` |
| `/js/carousel.js` | `qwerty-theme/carousel` |
| `/.themes/global/resources/sortable-1.15.7/Sortable.min.js` | Emissary's Sortable, which the `upload-multiple` script loads on demand |
| `/episode` | A page with the first of three episodes open in its modal |
| `/entry` | A page with the first of three Timeline entries open in its modal |
| `/calendar` | A page with one button that opens a Calendar event's modal |
| `/{id}/modal` | An episode's, an entry's, the event's, or a photo post's modal, with the headers Emissary's `as-modal` sends |
| `/podcast-list` | One row of a podcast's episode list |
| `/gallery/{collectionId}` | A Photo Gallery's tab for its owner: the Add Photos button, and the posts the spec has made in that collection |
| `/{collectionId}/add` | Add Photos in a modal; its POST stores any file posted with it and adopts the staged photos its `photos.order` values name, in that order, keeping the first 16 and leaving the rest staged, as the `create` action's `include` does. With `?action=photos` it is the `photos` action run on the unsaved post, as Emissary's `add-stream` runs it: a GET draws a create form's zone, a POST stores the one posted file under the user and draws its tile alone, and `?attachmentId=` deletes one staged file and answers nothing |
| `/@me/attachments/{id}` | A staged file's preview |
| `/staged` | The files staged under the user and not yet adopted, for the photo spec |
| `/{id}/edit` | Edit Photo in a modal; its POST answers a 303 to the modal, as the edit action does |
| `/{id}/photos` | The post's `photos` action, answered as Emissary's `edit-attachments` step does: GET draws the row of tiles, and a POST deletes one file (`?attachmentId=`) or stores the posted files and applies the posted order, then draws the row again |
| `/list` | The `list` widget's fixture inside a form; its POST answers with every value it received, by name, in the order posted |
| `/tabs` | A two-tab form, General and Hashtags, as `layout-tabs` draws one |
| `/seed`, `/posts/{id}` | A post stored from JSON, and a post's files in rank order, for the photo spec |

The photo routes keep their posts in memory, under the collection id the spec makes up, so tests running at once never share a post.

It finds Emissary at `../emissary` beside this repo. Set `EMISSARY_DIR` to use another checkout.

## The fixtures copy rendered markup

The server can't run Go templates, so `fixtures/` holds the markup the templates render. **When a template's markup changes, update its fixture**, or the tests keep checking the old markup.

The pieces a test is about come from the template files themselves:

- the skip buttons, from `qwerty-episode/episode-arrow-back.html` and `episode-arrow-next.html`;
- the episode title's `<h2>` tag, from `qwerty-episode/modal.html`;
- the entry title's `<h1>` tag, from `qwerty-timeline-entry/modal.html`;
- the event title's `<h1>` tag, from `qwerty-event/modal.html`;
- the date cell, from `qwerty-collection/items-podcast.html`;
- a photo's pencil and X, from `qwerty-photo/modal.html` and `edit-pencil.html`.

`fixtures/list.html` holds benpate/form's `list` widget as it draws three lists in a `layout-vertical`: one of at most 4 values, an empty one, and one of at least 2. Render it again from the form library whenever the widget's markup changes. `fixtures/tabs.html` holds a `layout-tabs` form drawn the same way, with a text field on General and a `list` on Hashtags, as Edit Map has.

`fixtures/photo-create.html` and `fixtures/photo-edit.html` copy Add Photos and Edit Photo as Emissary's `edit` step renders them from `qwerty-photo/template.hjson`, with the `html-remote` element's own markup, an empty shell that loads the photo zone from `server.mjs`; `fixtures/photo-modal.html` holds the modal around the carousel, which `server.mjs` draws from the post's files as `qwerty-photo/photo-figure.html` does.

## Checking that a test catches its bug

Set `QWERTY_DIR` to a copy of this repo with the fix undone, and the test should fail:

```sh
EMISSARY_DIR=../../../emissary QWERTY_DIR=/path/to/broken-copy CI=1 npx playwright test
```

`CI=1` starts a fresh server instead of reusing one already running from the real repo.

## The specs

`podcast.spec.mjs` checks the following:

- **Hover colors.** The skip and play buttons darken on hover in light mode and lighten in dark mode.
- **Disabled skip buttons.** A disabled one keeps its light circle on hover.
- **The title's size.** An arriving episode's title keeps one size on every frame. Without `id="modal-title"`, it went from 24px to 32px.
- **The fade.** Moving between episodes uses a CSS fade, not a view transition, and the underlay keeps its blur on every frame.
- **Saving.** Submitting the edit form brings the view back into the modal, which stays open.
- **The X.** The X beside the pencil closes the modal.
- **The backdrop.** It is a black veil: 60% in light mode, 70% in dark mode.
- **The hovered row.** A list row is one color from end to end, and no cell is translucent.

`timeline.spec.mjs` checks the following:

- **The layout between entries.** While the next entry arrives, its title keeps one size and one position, and the body below it stays put. Without `id="modal-title"`, the title went from 40px to 32px and the body moved up 8px.
- **The previous and next entries.** Their bar starts at the modal's top edge, ends before the pencil and X, and keeps its place while a long entry scrolls under it.

`event.spec.mjs` checks the following:

- **The title's size.** The event's title keeps one size on every frame while its modal opens. Without `id="modal-title"`, it went from 40px to 32px.
- **One font size in the responses bar.** The Reply, Like, and Share buttons match the Replies, Likes, and Shares tabs. The bar's markup is copied into `fixtures/event-modal.html`, so this checks qwerty-theme's stylesheet, not the template. Without the rule in `03-app.css`, the buttons were 12.8px and the tabs 14.4px.

`photo.spec.mjs` drives a photo post's photo zone, with Emissary's script and styles served from source, and checks the following:

- **Add Photos.** Three files dropped on the form one at a time are each staged at once, as tiles before the plus with the single-select input left empty; the X on a staged tile removes it with no confirm, and the server forgets it; Home on a focused tile moves it to the front with no request; the Save posts the two staged IDs in tile order, the modal closes, the gallery shows the new post with its several-photos mark, the post holds the two in that order and nothing stays staged, and its modal is a carousel of the two.
- **A post with no photo is refused.** The Save answers the step's inline message, and the form stays open.
- **No file during the Save.** While Add Photos' Save is held in flight, the plus is disabled and a drop is refused in the status line; once the Save is refused, the plus returns, the message clears, and a drop uploads again.
- **Edit Photo.** The row loads the saved photos; a drop uploads at once, after them, with the plus still after the row; Home on a focused tile moves it to the front and saves the order; the X deletes a saved photo after its confirm; and Save returns to the modal, whose carousel shows the photos in the new order.
- **The last photo cannot be deleted.** Its X is disabled, and says to add another file first.

`list.spec.mjs` drives the `list` form widget, with Emissary's `ListWidget` behavior and styles served from source (emissary-specs `projects/LIST-WIDGET.md` §1.3), and checks the following:

- **The rows.** An empty list draws one blank row, and the add button carries the list's `add-label`.
- **Enter and the add button.** Enter adds a row below and moves to it without submitting the form; the add button adds one at the bottom, and goes at the maximum, where Enter adds nothing and says why.
- **Backspace.** In an empty row it removes the row and moves to the end of the row above; in a row with text it deletes a letter.
- **Moving.** Alt with Up, Down, Home, or End moves the row, keeps the selection, and announces the new place; a drag from the grip moves it too.
- **The X.** It removes its row, and clears the only row instead.
- **Repeats.** A row that repeats an earlier one, ignoring case and outer spaces, is marked while it is typed and unmarked when it changes.
- **The minimum.** The Xs are disabled at the list's minimum, and a Save with fewer values is stopped by the browser until another is typed.
- **The Save.** It posts every row of every list in its order.
- **The row's ring.** A focused row is ringed whole, grip and X included, and its cell is not ringed on its own.
- **The X's look.** It is a round button in the theme's button colors, at rest and under the mouse.

`tabs.spec.mjs` drives the form library's tabs, with Emissary's `TabContainer` behavior served from source (emissary-specs `projects/LIST-WIDGET.md` §1.6), and checks the following:

- **The tab on load.** The first tab is selected and the focus stays where it was.
- **A click.** It shows the tab's panel and moves the focus to the panel's first control.
- **Enter.** On a focused tab, it selects the tab and moves the focus into its panel.
