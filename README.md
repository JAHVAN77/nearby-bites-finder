# Nearby Bites Finder 🍜

Find food near you, right now. A lightweight browser app that shows nearby restaurants, cafes, fast food, and bars on a map.

## Features

- 📍 Use your current location, or type in a city/address to search elsewhere
- 🗺️ Interactive map (via [Leaflet](https://leafletjs.com/) + OpenStreetMap tiles) with markers for each spot
- 🔍 Filter by place type (restaurants, cafes, fast food, bars) and search radius
- 🎲 "Surprise Me" picks a random spot from your results when you can't decide

## Running locally

This is a static site with no build step. Just open `index.html` in a browser, or serve the folder with any static file server, e.g.:

```bash
npx serve .
```

## How it works

- Place search uses the [Nominatim](https://nominatim.openstreetmap.org/) geocoding API.
- Nearby food spots are fetched from the [Overpass API](https://overpass-api.de/) (OpenStreetMap data).
- No API keys or backend required.
