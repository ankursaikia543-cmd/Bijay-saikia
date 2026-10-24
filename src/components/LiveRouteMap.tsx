import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LiveRouteMapProps {
  fromCoords?: [number, number] | null;
  toCoords?: [number, number] | null;
  driverCoords?: [number, number] | null;
  driverBearing?: number;
  driverSpeed?: number;
  showBlueDotLine?: boolean;
  fromLabel?: string;
  toLabel?: string;
  driverVehicleIcon?: string;
  fleetDrivers?: any[];
  height?: string;
  className?: string;
}

export function LiveRouteMap({
  fromCoords,
  toCoords,
  driverCoords,
  driverBearing = 0,
  driverSpeed = 0,
  showBlueDotLine = true,
  fromLabel,
  toLabel,
  driverVehicleIcon,
  fleetDrivers = [],
  height = '400px',
  className = '',
}: LiveRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const fleetLayerRef = useRef<L.LayerGroup | null>(null);
  const blueRouteLineRef = useRef<L.GeoJSON | null>(null);
  const [routeLine, setRouteLine] = useState<any>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView([26.1445, 91.7362], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    fleetLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (markersRef.current) markersRef.current.clearLayers();
    if (blueRouteLineRef.current) {
      map.removeLayer(blueRouteLineRef.current);
      blueRouteLineRef.current = null;
    }

    const boundsPoints: L.LatLngExpression[] = [];

    if (fromCoords) {
      L.marker([fromCoords[0], fromCoords[1]]).addTo(markersRef.current!);
      boundsPoints.push([fromCoords[0], fromCoords[1]]);
    }
    if (toCoords) {
      L.marker([toCoords[0], toCoords[1]]).addTo(markersRef.current!);
      boundsPoints.push([toCoords[0], toCoords[1]]);
    }
    if (driverCoords) {
      const icon = L.divIcon({
        html: `<div style="transform: rotate(${driverBearing}deg)">🚗</div>`,
        className: 'driver-icon',
      });
      L.marker([driverCoords[0], driverCoords[1]], { icon }).addTo(markersRef.current!);
      boundsPoints.push([driverCoords[0], driverCoords[1]]);
    }

    // Stable blue dotted line - no flicker
    setRouteLine(fromCoords && toCoords ? [fromCoords, toCoords] : null);

    if (fromCoords && toCoords) {
      fetch(
        `https://router.project-osrm.org/route/v1/driving/${fromCoords[1]},${fromCoords[0]};${toCoords[1]},${toCoords[0]}?overview=full&geometries=geojson`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.routes && data.routes[0] && mapRef.current) {
            blueRouteLineRef.current = L.geoJSON(data.routes[0].geometry, {
              style: {
                color: '#2563eb',
                weight: 6,
                opacity: 0.95,
              },
            }).addTo(mapRef.current);
          }
        })
        .catch(() => {});
    }

    if (fleetLayerRef.current) {
      fleetLayerRef.current.clearLayers();
      fleetDrivers.forEach((d: any) => {
        if (d.lat && d.lng) {
          const m = L.marker([d.lat, d.lng]);
          m.addTo(fleetLayerRef.current!);
          boundsPoints.push([d.lat, d.lng]);
        }
      });
    }

    if (boundsPoints.length >= 2) {
      const bounds = L.latLngBounds(boundsPoints);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 14);
    }
  }, [fromCoords, toCoords, driverCoords, driverBearing, driverSpeed, showBlueDotLine, fromLabel, toLabel, driverVehicleIcon, fleetDrivers]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border-2 border-slate-900 shadow-md ${className}`}>
      <div ref={mapContainerRef} style={{ height, width: '100%' }} />
      <div className="absolute top-2.5 left-2.5 z-[500] bg-slate-950/90 text-yellow-400 backdrop-blur-xs px-2.5 py-1 rounded-xl border border-yellow-400/40 text-xs">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block mr-1"></span>
        <span>ASSAM EASY TRIP MAP</span>
      </div>
      {showBlueDotLine && (fromCoords || toCoords) && (
        <div className="absolute bottom-2 left-2 z-[500] bg-white/90 px-2 py-1 rounded text-xs">Blue dotted = route</div>
      )}
    </div>
  );
}
