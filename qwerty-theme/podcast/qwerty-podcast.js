/*
 * qwerty-podcast plays a Podcast collection's episodes in their modal (qwerty-episode/modal.html), and moves between
 * them with the keyboard: Up or Left opens the episode above in the list, Down or Right the one below, and Space plays
 * or pauses.  When an episode ends, the modal moves on to the next one down and plays it.  Closing the modal stops
 * the audio.
 *
 * It is the theme's "podcast" bundle, loaded once by includes-foot.html.  Every listener is delegated from the
 * document, so modals that htmx swaps in later need no setup.
 *
 * RULE: there is one <audio> element, on <body>, made the first time something plays.  It outlives the modals, so
 * moving to the next episode reuses it.  Browsers (iOS Safari above all) let a page start audio only from a click or
 * a key press, except on an element that has already played; a new <audio> in each modal could not start the next
 * episode on its own when one ends.  The play buttons in the episode list start it in their own click, before htmx
 * opens the modal, for the same reason.
 *
 * Moving to another episode fades from one to the next, through a view transition.  The modal's response carries
 * HX-Reswap, and htmx 1.9 then ignores the link's own hx-swap, transition:true and all; it reads only
 * htmx.config.globalViewTransitions.  So that setting is turned on when htmx starts on the response to an episode link
 * (htmx:beforeOnLoad), and put back in a microtask, which runs once htmx has finished deciding: it reads the setting
 * synchronously, in the same task.  htmx:afterOnLoad cannot put it back, because by then the link has left the page
 * with the old modal, and htmx reports the event from another element.
 *
 * Markup it expects:
 *   .qwerty-episode                                       the modal's root
 *     .qwerty-episode-player[data-track-url]              the player, with data-track-name, -artist, -album, -image
 *       .qwerty-episode-toggle                            play or pause
 *       .qwerty-episode-progress > .qwerty-episode-fill   the progress bar, which seeks when pressed
 *       .qwerty-episode-time                              "1:02 / 34:56"
 *     a.qwerty-episode-prev, a.qwerty-episode-next        hidden links to the episodes above and below
 *     [data-episode-go="prev"], [data-episode-go="next"]  the on-screen arrows, which open them as the keys do
 *   both carry data-episode-id, so a modal that arrives is known to be the one a link asked for
 *   [data-podcast-play]                                   a play button in the episode list, with the same data-track-*
 *   [data-episode-url]                                    a row in the episode list, marked .playing while it plays
 *   [data-episode-row]                                    a row that opens its episode, through its .qwerty-podcast-name link
 */
(function () {

	// RULE: install once, however many times htmx re-runs this script
	if (window.qwertyPodcast) {
		return
	}

	window.qwertyPodcast = true

	// audio is the one <audio> element, or null until something plays
	let audio = null

	// autoplay names the episode to play as soon as its modal arrives, after the one before it ended, or is ""
	let autoplay = ""

	// seeking is the progress bar being dragged, or null
	let seeking = null

	// getAudio returns the page's <audio> element, making it the first time, and again if a page swap removed it
	function getAudio() {

		if ((audio != null) && audio.isConnected) {
			return audio
		}

		audio = document.createElement("audio")
		audio.preload = "none"
		audio.hidden = true

		for (const name of ["play", "pause", "timeupdate", "durationchange", "emptied"]) {
			audio.addEventListener(name, render)
		}

		audio.addEventListener("ended", onEnded)
		document.body.appendChild(audio)
		return audio
	}

	// isCurrent returns true when the audio element holds this track
	function isCurrent(url) {

		if ((audio == null) || (url == null) || (url == "")) {
			return false
		}

		return audio.src == new URL(url, window.location.href).href
	}

	// isPlaying returns true when this track is playing now
	function isPlaying(url) {
		return isCurrent(url) && !audio.paused
	}

	// play starts a track, from where it left off if it is already loaded.  details holds its data-track-* values.
	function play(url, details) {

		const media = getAudio()

		if (!isCurrent(url)) {
			media.src = url
		}

		media.play().catch(function (error) {
			console.log("qwerty-podcast: cannot play", url, error)
		})

		setMetadata(details)
	}

	// stop pauses the audio and lets go of the file, so it stops downloading
	function stop() {

		if (audio == null) {
			return
		}

		audio.pause()
		audio.removeAttribute("src")
		audio.load()
		render()
	}

	// toggle plays or pauses a player's track
	function toggle(player) {

		const url = player.dataset.trackUrl

		if (isPlaying(url)) {
			audio.pause()
			return
		}

		play(url, player.dataset)
	}

	// goTo opens the episode above ("prev") or below ("next") in the open modal.  A key press stops the episode that
	// was playing; an episode that ends plays the next one (keepPlaying).  Returns false when there is none.
	function goTo(direction, keepPlaying) {

		const link = document.querySelector("#modal a.qwerty-episode-" + direction)

		if (link == null) {
			return false
		}

		if (!keepPlaying) {
			stop()
		}

		autoplay = keepPlaying ? link.dataset.episodeId : ""
		link.click()
		return true
	}

	// onEnded moves on to the next episode down, and plays it
	function onEnded() {

		if (!goTo("next", true)) {
			render()
		}
	}

	// onArrive plays the episode a modal just opened, when an episode ending opened it.  Anything else htmx loads in
	// the meantime is not that modal, and is passed over.  An episode without audio has no player, so the modal moves
	// on past it to the next.
	function onArrive() {

		if (autoplay == "") {
			return
		}

		const episode = document.querySelector("#modal .qwerty-episode")

		if ((episode == null) || (episode.dataset.episodeId != autoplay)) {
			return
		}

		autoplay = ""

		const player = episode.querySelector(".qwerty-episode-player")

		if (player != null) {
			play(player.dataset.trackUrl, player.dataset)
			return
		}

		goTo("next", true)
	}

	// setMetadata names the track on lock screens and in the browser's media controls
	function setMetadata(details) {

		if (!("mediaSession" in navigator) || (typeof MediaMetadata == "undefined")) {
			return
		}

		const artwork = []

		if (details.trackImage) {
			artwork.push({src: details.trackImage})
		}

		navigator.mediaSession.metadata = new MediaMetadata({
			title: details.trackName || "",
			artist: details.trackArtist || "",
			album: details.trackAlbum || "",
			artwork: artwork,
		})

		navigator.mediaSession.setActionHandler("play", function () { getAudio().play() })
		navigator.mediaSession.setActionHandler("pause", function () { getAudio().pause() })
		navigator.mediaSession.setActionHandler("previoustrack", function () { goTo("prev", true) })
		navigator.mediaSession.setActionHandler("nexttrack", function () { goTo("next", true) })
	}

	// render shows the audio's state on every player and every row of the episode list
	function render() {

		for (const player of document.querySelectorAll(".qwerty-episode-player")) {
			renderPlayer(player)
		}

		for (const row of document.querySelectorAll("[data-episode-url]")) {
			row.classList.toggle("playing", isPlaying(row.dataset.episodeUrl))
		}
	}

	// renderPlayer shows one player's play or pause button, its progress, and its time
	function renderPlayer(player) {

		const url = player.dataset.trackUrl
		const playing = isPlaying(url)
		const current = isCurrent(url)

		player.classList.toggle("playing", playing)

		const button = player.querySelector(".qwerty-episode-toggle")
		if (button != null) {
			button.setAttribute("aria-label", playing ? "Pause" : "Play")
		}

		const position = current ? audio.currentTime : 0
		const duration = (current && isFinite(audio.duration)) ? audio.duration : 0

		const progress = player.querySelector(".qwerty-episode-progress")
		if ((progress != null) && (seeking != progress)) {
			const percent = (duration > 0) ? (position / duration) * 100 : 0
			progress.setAttribute("aria-valuenow", Math.round(percent))
			progress.style.setProperty("--progress", percent + "%")
		}

		const time = player.querySelector(".qwerty-episode-time")
		if (time != null) {
			time.textContent = (duration > 0) ? formatTime(position) + " / " + formatTime(duration) : formatTime(position)
		}
	}

	// formatTime writes seconds as M:SS, or H:MM:SS past an hour
	function formatTime(seconds) {

		const whole = Math.floor(seconds)
		const hours = Math.floor(whole / 3600)
		const minutes = Math.floor((whole % 3600) / 60)
		const secs = String(whole % 60).padStart(2, "0")

		if (hours > 0) {
			return hours + ":" + String(minutes).padStart(2, "0") + ":" + secs
		}

		return minutes + ":" + secs
	}

	// seekTo moves a player's track to where the pointer is on its progress bar
	function seekTo(progress, clientX) {

		const player = progress.closest(".qwerty-episode-player")

		if ((player == null) || !isCurrent(player.dataset.trackUrl) || !isFinite(audio.duration)) {
			return
		}

		const box = progress.getBoundingClientRect()
		const ratio = Math.min(1, Math.max(0, (clientX - box.left) / box.width))

		progress.style.setProperty("--progress", (ratio * 100) + "%")
		audio.currentTime = ratio * audio.duration
	}

	// isTyping returns true when a key press belongs to a text field
	function isTyping(target) {
		return (target instanceof Element) && (target.closest("input, textarea, select, [contenteditable]") != null)
	}

	// isPressable returns true when Space already presses the focused element, so it must not also play or pause
	function isPressable(target) {
		return (target instanceof Element) && (target.closest("button, a, summary, [role=button], [role=tab]") != null)
	}

	// The arrows and play buttons, in the modal and in the episode list.  A list's play button also opens the modal,
	// through its own hx-get, which htmx handles separately.
	document.addEventListener("click", function (event) {

		if (!(event.target instanceof Element)) {
			return
		}

		const arrow = event.target.closest("#modal [data-episode-go]")
		if (arrow != null) {
			goTo(arrow.dataset.episodeGo, false)
			return
		}

		const toggleButton = event.target.closest(".qwerty-episode-toggle")
		if (toggleButton != null) {
			const player = toggleButton.closest(".qwerty-episode-player")
			if (player != null) {
				toggle(player)
			}
			return
		}

		const playButton = event.target.closest("[data-podcast-play]")
		if (playButton != null) {
			play(playButton.dataset.podcastPlay, playButton.dataset)
			return
		}

		// A click anywhere else on a row opens its episode, as its name's link does.  Its buttons and links do their
		// own jobs.
		const row = event.target.closest("[data-episode-row]")
		if ((row != null) && (event.target.closest("a, button") == null)) {
			const link = row.querySelector(".qwerty-podcast-name a")
			if (link != null) {
				link.click()
			}
		}
	})

	// Pressing the progress bar seeks, and dragging along it keeps seeking
	document.addEventListener("pointerdown", function (event) {

		if (!(event.target instanceof Element)) {
			return
		}

		const progress = event.target.closest(".qwerty-episode-progress")
		if (progress == null) {
			return
		}

		seeking = progress
		progress.setPointerCapture(event.pointerId)
		seekTo(progress, event.clientX)
	})

	document.addEventListener("pointermove", function (event) {
		if (seeking != null) {
			seekTo(seeking, event.clientX)
		}
	})

	document.addEventListener("pointerup", function () {
		seeking = null
	})

	document.addEventListener("pointercancel", function () {
		seeking = null
	})

	// The keyboard, while an episode's modal is open
	document.addEventListener("keydown", function (event) {

		if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
			return
		}

		const episode = document.querySelector("#modal .qwerty-episode")
		if (episode == null) {
			return
		}

		if (isTyping(event.target)) {
			return
		}

		switch (event.key) {

		case "ArrowUp":
		case "ArrowLeft":
			event.preventDefault()
			goTo("prev", false)
			return

		case "ArrowDown":
		case "ArrowRight":
			event.preventDefault()
			goTo("next", false)
			return

		case " ": {
			if (isPressable(event.target)) {
				return
			}

			event.preventDefault()

			const player = episode.querySelector(".qwerty-episode-player")
			if (player != null) {
				toggle(player)
			}
		}
		}
	})

	// A new modal, or a redrawn episode list, shows what is playing, and an episode that ended plays the next
	document.addEventListener("htmx:load", function () {
		onArrive()
		render()
	})

	// Closing the modal stops the audio
	window.addEventListener("closeModal", stop)

	// An episode link's response swaps in through a view transition, which fades from one episode to the next
	document.addEventListener("htmx:beforeOnLoad", function (event) {

		if (typeof htmx == "undefined") {
			return
		}

		const link = event.detail.elt

		if (!(link instanceof Element) || !link.matches("a.qwerty-episode-prev, a.qwerty-episode-next")) {
			return
		}

		const was = htmx.config.globalViewTransitions
		htmx.config.globalViewTransitions = true

		queueMicrotask(function () {
			htmx.config.globalViewTransitions = was
		})
	})

})();
