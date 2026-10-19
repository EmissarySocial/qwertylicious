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

		// Markers, which open a modal or a server-written pop-up
		var bounds = [];
		element.querySelectorAll(".qwerty-map-marker").forEach(function (item) {
			var latitude = parseFloat(item.dataset.latitude);
			var longitude = parseFloat(item.dataset.longitude);
			if (isNaN(latitude) || isNaN(longitude)) {
				return;
			}
			var label = item.dataset.label || "";
			var marker = L.marker([latitude, longitude], {title: label, alt: label}).addTo(map);

			// A marker with a modal opens it on click, with no pop-up in between
			var modalURL = item.dataset.modalUrl;
			if (modalURL && window.htmx) {
				marker.on("click", function () {
					htmx.ajax("GET", modalURL, {target: "aside", swap: "innerHTML"});
				});
			} else if (item.innerHTML.trim() !== "") {
				marker.bindPopup(item.innerHTML, {maxWidth: 280});
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
