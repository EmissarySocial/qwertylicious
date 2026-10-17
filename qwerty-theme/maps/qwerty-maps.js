/*
 * QWERTY MAPS draws every Leaflet map on the page that is not drawn yet.  A map is a .qwerty-map element:
 *
 *   data-tiles, data-attribution   the tile URL template and its credit (the builder's .MapTiles)
 *   data-latitude, data-longitude  the center, when there is one
 *   data-zoom                      the zoom at that center
 *   data-static="true"             a small map of one place: no dragging, zooming, or controls
 *   data-save-url                  where the author's "Set Default View" button posts the current view
 *
 * Its markers are the .qwerty-map-marker elements inside it, each with data-latitude and data-longitude.  A
 * marker's own HTML is its pop-up, written by the server, so nothing here builds HTML from data.  With no center,
 * the map fits its markers, and with no markers either it shows the whole world.
 *
 * Leaflet and this file both load asynchronously when htmx swaps a page in, so whichever arrives last draws the
 * maps: each <script> calls qwertyMaps() on load, and the call does nothing until window.L exists.
 */

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
