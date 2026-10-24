# ParkMate

A mobile-first parking-memory app prototype built with React, TypeScript, Vite, Leaflet, OpenStreetMap tiles, IndexedDB and a PWA manifest.

## Included in this build

- Home, Return Navigation, Profile and Parking History views
- Pin Location: saves GPS coordinates and opens Google Maps walking directions
- Path Recording: time, distance or manual recording limit
- GPS accuracy checks and basic jump/jitter filtering
- Smoothed trail rendering with original coordinates retained separately
- Reverse-order trail display for return mode
- Direction arrow based on the next reverse-path segment
- Share parking anchor using Web Share API, clipboard fallback, or copy prompt
- Vehicle profiles
- IndexedDB persistence for sessions, route coordinates and profile data
- PWA manifest and service-worker generation through Vite PWA plugin
- Mobile-first layout and safe-area spacing

## Requirements

- Node.js 20.19+ or 22.12+ recommended for current Vite releases
- npm
- Browser with Geolocation support
- HTTPS or `localhost` for GPS and Web Share API

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. For GPS testing, use `localhost` or an HTTPS deployment and allow location permission.

## Build for deployment

```bash
npm run build
npm run preview
```

The production output is written to `dist/`.

## Notes and limitations

- This is a production-oriented prototype, not yet a fully production-validated native mobile app.
- Browser GPS tracking is reliable only while the browser/app is allowed to run. Background tracking after screen lock or app suspension is not guaranteed. A native Android app with an appropriate foreground location service may be required for continuous background recording.
- The “manual” recording option has no automatic time/distance cap, so the user must finish it. Operating-system/browser suspension can still interrupt it.
- The route shown in Path Recording mode is the reversed recorded GPS trail, not a guaranteed pedestrian-safe route. GPS errors, missing fixes, obstacles and indoor environments can affect it.
- The map uses OpenStreetMap standard tiles. Follow the tile provider's usage policy; use a suitable hosted tile provider for production-scale usage.
- Google Maps is opened for Pin Location mode. No Google Maps API key is required for the directions URL.
- User/profile data is local to the browser profile. Cloud accounts and synchronization are not included.
- The app does not automatically infer that a vehicle has been parked; the user starts a parking flow explicitly.
- Browser location permissions must be granted by the user. Location is not requested until a location action is initiated.
- Review privacy, accessibility, tile-provider policy, data retention, GPS accuracy and device testing before public release.
