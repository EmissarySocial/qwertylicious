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
| `/js/global.js`, `/hs/global.hs` | Emissary's `theme-global` JavaScript and hyperscript bundles, including the `Modal`, `Share`, and `Clipboard` behaviors |
| `/js/podcast.js` | `qwerty-theme/podcast` |
| `/episode` | A page with the first of three episodes open in its modal |
| `/entry` | A page with the first of three Timeline entries open in its modal |
| `/calendar` | A page with one button that opens a Calendar event's modal |
| `/{id}/modal` | An episode's, an entry's, or the event's modal, with the headers Emissary's `as-modal` sends |
| `/podcast-list` | One row of a podcast's episode list |
| `/editorjs` | `qwerty-article/edit-content-editorjs.html` for a new Article, read from the template itself |
| `/editorjs-emissary` | Emissary's `stream-article-editorjs/editor.html`, the same way |
| `/@author` | A profile with its Articles tab open in Custom order, as the author sees it: two Articles, each with its drag handle |
| `/articles/list` | That tab, as a tab click swaps it into `#profile-tabs` |
| `/an-article` | The Article's page, as a fragment |
| `/articles/sort` | Posting a new order, answered as Emissary's `sort` step does, with `HX-Reswap: none` |
| `/@photographer` | A profile with a Photo Gallery tab open below a 300px header, its pill row tagged `travel` and `food`, and photos taller than the window |
| `/gallery/list` | That tab, as a pill swaps it into `#profile-tabs`, with `?tag=` selecting a pill |
| `/handle` | A profile's handle, which copies the full `@author@example.social` |
| `/.themes/global/resources/sortable-1.15.7/Sortable.min.js` | Emissary's Sortable, at the path `sortContainer` loads it from, never cached so that every load is a request |

It finds Emissary at `../emissary` beside this repo. Set `EMISSARY_DIR` to use another checkout. The two editor pages load EditorJS from jsdelivr, as the real editors do, so `editorjs.spec.mjs` needs network access.

## The fixtures copy rendered markup

The server can't run Go templates, so `fixtures/` holds the markup the templates render. **When a template's markup changes, update its fixture**, or the tests keep checking the old markup.

The pieces a test is about come from the template files themselves:

- the skip buttons, from `qwerty-episode/episode-arrow-back.html` and `episode-arrow-next.html`;
- the episode title's `<h2>` tag, from `qwerty-episode/modal.html`;
- the entry title's `<h1>` tag, from `qwerty-timeline-entry/modal.html`;
- the event title's `<h1>` tag, from `qwerty-event/modal.html`;
- the Share button, from `qwerty-event/responses.html` and `qwerty-timeline-entry/responses.html`;
- the date cell, from `qwerty-collection/items-podcast.html`;
- the tab link, from `qwerty-common/profile-tabs.html`;
- the tag pill row and its All and tag pills, from `qwerty-collection/tag-pills.html`;
- the profile's handle and its copy button, from `qwerty-outbox/profile-header.html`;
- the sortable branch up to its cards, from `qwerty-common/layout.html`;
- the Article card's link and drag handle, from `qwerty-common/layout-column.html`.

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
- **One font size in the responses bar.** The Reply, Like, Boost, and Share buttons match the Replies, Likes, and Boosts tabs. The bar's markup is copied into `fixtures/event-modal.html`, so this checks qwerty-theme's stylesheet, not the template. Without the rule in `03-app.css`, the buttons were 12.8px and the tabs 14.4px.

`share.spec.mjs` checks Emissary's `Share` behavior on the Share button in the event and entry modals:

- **No share menu.** Where the browser has no `navigator.share`, the button stays hidden.
- **Sharing.** Where it has one, the button shows, both in a modal htmx swaps in and on a page that arrives whole, and a click passes the share menu the button's `data-share-url`. Like the real menu, the stand-in refuses a call that is not made on `navigator`.
- **The title and text.** The menu gets them only when the button carries them. Without that check, the menu was handed `title: null` and `text: null`, which a browser turns into the word "null".
- **Closing the menu.** An `AbortError` logs nothing. Without the behavior's `catch`, every closed menu logged an error.
- **A failed share.** Any other rejection is logged to the console.

`clipboard.spec.mjs` checks Emissary's `Clipboard` behavior on the profile's handle:

- **Copying.** A click copies the full handle, swaps the handle for "Copied", and brings the handle back after 1.5 seconds.
- **A refused copy.** It shows no "Copied", and the refusal is logged.
- **Plain http.** With no clipboard API, the behavior copies from a hidden, read-only textarea and then removes it. When that copy fails, it shows no "Copied" and logs the failure.

`tags.spec.mjs` checks a tagged gallery's pill row:

- **The labels.** Each pill shows its bare tag, with no `#`.
- **Scrolling.** A tag pill, and All after it, scroll the pill row to the top of the window as the tab redraws. With `show:none` in their `hx-swap`, the row stayed where it was.

`editorjs.spec.mjs` checks the following, in qwertylicious's editor and in Emissary's:

- **A line break pasted into a paragraph.** Pasting `one<br>two` saves `one<br>two`. Without `ColorPickerKeepingBreaks`, EditorJS saved `onetwo`.
- **A line break inside pasted paragraphs.** Pasting two `<p>` elements saves two blocks, and the first keeps its `<br>`.

`articles.spec.mjs` checks the following, in an Article collection set to Custom order:

- **Switching tabs.** A tab replaces the address and adds no history.
- **Opening an article.** It pushes the article's address, so a reload stays on it and Back returns to the tab. Without `hx-disinherit="hx-push-url"` on the sort form, the card inherited the form's `hx-push-url="false"` and the address stayed on the tab.
- **Posting a new order.** It leaves the address alone. Without the form's own `hx-push-url="false"`, it pushed `/articles/sort`.
- **Dragging an article.** `sortContainer` passes the form's handle and draggable on to Sortable, and dragging the second card above the first posts both keys in their new order.
- **Loading Sortable.** Opening the tab three times requests Sortable.js once. With a `<script src>` in `layout.html`, it was requested on every visit.
