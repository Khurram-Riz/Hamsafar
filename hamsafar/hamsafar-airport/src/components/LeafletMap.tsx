'use client';

import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export interface MapZoneItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_km?: number;
  corridor?: {
    name: string;
    color: string;
  };
}

export interface DemoMapPassenger {
  id: string;
  lat: number;
  lng: number;
  zoneName: string;
  poolType: string;
  seats: number;
  corridorColor: string;
  passengerName: string;
}

export interface DemoMapPoolRoute {
  id: string;
  poolType: string;
  status: string;
  totalSeats: number;
  capacity: number;
  corridorColor: string;
  waypoints: Array<{ lat: number; lng: number; label: string }>;
}

interface LeafletMapProps {
  mode: 'picker' | 'demo' | 'tracker';
  heightClass?: string;
  zones?: MapZoneItem[];
  selectedZoneId?: string | null;
  pickedPin?: { lat: number; lng: number } | null;
  onPickLocation?: (lat: number, lng: number) => void;
  demoPassengers?: DemoMapPassenger[];
  demoPools?: DemoMapPoolRoute[];
  trackerRoute?: {
    origin: { lat: number; lng: number; label: string };
    destination: { lat: number; lng: number; label: string };
    live: { lat: number; lng: number };
    color?: string;
  };
}

const KHI_AIRPORT = { lat: 24.9065, lng: 67.1608 };

export function LeafletMap({
  mode,
  heightClass = 'h-72',
  zones = [],
  selectedZoneId,
  pickedPin,
  onPickLocation,
  demoPassengers = [],
  demoPools = [],
  trackerRoute,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const layerGroupRef = useRef<import('leaflet').LayerGroup | null>(null);
  const onPickRef = useRef(onPickLocation);
  onPickRef.current = onPickLocation;

  useEffect(() => {
    let active = true;

    async function initMap() {
      if (!containerRef.current || mapRef.current) return;
      const L = await import('leaflet');
      if (!active || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [24.875, 67.085],
        zoom: 11,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      const group = L.layerGroup().addTo(map);
      mapRef.current = map;
      layerGroupRef.current = group;

      if (mode === 'picker') {
        map.on('click', (e) => {
          onPickRef.current?.(
            Number(e.latlng.lat.toFixed(5)),
            Number(e.latlng.lng.toFixed(5))
          );
        });
      }
    }

    initMap();

    return () => {
      active = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, [mode]);

  useEffect(() => {
    async function renderLayers() {
      const L = await import('leaflet');
      const map = mapRef.current;
      const group = layerGroupRef.current;
      if (!map || !group) return;

      group.clearLayers();

      const airportIcon = L.divIcon({
        className: 'custom-airport-pin',
        html: `<div style="background:#0f453c;color:#fff;padding:3px 7px;border-radius:999px;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap;">✈ KHI</div>`,
        iconSize: [54, 24],
        iconAnchor: [27, 12],
      });

      if (mode === 'picker') {
        L.marker([KHI_AIRPORT.lat, KHI_AIRPORT.lng], { icon: airportIcon })
          .bindPopup('Jinnah International Airport (KHI)')
          .addTo(group);

        zones.forEach((zone) => {
          const isSelected = zone.id === selectedZoneId;
          const color = zone.corridor?.color || '#0d9488';

          L.circle([zone.lat, zone.lng], {
            radius: (zone.radius_km || 3.5) * 1000,
            color: isSelected ? '#0f453c' : color,
            weight: isSelected ? 2.5 : 1,
            fillColor: color,
            fillOpacity: isSelected ? 0.24 : 0.08,
          })
            .bindTooltip(zone.name, { direction: 'top' })
            .on('click', () => {
              onPickRef.current?.(zone.lat, zone.lng);
            })
            .addTo(group);

          const zonePin = L.divIcon({
            className: 'zone-label-pin',
            html: `<div style="background:${
              isSelected ? '#0f453c' : '#ffffff'
            };color:${
              isSelected ? '#ffffff' : '#0f172a'
            };padding:2px 6px;border-radius:6px;font-size:10px;font-weight:600;border:1.5px solid ${color};box-shadow:0 1px 4px rgba(0,0,0,0.18);white-space:nowrap;">${
              zone.name
            }</div>`,
            iconAnchor: [35, 10],
          });

          L.marker([zone.lat, zone.lng], { icon: zonePin })
            .on('click', () => {
              onPickRef.current?.(zone.lat, zone.lng);
            })
            .addTo(group);
        });

        if (pickedPin) {
          const userIcon = L.divIcon({
            className: 'user-drop-pin',
            html: `<div style="width:18px;height:18px;background:#e11d48;border:3px solid #fff;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });

          L.marker([pickedPin.lat, pickedPin.lng], { icon: userIcon })
            .bindPopup('Your dropped destination pin')
            .addTo(group);

          const snappedZone = zones.find((z) => z.id === selectedZoneId);
          if (snappedZone) {
            L.polyline(
              [
                [pickedPin.lat, pickedPin.lng],
                [snappedZone.lat, snappedZone.lng],
              ],
              {
                color: '#e11d48',
                weight: 2,
                dashArray: '6, 6',
              }
            ).addTo(group);
          }
        }
      }

      if (mode === 'demo') {
        L.marker([KHI_AIRPORT.lat, KHI_AIRPORT.lng], { icon: airportIcon })
          .bindPopup('Jinnah International Airport (KHI) — Pickup Bay')
          .addTo(group);

        zones.forEach((zone) => {
          const color = zone.corridor?.color || '#0d9488';
          L.circle([zone.lat, zone.lng], {
            radius: (zone.radius_km || 3.2) * 850,
            color,
            weight: 1,
            fillColor: color,
            fillOpacity: 0.08,
          }).addTo(group);
        });

        demoPools.forEach((pool) => {
          if (pool.waypoints.length > 0) {
            const latLngs: [number, number][] = [
              [KHI_AIRPORT.lat, KHI_AIRPORT.lng],
              ...pool.waypoints.map((w) => [w.lat, w.lng] as [number, number]),
            ];
            L.polyline(latLngs, {
              color: pool.corridorColor,
              weight: pool.status === 'confirmed' ? 3.5 : 2,
              opacity: pool.status === 'confirmed' ? 0.85 : 0.45,
              dashArray: pool.status === 'confirmed' ? undefined : '5, 6',
            })
              .bindPopup(
                `<strong>${pool.poolType.toUpperCase()} Pool</strong> (${
                  pool.totalSeats
                }/${pool.capacity} seats) — ${pool.status}`
              )
              .addTo(group);
          }
        });

        demoPassengers.forEach((p) => {
          const border =
            p.poolType === 'women_only'
              ? '#c026d3'
              : p.poolType === 'family_only'
              ? '#4f46e5'
              : '#ffffff';

          const paxIcon = L.divIcon({
            className: 'demo-pax-pin',
            html: `<div style="width:14px;height:14px;background:${p.corridorColor};border:2.5px solid ${border};border-radius:999px;box-shadow:0 1px 4px rgba(0,0,0,0.35);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });

          L.marker([p.lat, p.lng], { icon: paxIcon })
            .bindPopup(
              `<strong>${p.passengerName}</strong><br/>Zone: ${p.zoneName}<br/>Seats: ${p.seats} · ${p.poolType}`
            )
            .addTo(group);
        });
      }

      if (mode === 'tracker' && trackerRoute) {
        const lineColor = trackerRoute.color || '#0d9488';
        L.polyline(
          [
            [trackerRoute.origin.lat, trackerRoute.origin.lng],
            [trackerRoute.destination.lat, trackerRoute.destination.lng],
          ],
          {
            color: lineColor,
            weight: 4,
            opacity: 0.75,
          }
        ).addTo(group);

        L.marker([trackerRoute.origin.lat, trackerRoute.origin.lng], {
          icon: airportIcon,
        })
          .bindPopup(trackerRoute.origin.label)
          .addTo(group);

        const destIcon = L.divIcon({
          className: 'tracker-dest-pin',
          html: `<div style="background:#0f172a;color:#fff;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700;border:2px solid #fff;">🏁 ${trackerRoute.destination.label}</div>`,
          iconAnchor: [40, 12],
        });
        L.marker([trackerRoute.destination.lat, trackerRoute.destination.lng], {
          icon: destIcon,
        }).addTo(group);

        const vanIcon = L.divIcon({
          className: 'tracker-van-pin',
          html: `<div style="background:#f59e0b;color:#0f172a;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:800;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);">🚐 Van</div>`,
          iconAnchor: [24, 12],
        });
        L.marker([trackerRoute.live.lat, trackerRoute.live.lng], {
          icon: vanIcon,
        })
          .bindPopup('Live Hamsafar Ride Position (Simulated)')
          .addTo(group);

        map.fitBounds(
          [
            [trackerRoute.origin.lat, trackerRoute.origin.lng],
            [trackerRoute.destination.lat, trackerRoute.destination.lng],
          ],
          { padding: [36, 36] }
        );
      }
    }

    renderLayers();
  }, [
    mode,
    zones,
    selectedZoneId,
    pickedPin,
    demoPassengers,
    demoPools,
    trackerRoute,
  ]);

  return (
    <div
      ref={containerRef}
      className={`w-full ${heightClass} rounded-2xl overflow-hidden border border-slate-200 bg-slate-100`}
      aria-label="Interactive Karachi route map"
    />
  );
}
