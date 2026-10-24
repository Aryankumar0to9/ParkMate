# ParkMate 🚗

ParkMate is a mobile-first parking assistant for saving a vehicle's parking coordinates, recording a walking trail, and helping users return to their vehicle.

## Features

- **Map-first home screen:** live map directly below the ParkMate header; the promotional hero banner has been removed.
- **Pin Location:** choose a vehicle type or skip, preview the detected GPS location on a map, then confirm before saving coordinates.
- **Path Recording:** record a GPS trail away from the parking anchor, with manual or configured time/distance stopping options.
- **Return navigation:** view saved parking and use a recorded trail in reverse.
- **Vehicle profiles, parking history, and location sharing.**
- **Local storage:** parking sessions are stored in the browser on this device. No cloud account/backend is configured.

## Tech stack

React, TypeScript, Vite, Leaflet, OpenStreetMap data via CARTO's light tile style, browser Geolocation API, IndexedDB, and PWA configuration.

## Requirements

Install Node.js 20.19+ or 22.12+.

## Run locally

Extract the project ZIP, open a terminal in the folder containing `package.json`, then run:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. For a production build, run `npm run build`.

## Notes

- Allow location access in the browser for live GPS features. Accuracy depends on the device and environment.
- Browser-based tracking may pause when the app is backgrounded or the device sleeps.
- The public CARTO tile endpoint is subject to provider terms and rate limits. Choose a provider and plan suitable for production traffic before public launch.
- The build should be tested locally after installing dependencies.

## License

No license has been selected yet.
