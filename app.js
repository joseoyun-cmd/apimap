const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const REQUEST_GAP_MS = 1100;

const locations = {
  origin: { input: document.querySelector("#origin-input"), place: null, requestId: 0 },
  destination: {
    input: document.querySelector("#destination-input"),
    place: null,
    requestId: 0,
  },
};

const calculateButton = document.querySelector("#calculate-button");
const formMessage = document.querySelector("#form-message");
const result = document.querySelector("#result");
const distanceValue = document.querySelector("#distance-value");
const mapLink = document.querySelector("#map-link");
const routeMapSection = document.querySelector("#route-map");
const mapCanvas = document.querySelector("#map-canvas");
const mapStatus = document.querySelector("#map-status");
let lastNominatimRequestAt = 0;
let nominatimQueue = Promise.resolve();
let routeMap = null;
let routeOverlay = null;
let currentRoute = null;

function setMessage(message) {
  formMessage.textContent = message;
}

function clearResult() {
  result.hidden = true;
  routeMapSection.hidden = true;
  distanceValue.textContent = "";
  mapStatus.textContent = "";
  currentRoute = null;
  if (routeMap && routeOverlay) {
    routeMap.removeLayer(routeOverlay);
    routeOverlay = null;
  }
}

function updateCalculateButton() {
  calculateButton.disabled = !locations.origin.place || !locations.destination.place;
}

function addPlaceMarker(place, color) {
  const label = document.createElement("span");
  label.textContent = place.name || place.display_name;

  return L.circleMarker([Number(place.lat), Number(place.lon)], {
    radius: 8,
    color: "#ffffff",
    weight: 3,
    fillColor: color,
    fillOpacity: 1,
  }).bindTooltip(label, { direction: "top", offset: [0, -7] });
}

function showRouteMap() {
  if (!currentRoute) return;

  routeMapSection.hidden = false;
  routeMapSection.scrollIntoView({ behavior: "smooth", block: "nearest" });

  if (!routeMap) {
    routeMap = L.map(mapCanvas, { scrollWheelZoom: false });
    const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    }).addTo(routeMap);
    mapStatus.textContent = "지도를 불러오고 있어요.";
    tiles.once("load", () => {
      mapStatus.textContent = "";
    });
    tiles.once("tileerror", () => {
      mapStatus.textContent = "지도를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
    });
  }

  if (routeOverlay) {
    routeMap.removeLayer(routeOverlay);
  }

  const routeCoordinates = currentRoute.geometry.coordinates.map(([longitude, latitude]) => [
    latitude,
    longitude,
  ]);
  const routeLine = L.polyline(routeCoordinates, {
    color: "#39734a",
    weight: 5,
    opacity: 0.9,
    lineJoin: "round",
  });
  routeOverlay = L.featureGroup([
    routeLine,
    addPlaceMarker(currentRoute.origin, "#408154"),
    addPlaceMarker(currentRoute.destination, "#e08256"),
  ]).addTo(routeMap);

  window.requestAnimationFrame(() => {
    routeMap.invalidateSize();
    routeMap.fitBounds(routeOverlay.getBounds(), {
      padding: [30, 30],
      maxZoom: 15,
    });
  });
}

function suggestionAddress(place) {
  const address = place.address || {};
  const parts = [
    address.road,
    address.suburb || address.neighbourhood,
    address.city || address.town || address.village || address.county,
    address.state,
  ].filter(Boolean);

  return parts.length ? [...new Set(parts)].join(", ") : place.display_name;
}

function queueNominatimRequest(url) {
  const request = nominatimQueue.then(async () => {
    const wait = REQUEST_GAP_MS - (Date.now() - lastNominatimRequestAt);
    if (wait > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, wait));
    }

    lastNominatimRequestAt = Date.now();
    return fetch(url, {
      headers: { Accept: "application/json" },
    });
  });

  nominatimQueue = request.then(
    () => undefined,
    () => undefined,
  );
  return request;
}

function showSuggestions(key, places) {
  const container = document.querySelector(`#${key}-suggestions`);
  container.replaceChildren();

  for (const place of places) {
    const button = document.createElement("button");
    const name = document.createElement("span");
    const address = document.createElement("span");

    button.type = "button";
    button.className = "suggestion";
    name.className = "suggestion-name";
    address.className = "suggestion-address";
    name.textContent = place.name || place.display_name.split(",")[0];
    address.textContent = suggestionAddress(place);
    button.append(name, address);
    button.addEventListener("click", () => {
      locations[key].place = place;
      locations[key].input.value = place.name || place.display_name.split(",")[0];
      document.querySelector(`#${key}-selection`).textContent = suggestionAddress(place);
      document.querySelector(`#${key}-selection`).classList.add("is-selected");
      container.replaceChildren();
      clearResult();
      setMessage("");
      updateCalculateButton();
    });
    container.append(button);
  }
}

async function searchPlace(key) {
  const location = locations[key];
  const query = location.input.value.trim();
  const requestId = ++location.requestId;
  const container = document.querySelector(`#${key}-suggestions`);

  location.place = null;
  document.querySelector(`#${key}-selection`).textContent = "장소를 검색해 선택해 주세요.";
  document.querySelector(`#${key}-selection`).classList.remove("is-selected");
  container.replaceChildren();
  clearResult();
  setMessage("");
  updateCalculateButton();

  if (query.length < 2) {
    setMessage("장소 이름을 두 글자 이상 입력해 주세요.");
    location.input.focus();
    return;
  }

  const searchButtons = document.querySelectorAll(".search-button");
  searchButtons.forEach((button) => {
    button.disabled = true;
  });
  container.textContent = "장소를 찾고 있어요...";

  try {
    const url = new URL(NOMINATIM_URL);
    url.search = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      limit: "5",
      "accept-language": "ko",
    });
    const response = await queueNominatimRequest(url);
    if (!response.ok) {
      throw new Error("장소 검색 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    }

    const places = await response.json();
    if (requestId !== location.requestId) return;
    container.replaceChildren();

    if (!Array.isArray(places) || places.length === 0) {
      setMessage("검색 결과가 없습니다. 다른 이름으로 검색해 주세요.");
      return;
    }

    setMessage("검색 결과에서 정확한 장소를 선택해 주세요.");
    showSuggestions(key, places);
  } catch (error) {
    if (requestId !== location.requestId) return;
    container.replaceChildren();
    setMessage(
      error instanceof TypeError
        ? "네트워크 오류로 장소를 검색하지 못했습니다. 연결을 확인해 주세요."
        : error.message,
    );
  } finally {
    searchButtons.forEach((button) => {
      button.disabled = false;
    });
  }
}

document.querySelectorAll(".search-button").forEach((button) => {
  button.addEventListener("click", () => searchPlace(button.dataset.search));
});

for (const [key, location] of Object.entries(locations)) {
  location.input.addEventListener("input", () => {
    location.requestId += 1;
    location.place = null;
    document.querySelector(`#${key}-suggestions`).replaceChildren();
    const selection = document.querySelector(`#${key}-selection`);
    selection.textContent = "장소를 검색해 선택해 주세요.";
    selection.classList.remove("is-selected");
    clearResult();
    setMessage("");
    updateCalculateButton();
  });

  location.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchPlace(key);
    }
  });
}

mapLink.addEventListener("click", (event) => {
  event.preventDefault();
  showRouteMap();
});

document.querySelector("#distance-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const origin = locations.origin.place;
  const destination = locations.destination.place;

  if (!origin || !destination) {
    setMessage("출발지와 도착지를 각각 검색해 선택해 주세요.");
    return;
  }

  calculateButton.disabled = true;
  calculateButton.textContent = "경로를 계산하고 있어요...";
  setMessage("");
  clearResult();

  try {
    const coordinates = `${origin.lon},${origin.lat};${destination.lon},${destination.lat}`;
    const url = new URL(`${OSRM_URL}/${coordinates}`);
    url.search = new URLSearchParams({
      overview: "full",
      geometries: "geojson",
      alternatives: "false",
    });
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error("경로 검색 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    }

    const data = await response.json();
    if (data.code !== "Ok" || !data.routes?.length) {
      throw new Error("두 장소 사이의 자동차 경로를 찾을 수 없습니다.");
    }

    const route = data.routes[0];
    if (!Array.isArray(route.geometry?.coordinates) || route.geometry.coordinates.length < 2) {
      throw new Error("지도에 표시할 경로를 불러오지 못했습니다.");
    }

    currentRoute = {
      origin,
      destination,
      geometry: route.geometry,
    };
    const kilometers = route.distance / 1000;
    distanceValue.textContent = `${new Intl.NumberFormat("ko-KR", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    }).format(kilometers)} km`;

    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    setMessage(
      error instanceof TypeError
        ? "네트워크 오류로 거리를 계산하지 못했습니다. 연결을 확인해 주세요."
        : error.message,
    );
  } finally {
    calculateButton.innerHTML = '거리 확인하기 <span aria-hidden="true">→</span>';
    updateCalculateButton();
  }
});
