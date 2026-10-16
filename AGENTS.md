# Qwertylicious — Notes for AI Agents

Qwertylicious is an Emissary template package for long-form writing, installed onto a running Emissary server through a Git package adapter rather than compiled or deployed on its own. See [README.md](README.md) for the product description. Every top-level folder except `meta/` holds one definition file (`template.hjson`, or `theme.hjson` for the theme), and the `.html` files beside it are the views its actions render.

## The templates

The ID a template registers under is the `templateId` inside its file, not the folder name. Emissary's loader passes the folder name in, but the unmarshalled `templateId` replaces it (`service.Template.Add`). So several folders here carry a `qwerty-` prefix that their ID does not.

| Folder | ID | Model | What it is |
| ------ | -- | ----- | ---------- |
| `qwerty-outbox` | `qwerty-outbox` | Outbox | The profile page, with role `user-outbox`. It is the only page under a profile: the profile card and tabs, then the open tab (a collection, or About) loaded in place |
| `qwerty-article` | `qwerty-article` | Stream | An Article, which lives only inside a collection (`containedBy: ["qwerty-collection"]`) |
| `qwerty-inbox` | `qwerty-inbox` | Inbox | The user's inbox, with role `user-inbox` |
| `qwerty-collection` | `qwerty-collection` | Stream | A tab on the profile that groups Articles, shown in one of the five formats, with its own sharing and feed. It has no page of its own: its `view` redirects to its tab, and `list` is the tab's content. In progress: see emissary-specs `projects/QWERTY-COLLECTIONS.md` |
| `qwerty-common` | `qwerty-common` | None | No actions. Holds the shared card-layout views (`layout.html` and `layout-*.html`), and the `colors`, `fonts`, and `layouts` datasets. `qwerty-outbox` and `qwerty-collection` extend it |
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

## A bundle folder holds only source — every file in it is concatenated

`bundles:` in a `template.hjson` or `theme.hjson` declares a folder by name and a content type. Emissary's `populateBundle` then reads **every** file in that folder, skipping only subdirectories — there is no extension filter — concatenates them all, and runs the result through a minifier for that content type. A stray `AGENTS.md`, `README.md`, or editor backup is therefore fed to the CSS or JS minifier as if it were code, corrupting the served bundle. Here that means [qwerty-article/stylesheet](qwerty-article/stylesheet/), [qwerty-theme/stylesheet](qwerty-theme/stylesheet/), and `qwerty-search`'s `javascript` and `hyperscript` folders.

**A bundle's URL names the template by ID, never by role.** `/.templates/{templateId}/{bundleId}` loads the template by its `templateId`. So `qwerty-outbox`'s stylesheet is `/.templates/qwerty-outbox/stylesheet`. `/.templates/user-outbox/stylesheet` finds Emissary's own built-in `user-outbox` template instead, which has no bundles, and answers 404 ("Bundle not found"). The profile views used that wrong URL from 2026-10-09 (`55d3a88`) until 2026-10-14, so the profile's own CSS never loaded during that time.

A theme's `resources/` folder is different — it is served as plain static files, one URL per file, not concatenated. Nothing there corrupts a bundle, but anything you drop in becomes publicly downloadable, so it is still not a place for notes.

## A `z-` filename prefix is how a template is parked, not a naming quirk

[qwerty-search](qwerty-search/) contains `z-template.hjson` rather than `template.hjson`, so Emissary never registers that template while its views stay in the repo. Renaming the file back is what re-enables it — don't "tidy" the prefix away, and don't assume a folder with views is live without checking that its manifest is actually named `template.hjson`.

## The profile page is the frame, and every tab loads inside it

`/@user` (`qwerty-outbox/outbox.html`) is the only page under a profile. It draws the profile card (`profile-header.html`), then `#profile-tabs`: the tab bar (`qwerty-common/profile-tabs.html`: the collections in the owner's order, then About) above an empty panel, while it loads the open tab. Each tab's content, a collection's `/{id}/list` or `/@user/about` (`about.html`), is a new `#profile-tabs` that draws the tab bar again with its own tab selected. There is no Replies page.

- **The open tab lives in the URL** as `?tab={collectionId}` or `?tab=about`. `outbox.html` uses `.QueryParam "tab"` only when it names a visible collection or `about`. Anything else falls back to the first tab (About when there are no collections), so a crafted value never reaches the page.
- **A tab's content brings its own tab bar, and pushes the profile's URL.** Each tab swaps out `#profile-tabs` whole (`outerHTML`), so the server marks the selected tab and no script moves `aria-selected`; renamed and new collections also show on the next click. It sets `hx-push-url` to `/@user?tab=…`, never to the partial's own URL, so back, reload, and a copied link all ask for a full page. Every tab keeps a stable `id` (`tab-{id}`, `tab-about`) so htmx can return keyboard focus to it after the swap.
- **Only the profile page's `#profile-tabs` has `hx-trigger="load"`.** The swapped-in copies carry none, so a page restored from htmx's history cache does not load the first tab again over the one that was open.
- **The owner's only menu is the ⋯ beside the tabs.** The profile card has none. A collection's menu holds the edit items (Edit Profile, Edit Collection, its sharing status), a line, then the add items (Add a Collection, Add an Article). About's menu holds Edit Profile, a line, then Add a Collection. Both menus write Edit Profile and Add a Collection out themselves, so change them in both. There is no Sign Out here.
- **Both copies of the tab bar read the same query.** A collection's `list.html` reaches the profile through `.ParentOutbox "view"` and calls `.Outbox`, as `outbox.html` does. Do not switch it to `.Siblings`: that hides anything outside its publish window, and a collection is never published.
- **Partials redirect when visited directly.** A collection's `view` redirects to `/@{owner}?tab={id}`. The outbox's `about` action renders `about.html` only for an htmx request (`.IsPartialRequest`), and otherwise redirects to `/@user?tab=about`.
- **The loading state must not pass its htmx settings down.** The profile page's `#profile-tabs` has `hx-target="this"` and `hx-push-url="false"` for its first load, and sets `hx-disinherit="*"` so the tabs inside it keep their own. The swapped-in copies have no htmx attributes, so the cards inside them navigate the whole page.
- **Reloads carry the tab.** The owner's `refreshPage` and SSE reloads `hx-get` `/@user` with `hx-vals` that copy `?tab=` from the address bar. Without it, a reload after Sharing or Settings would jump back to the first tab.

## Never put a template action where an attribute name goes

Emissary minifies each view's HTML before Go parses it, and the minifier lowercases attribute names. So `<a {{if eq $collectionID $selected}}aria-selected="true"{{end}}>` reaches the parser as `$collectionid`, an undefined variable, and the whole template fails to load (found 2026-10-15). Keep actions inside attribute values instead: `aria-selected="{{if …}}true{{else}}false{{end}}"`. Inside a double-quoted attribute, write template strings with backticks (`{{if eq `about` $selected}}`), not double quotes.

## `extends` composes templates, and the base templates live in Emissary

A template inherits actions, states, roles, schema, and datasets from each entry in its `extends` array, and a value defined locally wins over an inherited one. `user-outbox` and `base-intent` are **not in this repo** — they ship inside Emissary's `_embed/templates`, so an unexplained action or role usually comes from there. `qwerty-common` is `model: None` with no actions. It holds the shared card-layout views and the `colors` and `fonts` datasets, and `qwerty-outbox` extends it (since 2026-10-12, for QWERTY-COLLECTIONS §1.1).

**Views are inherited too, and a local view wins.** `extends` copies each parent view into the child unless the child already has one with that name. So a shared view in `qwerty-common` is shadowed by any same-named file left in the extending template's folder. That is why the shared layouts are named `layout-row`, `layout-row-reverse`, `layout-column`, and `layout-columns`, and not `outbox-*`. Each takes a slice of stream summaries as `.`, and fetches nothing. `layout` chooses among them: call it as `{{template "layout" (array $layout $posts)}}`, because a `{{template}}` call takes one value and the funcmap has no `dict`, but it does have `array`. The caller handles the empty state.

## Option providers are `{templateId}.{datasetName}` and resolve through inheritance

A form field like `options:{provider:"qwerty-outbox.layouts"}` is split on the dot: Emissary loads the template named by the first segment and looks up the second in its `Datasets` map. The name must be the template the form belongs to, even when the dataset is *defined* in `qwerty-common`, because datasets are copied down at inheritance time. Providers whose names have no dot (`circles`, `syndication-targets`) are built into the server instead.

**A wrong provider name fails silently in the UI.** The lookup reports the error to the server log and returns an empty group, so the form still renders — as an empty dropdown with no visible complaint. When a select is mysteriously blank, check the provider name before anything else.

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

## A new funcmap helper couples this repo to a minimum Emissary version

Go's `html/template` resolves function names at **parse** time, so calling a helper that the running server's template funcmap does not define does not degrade that one expression — the entire template fails to parse and the page dies. Helpers like `cssValue` arrive in Emissary through its pinned `benpate/rosetta` dependency, so a template edit that adopts a newly added helper cannot deploy until Emissary itself ships a build carrying it. Check that the helper exists in the target server's build before using it in a template here.
