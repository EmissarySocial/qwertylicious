# Qwertylicious — Notes for AI Agents

Qwertylicious is an Emissary template package for long-form writing, installed onto a running Emissary server through a Git package adapter rather than compiled or deployed on its own. See [README.md](README.md) for the product description. Every top-level folder is one template whose folder name must equal the `templateId` inside its `template.hjson`, and the `.html` files beside it are the views its actions render: `qwerty-article`, `qwerty-outbox`, `qwerty-search`, `qwerty-theme`, and the dataset-only `qwerty-common`.

This file lives at the repo root and is the only place to add notes. Do not create files inside a template folder.

## A bundle folder holds only source — every file in it is concatenated

`bundles:` in a `template.hjson` or `theme.hjson` declares a folder by name and a content type. Emissary's `populateBundle` then reads **every** file in that folder, skipping only subdirectories — there is no extension filter — concatenates them all, and runs the result through a minifier for that content type. A stray `AGENTS.md`, `README.md`, or editor backup is therefore fed to the CSS or JS minifier as if it were code, corrupting the served bundle. Here that means [qwerty-article/stylesheet](qwerty-article/stylesheet/), [qwerty-theme/stylesheet](qwerty-theme/stylesheet/), and `qwerty-search`'s `javascript` and `hyperscript` folders.

A theme's `resources/` folder is different — it is served as plain static files, one URL per file, not concatenated. Nothing there corrupts a bundle, but anything you drop in becomes publicly downloadable, so it is still not a place for notes.

## A `z-` filename prefix is how a template is parked, not a naming quirk

[qwerty-search](qwerty-search/) contains `z-template.hjson` rather than `template.hjson`, so Emissary never registers that template while its views stay in the repo. Renaming the file back is what re-enables it — don't "tidy" the prefix away, and don't assume a folder with views is live without checking that its manifest is actually named `template.hjson`.

## `extends` composes templates, and the base templates live in Emissary

A template inherits actions, states, roles, schema, and datasets from each entry in its `extends` array, and a value defined locally wins over an inherited one. `user-outbox` and `base-intent` are **not in this repo** — they ship inside Emissary's `_embed/templates`, so an unexplained action or role usually comes from there. `qwerty-common` is `model: None` with no actions; its whole job is to hold the shared `colors` and `fonts` datasets that `qwerty-outbox` inherits by extending it.

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
