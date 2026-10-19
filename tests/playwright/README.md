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
| `/episode` | A page with the first of three episodes open in its modal |
| `/{id}/modal` | An episode's modal, with the headers Emissary's `as-modal` sends |
| `/podcast-list` | One row of a podcast's episode list |

It finds Emissary at `../emissary` beside this repo. Set `EMISSARY_DIR` to use another checkout.

## The fixtures copy rendered markup

The server can't run Go templates, so `fixtures/` holds the markup the templates render. **When a template's markup changes, update its fixture**, or the tests keep checking the old markup.

The pieces a test is about come from the template files themselves:

- the skip buttons, from `qwerty-episode/episode-arrow-back.html` and `episode-arrow-next.html`;
- the episode title's `<h2>` tag, from `qwerty-episode/modal.html`;
- the date cell, from `qwerty-collection/items-podcast.html`.

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
- **The backdrop.** It is a black veil: 60% in light mode, 70% in dark mode.
- **The hovered row.** A list row is one color from end to end, and no cell is translucent.
