'use client';

// Este archivo usa Leaflet, que solo funciona en el navegador.
// Importarlo siempre con: dynamic(() => import('@/components/live-map'), { ssr: false })

import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';

const BUS_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffb000" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M8 18v2M16 18v2"/><circle cx="8" cy="14.5" r="0.6" fill="#ffb000"/><circle cx="16" cy="14.5" r="0.6" fill="#ffb000"/></svg>`;

const busIcon = L.divIcon({ className: '', html: `<div class="bus-pin">${BUS_SVG}</div>`, iconSize: [44, 44], iconAnchor: [22, 22] });
const meIcon = L.divIcon({ className: '', html: '<div class="me-pin"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
}

/** Centra el mapa cuando se mueve el bus (o encuadra todos los buses). */
function Follow({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  const key = markers.map((m) => `${m.lat.toFixed(5)},${m.lng.toFixed(5)}`).join('|');
  useEffect(() => {
    if (!markers.length) return;
    if (markers.length === 1) {
      const m = markers[0]!;
      map.setView([m.lat, m.lng], Math.max(map.getZoom(), 13), { animate: true });
    } else {
      map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])), { padding: [50, 50], maxZoom: 13 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

export default function LiveMap({
  markers,
  variant = 'bus',
  className,
}: {
  markers: MapMarker[];
  variant?: 'bus' | 'me';
  className?: string;
}) {
  // Centro de Paraguay si todavía no hay posición
  const center = useMemo<[number, number]>(
    () => (markers[0] ? [markers[0].lat, markers[0].lng] : [-25.9, -56.6]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <MapContainer
      center={center}
      zoom={markers.length ? 13 : 6}
      scrollWheelZoom
      className={className ?? 'h-[420px] w-full rounded-2xl'}
      style={{ zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((m) => (
        <Marker key={m.id} position={[m.lat, m.lng]} icon={variant === 'me' ? meIcon : busIcon}>
          {m.label && <Tooltip direction="top" offset={[0, -24]} permanent={markers.length > 1}>{m.label}</Tooltip>}
        </Marker>
      ))}
      <Follow markers={markers} />
    </MapContainer>
  );
}
