/*
 * QWERTY MAPS draws each undrawn .qwerty-map from its data-tiles, -attribution, -latitude, -longitude, -zoom,
 * -tag, and -static attributes; its .qwerty-map-marker children are markers, which open their data-modal-url
 * on click, or else show their own HTML as a pop-up.
 * RULE: Leaflet and this file load in either order, so qwertyMaps() waits for window.L (see AGENTS.md).
 * RULE: a canvas that htmx keeps (hx-preserve) keeps its map, so a swap redraws only its markers and view (see AGENTS.md).
 */
(function () {

	/** qwertyMaps draws every map on the page that is not drawn yet */
	window.qwertyMaps = function () {

		if (!window.L) {
			return;
		}

		document.querySelectorAll(".qwerty-map").forEach(function (element) {

			// RULE: the drawn mark is a property, not an attribute, so the copy htmx saves for the Back button draws again
			if (element.qwertyDrawn) {
				return;
			}
			element.qwertyDrawn = true;

			// A canvas kept from the last swap still holds its map; any other gets a new one
			var canvas = element.querySelector(".qwerty-map-canvas");
			if (!canvas.qwertyMap) {
				canvas.qwertyMap = newMap(canvas, element);
			}

			// The markers are always this element's, and the view follows them
			var points = drawMarkers(canvas.qwertyMap, element);
			setView(canvas.qwertyMap, element, points);
		});
	};

	/** newMap draws an empty Leaflet map with its tiles, and returns it with the Leaflet that drew it and its marker layer */
	function newMap(canvas, element) {

		// A canvas restored by the Back button holds a dead map's panes, which go first
		canvas.replaceChildren();

		// Draw the map, which a static map shows without any controls
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

		// Add the tiles and their attribution
		map.attributionControl.setPrefix("");
		L.tileLayer(element.dataset.tiles, {maxZoom: 19, attribution: element.dataset.attribution}).addTo(map);

		// Every later swap reloads leaflet.js, which replaces window.L, so the map keeps the copy that drew it.
		// RULE: the marker icon names its images, because Leaflet guesses them from leaflet.css and keeps a guess made before it loads
		var drawn = {
			leaflet: L,
			map: map,
			markers: L.layerGroup().addTo(map),
			icon: new L.Icon.Default({imagePath: "/.themes/global/resources/leaflet-1.9.4/images/"}),
			zooming: false,
			pending: null
		};

		// RULE: Leaflet drops a new view while a zoom animates, so a view asked for then waits for the zoom to end (see AGENTS.md)
		map.on("zoomanim", function () {
			drawn.zooming = true;
		});
		map.on("zoomend", function () {
			var pending = drawn.pending;
			drawn.zooming = false;
			drawn.pending = null;
			if (pending) {
				pending();
			}
		});

		return drawn;
	}

	/** drawMarkers replaces the map's markers with the element's .qwerty-map-marker children, and returns their points */
	function drawMarkers(drawn, element) {

		var leaflet = drawn.leaflet;
		var points = [];
		drawn.markers.clearLayers();

		element.querySelectorAll(".qwerty-map-marker").forEach(function (item) {

			// Skip a marker with no usable location
			var latitude = parseFloat(item.dataset.latitude);
			var longitude = parseFloat(item.dataset.longitude);
			if (isNaN(latitude) || isNaN(longitude)) {
				return;
			}

			// Draw the marker, named for screen readers by its label
			var label = item.dataset.label || "";
			var marker = leaflet.marker([latitude, longitude], {icon: drawn.icon, title: label, alt: label}).addTo(drawn.markers);

			// A marker with a modal opens it on click, with no pop-up in between
			var modalURL = item.dataset.modalUrl;
			if (modalURL && window.htmx) {
				marker.on("click", function () {
					htmx.ajax("GET", modalURL, {target: "aside", swap: "innerHTML"});
				});
			} else if (item.innerHTML.trim() !== "") {
				marker.bindPopup(item.innerHTML, {maxWidth: 280});
			}
			points.push([latitude, longitude]);
		});

		return points;
	}

	/** setView fits a map with a selected tag to its places, and shows any other in its saved view, else its places, else the world */
	function setView(drawn, element, points) {

		// A view asked for during a zoom waits for it, and a later one replaces it
		if (drawn.zooming) {
			drawn.pending = function () {
				setView(drawn, element, points);
			};
			return;
		}

		// A selected tag fits the map to its places, over any saved view
		var map = drawn.map;
		if (element.dataset.tag && points.length > 0) {
			fitPoints(map, points);
			return;
		}

		// The saved view, which a Map without a location does not have
		var latitude = parseFloat(element.dataset.latitude);
		var longitude = parseFloat(element.dataset.longitude);
		var zoom = parseInt(element.dataset.zoom, 10);
		if (!isNaN(latitude) && !isNaN(longitude) && !(latitude === 0 && longitude === 0)) {
			map.setView([latitude, longitude], isNaN(zoom) ? 13 : zoom);
			return;
		}

		// Otherwise the places, else the world
		if (points.length > 0) {
			fitPoints(map, points);
			return;
		}
		map.setView([20, 0], 2);
	}

	/** fitPoints centers the map on one point, or fits it around several */
	function fitPoints(map, points) {

		if (points.length === 1) {
			map.setView(points[0], 13);
			return;
		}
		map.fitBounds(points, {padding: [32, 32]});
	}

	window.qwertyMaps();
})();
