/*
 * qwerty-carousel runs the photo carousel in qwerty-photo/photo-figure.html: arrows, Left and Right keys, and swipes.
 * Past either end, the keys click the figure's hidden neighbor-post links. Listeners are delegated from the document.
 * In a modal with no carousel, the keys click its [data-modal-go] links instead (qwerty-timeline-entry/entry-neighbors.html).
 */
(function () {

	// RULE: install once, however many times htmx re-runs this script
	if (window.qwertyCarousel) {
		return
	}

	window.qwertyCarousel = true

	// SWIPE_THRESHOLD is the horizontal travel, in pixels, that counts as a swipe to the next or previous photo
	const SWIPE_THRESHOLD = 50

	// DRAG_SLOP is the movement, in pixels, tolerated before a press becomes a drag, so taps on controls still work
	const DRAG_SLOP = 8

	// drag is the gesture in progress, or null.  Only one pointer drags at a time.
	let drag = null

	// suppressClick swallows the click that a browser fires right after a drag ends
	let suppressClick = false

	// slideCount returns how many photos a carousel holds
	function slideCount(carousel) {
		return carousel.querySelectorAll(".qwerty-carousel-slide").length
	}

	// indexOf returns the photo a carousel is showing
	function indexOf(carousel) {
		return parseInt(carousel.dataset.index || "0", 10)
	}

	// track returns the sliding element that holds a carousel's slides
	function track(carousel) {
		return carousel.querySelector(".qwerty-carousel-track")
	}

	// setOffset moves the track to its resting place for the current photo, plus a live drag offset in pixels
	function setOffset(carousel, offsetPx) {
		const element = track(carousel)
		if (element != null) {
			element.style.transform = "translateX(calc(" + (-indexOf(carousel) * 100) + "% + " + offsetPx + "px))"
		}
	}

	// fitHeight sizes the stage to the photo in view, so photos of different heights each show at their own height
	function fitHeight(carousel) {
		const stage = carousel.querySelector(".qwerty-carousel-stage")
		const slide = carousel.querySelectorAll(".qwerty-carousel-slide")[indexOf(carousel)]
		if (stage == null || slide == null) {
			return
		}

		// A photo that has not loaded yet has no height; the stage waits for its load event
		if (slide.offsetHeight == 0) {
			return
		}

		stage.style.height = slide.offsetHeight + "px"
	}

	// fitAll sizes every carousel on the page and in the modal
	function fitAll() {
		document.querySelectorAll(".qwerty-carousel").forEach(fitHeight)
	}

	// render shows the current photo, and updates the arrows and the count to match
	function render(carousel) {

		const index = indexOf(carousel)
		const count = slideCount(carousel)

		setOffset(carousel, 0)
		fitHeight(carousel)

		const prev = carousel.querySelector('[data-carousel="prev"]')
		const next = carousel.querySelector('[data-carousel="next"]')
		const counter = carousel.querySelector(".qwerty-carousel-count")

		if (prev != null) {
			prev.disabled = (index <= 0)
		}

		if (next != null) {
			next.disabled = (index >= count - 1)
		}

		if (counter != null) {
			counter.textContent = (index + 1) + " / " + count
		}
	}

	// goTo shows the photo at index, and returns false when there is no such photo (it does not wrap)
	function goTo(carousel, index) {

		if (index < 0 || index >= slideCount(carousel)) {
			return false
		}

		carousel.dataset.index = String(index)
		render(carousel)
		return true
	}

	// goToPost loads the neighboring post ("prev" or "next"), if there is one
	function goToPost(carousel, direction) {
		const link = carousel.querySelector("a.qwerty-carousel-post-" + direction)
		if (link != null) {
			link.click()
		}
	}

	// goToModalNeighbor opens the open modal's previous or next item, for a modal that links its neighbors
	function goToModalNeighbor(event) {
		const direction = (event.key == "ArrowLeft") ? "prev" : "next"
		const link = document.querySelector('#modal [data-modal-go="' + direction + '"]')
		if (link == null) {
			return
		}

		event.preventDefault()
		link.click()
	}

	// activeCarousel returns the carousel the arrow keys drive: the one in an open modal, or else the page's own
	function activeCarousel() {
		return document.querySelector("#modal .qwerty-carousel") || document.querySelector("main .qwerty-carousel")
	}

	// isTyping returns true when a key press belongs to a text field, not to the carousel
	function isTyping(target) {
		return (target instanceof Element) && (target.closest("input, textarea, select, [contenteditable]") != null)
	}

	// Left and Right move through the photos, then on to the neighboring posts, or a modal's neighboring items
	document.addEventListener("keydown", function (event) {

		if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
			return
		}

		if (event.key != "ArrowLeft" && event.key != "ArrowRight") {
			return
		}

		if (isTyping(event.target)) {
			return
		}

		const carousel = activeCarousel()
		if (carousel == null) {
			goToModalNeighbor(event)
			return
		}

		event.preventDefault()

		if (event.key == "ArrowLeft") {
			if (!goTo(carousel, indexOf(carousel) - 1)) {
				goToPost(carousel, "prev")
			}
			return
		}

		if (!goTo(carousel, indexOf(carousel) + 1)) {
			goToPost(carousel, "next")
		}
	})

	// The on-screen arrows move through the photos only, and stop at the ends
	document.addEventListener("click", function (event) {

		// A drag swallows the click that follows it, so a drag that ends on a button does not press it
		if (suppressClick) {
			suppressClick = false
			if (event.target instanceof Element && event.target.closest(".qwerty-carousel") != null) {
				event.preventDefault()
				event.stopPropagation()
				return
			}
		}

		const button = (event.target instanceof Element) ? event.target.closest(".qwerty-carousel [data-carousel]") : null
		if (button == null) {
			return
		}

		const carousel = button.closest(".qwerty-carousel")
		const step = (button.dataset.carousel == "prev") ? -1 : 1
		goTo(carousel, indexOf(carousel) + step)
	}, true)

	// A press on a slide starts a possible swipe.  Presses on buttons and links are theirs, not the carousel's.
	document.addEventListener("pointerdown", function (event) {

		if (event.pointerType == "mouse" && event.button != 0) {
			return
		}

		const stage = (event.target instanceof Element) ? event.target.closest(".qwerty-carousel-stage") : null
		if (stage == null || event.target.closest("a, button") != null) {
			return
		}

		const carousel = stage.closest(".qwerty-carousel")
		if (slideCount(carousel) < 2) {
			return
		}

		drag = {carousel: carousel, stage: stage, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, axis: ""}
	})

	// A drag locks to an axis once it clears the slop.  A horizontal drag moves the track with the pointer, hard-stopped
	// at the first and last photo, and a vertical one does nothing, so the page can still scroll.
	document.addEventListener("pointermove", function (event) {

		if (drag == null || event.pointerId != drag.pointerId) {
			return
		}

		const deltaX = event.clientX - drag.startX
		const deltaY = event.clientY - drag.startY

		if (drag.axis == "") {

			if (Math.abs(deltaX) < DRAG_SLOP && Math.abs(deltaY) < DRAG_SLOP) {
				return
			}

			drag.axis = (Math.abs(deltaX) > Math.abs(deltaY)) ? "x" : "y"

			if (drag.axis == "x") {
				track(drag.carousel).classList.add("dragging")
				try {
					drag.stage.setPointerCapture(drag.pointerId)
				} catch (error) { /* capture is best-effort */ }
			}
		}

		if (drag.axis != "x") {
			return
		}

		const index = indexOf(drag.carousel)
		const atStart = (index <= 0)
		const atEnd = (index >= slideCount(drag.carousel) - 1)
		const offset = ((deltaX > 0 && atStart) || (deltaX < 0 && atEnd)) ? 0 : deltaX

		setOffset(drag.carousel, offset)
	})

	// Releasing past the threshold commits to the neighboring photo; anything less snaps back
	document.addEventListener("pointerup", function (event) {

		const current = drag
		drag = null

		if (current == null || current.axis != "x" || event.pointerId != current.pointerId) {
			return
		}

		suppressClick = true
		track(current.carousel).classList.remove("dragging")

		const deltaX = event.clientX - current.startX

		if (Math.abs(deltaX) >= SWIPE_THRESHOLD) {
			goTo(current.carousel, indexOf(current.carousel) + ((deltaX > 0) ? -1 : 1))
		}

		setOffset(current.carousel, 0)
	})

	// A cancelled gesture (the browser took over to scroll) snaps back
	document.addEventListener("pointercancel", function () {

		if (drag == null) {
			return
		}

		track(drag.carousel).classList.remove("dragging")
		setOffset(drag.carousel, 0)
		drag = null
	})

	// A photo that finishes loading may change its carousel's height.  load does not bubble, so this listens in capture.
	document.addEventListener("load", function (event) {
		if (event.target instanceof HTMLImageElement && event.target.closest(".qwerty-carousel-slide") != null) {
			fitHeight(event.target.closest(".qwerty-carousel"))
		}
	}, true)

	// New content from htmx, and a resized window, change which heights the stages need
	document.addEventListener("htmx:load", fitAll)
	window.addEventListener("resize", fitAll)
	fitAll()

	// Photos are dragged by the carousel, not by the browser's image drag-and-drop
	document.addEventListener("dragstart", function (event) {
		if (event.target instanceof Element && event.target.closest(".qwerty-carousel-stage") != null) {
			event.preventDefault()
		}
	})
})()
