import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Coordinate } from '../types';

type Props = {
  anchor?: Coordinate;
  current?: Coordinate;
  trail?: Coordinate[];
  reverse?: boolean;
  height?: string;
  showCurrent?: boolean;
  onMapClick?: (point: Coordinate) => void;
};

export default function MapView({
  anchor, current, trail = [], reverse = false, height = '340px', showCurrent = true, onMapClick
}: Props) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return;
    const initial = current ?? anchor ?? { lat: 28.6139, lng: 77.2090 };
    const map = L.map(elementRef.current, { zoomControl: false, attributionControl: true }).setView([initial.lat, initial.lng], 17);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer(
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }
).addTo(map);
    const layers = L.layerGroup().addTo(map);
    mapRef.current = map;
    layersRef.current = layers;
    if (onMapClick) {
      map.on('click', (event: L.LeafletMouseEvent) => {
        onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng, timestamp: Date.now() });
      });
    }
    setTimeout(() => map.invalidateSize(), 100);
    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layersRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const route = reverse ? [...trail].reverse() : trail;
    if (route.length > 1) {
      L.polyline(route.map(p => [p.lat, p.lng] as L.LatLngTuple), {
        color: '#16865c', weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round', smoothFactor: 1.5
      }).addTo(layer);
      route.forEach((point, index) => {
        if (index > 0 && index < route.length - 1 && index % 5 === 0) {
          L.circleMarker([point.lat, point.lng], {
            radius: 3, color: '#ffffff', weight: 2, fillColor: '#16865c', fillOpacity: 1
          }).addTo(layer);
        }
      });
    }

    if (anchor) {
      L.circleMarker([anchor.lat, anchor.lng], {
        radius: 9, color: '#ffffff', weight: 3, fillColor: '#ef4444', fillOpacity: 1
      }).bindTooltip('Parking spot').addTo(layer);
    }
    if (showCurrent && current) {
      L.circle([current.lat, current.lng], {
        radius: Math.max(5, current.accuracy ?? 10), color: '#2384f4', weight: 1, fillColor: '#2384f4', fillOpacity: 0.08
      }).addTo(layer);
      L.circleMarker([current.lat, current.lng], {
        radius: 7, color: '#ffffff', weight: 3, fillColor: '#2384f4', fillOpacity: 1
      }).bindTooltip('You are here').addTo(layer);
    }

    const points = [...(anchor ? [anchor] : []), ...(current ? [current] : []), ...route];
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng] as L.LatLngTuple));
      map.fitBounds(bounds.pad(0.18), { maxZoom: 18, animate: true });
    }
  }, [anchor, current, trail, reverse, showCurrent]);

  return <div ref={elementRef} className="map-view" style={{ height }} aria-label="Map showing parking location and route" />;
}