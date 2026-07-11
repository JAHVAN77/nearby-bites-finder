const statusEl = document.getElementById('status');
const contentEl = document.getElementById('content');
const filtersEl = document.getElementById('filters');
const resultsEl = document.getElementById('results');
const radiusSelect = document.getElementById('radius-select');

let map = null;
let markers = [];
let userLatLng = null;
let currentPlaces = [];

const TYPE_LABELS = {
  restaurant: 'restaurant',
  cafe: 'cafe',
  fast_food: 'fast food',
  bar: 'bar',
};

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? '#c94e1e' : '';
}

function initMap(lat, lng) {
  if (map) { map.remove(); }
  map = L.map('map').setView([lat, lng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);
  L.circleMarker([lat, lng], { radius: 8, color: '#2b2320', fillColor: '#2b2320', fillOpacity: 1 })
    .addTo(map)
    .bindPopup('You are here');
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(m) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

async function fetchNearbyFood(lat, lng, radius, types) {
  const typeFilter = types.map((t) => `["amenity"="${t}"]`);
  const query = `
    [out:json][timeout:25];
    (
      ${typeFilter.map((f) => `node${f}(around:${radius},${lat},${lng});`).join('\n')}
      ${typeFilter.map((f) => `way${f}(around:${radius},${lat},${lng});`).join('\n')}
    );
    out center tags;
  `;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query,
  });
  if (!res.ok) throw new Error('Overpass API request failed');
  const data = await res.json();
  return data.elements
    .map((el) => {
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (elLat == null || elLng == null) return null;
      const tags = el.tags || {};
      return {
        id: el.id,
        name: tags.name || 'Unnamed spot',
        type: tags.amenity,
        cuisine: tags.cuisine ? tags.cuisine.replace(/_/g, ' ').split(';')[0] : null,
        lat: elLat,
        lng: elLng,
        distance: haversine(lat, lng, elLat, elLng),
      };
    })
    .filter(Boolean)
    .filter((p) => p.name !== 'Unnamed spot')
    .sort((a, b) => a.distance - b.distance);
}

function clearMarkers() {
  markers.forEach((m) => map.removeLayer(m));
  markers = [];
}

function renderResults(places) {
  currentPlaces = places;
  resultsEl.innerHTML = '';
  clearMarkers();

  if (places.length === 0) {
    resultsEl.innerHTML = '<li>No spots found. Try a bigger radius or different filters.</li>';
    return;
  }

  places.forEach((place, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <p class="result-name">${place.name}</p>
      <div class="result-meta">
        <span class="tag">${TYPE_LABELS[place.type] || place.type}</span>
        ${place.cuisine ? `<span class="tag">${place.cuisine}</span>` : ''}
        <span>${formatDistance(place.distance)} away</span>
      </div>
    `;
    li.addEventListener('click', () => focusPlace(i));
    resultsEl.appendChild(li);

    const marker = L.marker([place.lat, place.lng])
      .addTo(map)
      .bindPopup(`<b>${place.name}</b><br>${formatDistance(place.distance)} away`);
    marker.on('click', () => focusPlace(i));
    markers.push(marker);
  });
}

function focusPlace(index) {
  const place = currentPlaces[index];
  if (!place) return;
  map.setView([place.lat, place.lng], 17);
  markers[index].openPopup();
  document.querySelectorAll('#results li').forEach((li, i) => {
    li.classList.toggle('active', i === index);
  });
}

function getSelectedTypes() {
  return Array.from(filtersEl.querySelectorAll('input[type=checkbox]:checked')).map((c) => c.value);
}

async function loadFood(lat, lng) {
  userLatLng = { lat, lng };
  initMap(lat, lng);
  filtersEl.hidden = false;
  contentEl.hidden = false;
  const types = getSelectedTypes();
  const radius = radiusSelect.value;
  setStatus('Searching nearby spots...');
  try {
    const places = await fetchNearbyFood(lat, lng, radius, types.length ? types : Object.keys(TYPE_LABELS));
    renderResults(places);
    setStatus(`Found ${places.length} spot${places.length === 1 ? '' : 's'} within ${radius >= 1000 ? radius / 1000 + ' km' : radius + ' m'}.`);
  } catch (err) {
    setStatus('Something went wrong fetching food spots. Try again in a moment.', true);
    console.error(err);
  }
}

document.getElementById('locate-btn').addEventListener('click', () => {
  if (!navigator.geolocation) {
    setStatus('Geolocation is not supported by your browser.', true);
    return;
  }
  setStatus('Locating you...');
  navigator.geolocation.getCurrentPosition(
    (pos) => loadFood(pos.coords.latitude, pos.coords.longitude),
    (err) => setStatus(`Could not get your location: ${err.message}`, true),
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

document.getElementById('place-btn').addEventListener('click', searchPlace);
document.getElementById('place-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchPlace();
});

async function searchPlace() {
  const query = document.getElementById('place-input').value.trim();
  if (!query) return;
  setStatus('Looking up that place...');
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
    );
    const data = await res.json();
    if (!data.length) {
      setStatus('Could not find that place. Try being more specific.', true);
      return;
    }
    loadFood(parseFloat(data[0].lat), parseFloat(data[0].lon));
  } catch (err) {
    setStatus('Place lookup failed. Try again.', true);
    console.error(err);
  }
}

filtersEl.addEventListener('change', () => {
  if (userLatLng) loadFood(userLatLng.lat, userLatLng.lng);
});

const surpriseModal = document.getElementById('surprise-modal');
document.getElementById('surprise-btn').addEventListener('click', showSurprise);
document.getElementById('reroll-btn').addEventListener('click', showSurprise);
document.getElementById('modal-close').addEventListener('click', () => {
  surpriseModal.hidden = true;
});

function showSurprise() {
  if (currentPlaces.length === 0) return;
  const pick = currentPlaces[Math.floor(Math.random() * currentPlaces.length)];
  document.getElementById('surprise-name').textContent = pick.name;
  document.getElementById('surprise-meta').textContent = `${TYPE_LABELS[pick.type] || pick.type}${
    pick.cuisine ? ' · ' + pick.cuisine : ''
  } · ${formatDistance(pick.distance)} away`;
  surpriseModal.hidden = false;
}
