/*
 * QWERTY MAPS draws each undrawn .qwerty-map from its data-tiles, -attribution, -latitude, -longitude, -zoom,
 * -static, and -save-url attributes; its .qwerty-map-marker children are markers, which open their data-modal-url
 * on click, or else show their own HTML as a pop-up.
 * RULE: Leaflet and this file load in either order, so qwertyMaps() waits for window.L (see AGENTS.md).
 */

/** qwertyMaps draws every map on the page that is not drawn yet */
window.qwertyMaps = function () {

	if (!window.L) {
		return;
	}

	document.querySelectorAll(".qwerty-map:not([data-drawn])").forEach(function (element) {

		element.setAttribute("data-drawn", "true");

		var canvas = element.querySelector(".qwerty-map-canvas");
		var isStatic = element.dataset.static === "true";

		var map = L.map(canvas, {
			zoomControl: !isStatic,
			dragging: !isStatic,
			scrollWheelZoom: false,
			touchZoom: !isStatic,
			doubleClickZoom: !isStatic,
			boxZoom: !isStatic,
			keyboard: !isStatic
		});

		map.attributionControl.setPrefix("");
		L.tileLayer(element.dataset.tiles, {maxZoom: 19, attribution: element.dataset.attribution}).addTo(map);

		// Markers, with their server-written pop-ups
		var bounds = [];
		element.querySelectorAll(".qwerty-map-marker").forEach(function (item) {
			var latitude = parseFloat(item.dataset.latitude);
			var longitude = parseFloat(item.dataset.longitude);
			if (isNaN(latitude) || isNaN(longitude)) {
				return;
			}
			var marker = L.marker([latitude, longitude]).addTo(map);
			if (item.innerHTML.trim() !== "") {
				marker.bindPopup(item.innerHTML, {maxWidth: 280});

				// Leaflet adds the pop-up after htmx has scanned the page, so htmx must wire up its links itself
				marker.on("popupopen", function (event) {
					if (window.htmx) {
						htmx.process(event.popup.getElement());
					}
				});
			}
			bounds.push([latitude, longitude]);
		});

		// The view: the saved center, else the markers, else the world
		var latitude = parseFloat(element.dataset.latitude);
		var longitude = parseFloat(element.dataset.longitude);
		var zoom = parseInt(element.dataset.zoom, 10);

		if (!isNaN(latitude) && !isNaN(longitude) && !(latitude === 0 && longitude === 0)) {
			map.setView([latitude, longitude], isNaN(zoom) ? 13 : zoom);
		} else if (bounds.length === 1) {
			map.setView(bounds[0], 13);
		} else if (bounds.length > 1) {
			map.fitBounds(bounds, {padding: [32, 32]});
		} else {
			map.setView([20, 0], 2);
		}

		// The author's button that saves the current view as the map's default
		var save = element.querySelector(".qwerty-map-save");
		if (save && window.htmx) {
			save.addEventListener("click", function () {
				var center = map.getCenter();
				htmx.ajax("POST", element.dataset.saveUrl, {
					swap: "none",
					values: {
						"location.latitude": center.lat.toFixed(6),
						"location.longitude": center.lng.toFixed(6),
						"data.zoom": map.getZoom()
					}
				}).then(function () {
					save.textContent = "Saved";
				});
			});
		}
	});
};

window.qwertyMaps();
