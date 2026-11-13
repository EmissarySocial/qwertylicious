/*
 * qwerty-podcast plays a Podcast's episodes in their modal (qwerty-episode/modal.html): player, keys, and autoplay.
 * RULE: one <audio> element on <body>, reused for every episode, so the next can start without a click (see AGENTS.md).
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
		markLeaving()
		link.click()
		return true
	}

	// markLeaving marks the episode on screen as leaving, and the page as changing episodes, so the episode that
	// replaces it fades in (collections.css).  RULE: no view transition here; Safari drops the underlay's blur from its
	// snapshots (see AGENTS.md).
	function markLeaving() {

		const episode = document.querySelector("#modal .qwerty-episode")

		if (episode != null) {
			episode.setAttribute("data-leaving", "true")
		}

		document.documentElement.classList.add("qwerty-episode-arriving")
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

	// The skip and play buttons, in the modal and the episode list; a list's play button also opens the modal via hx-get
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

	// The arriving episode's fade has run, so the page stops changing episodes
	document.addEventListener("animationend", function (event) {
		if (event.animationName == "qwerty-episode-arrive") {
			document.documentElement.classList.remove("qwerty-episode-arriving")
		}
	})

})();
