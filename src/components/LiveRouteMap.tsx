import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { calcBearing } from '../services/storage';

interface Props {
  mapId: string;
  fromCoords?: [number, number] | null;
  toCoords?: [number, number] | null;
  fromLabel?: string;
  toLabel?: string;
  driverCoords?: [number, number] | null;
  driverBearing?: number;
  driverVehicleIcon?: string;
  driverName?: string;
  driverSpeed?: number;
  isDriverMoving?: boolean;
  onMapClick?: (coords: [number, number]) => void;
  className?: string;
  height?: string;
  showBlueDotLine?: boolean;
  centerCoords?: [number, number];
  zoom?: number;
  interactive?: boolean;
}

export const LiveRouteMap: React.FC<Props> = ({
  mapId,
  fromCoords,
  toCoords,
  fromLabel = 'Pickup',
  toLabel = 'Drop',
  driverCoords,
  driverBearing = 0,
  driverVehicleIcon = '🚗',
  driverName = 'Driver',
  driverSpeed = 0,
  isDriverMoving = false,
  onMapClick,
  className = '',
  height = '380px',
  showBlueDotLine = true,
  centerCoords = [26.6247, 93.6035], // Bokakhat default
  zoom = 13,
  interactive = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const fromMarkerRef = useRef<L.Marker | null>(null);
  const toMarkerRef = useRef<L.Marker | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const blueRouteLineRef = useRef<L.Layer | null>(null);
  const driverToPickupLineRef = useRef<L.Polyline | null>(null);
  const prevDriverCoordsRef = useRef<[number, number] | null>(null);
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up if instance already exists on this container
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const defaultCenter = centerCoords || [26.6247, 93.6035];
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: zoom,
      zoomControl: false,
      attributionControl: false,
    });

    // Add zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Reliable map tiles with NO API KEY required (Esri World Street Map)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '© Esri',
    }).addTo(map);

    if (interactive) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        if (onMapClickRef.current) {
          onMapClickRef.current([e.latlng.lat, e.latlng.lng]);
        }
      });
    }

    mapInstanceRef.current = map;

    // Handle container resize
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    setTimeout(() => {
      map.invalidateSize();
    }, 400);

    return () => {
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapId]);

  // Update Markers & Blue Dotted Route Line
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. From Marker (Pickup - Green)
    if (fromCoords && fromCoords[0] && fromCoords[1]) {
      const fromIcon = L.divIcon({
        className: 'custom-pickup-pin',
        html: `
          <div class="flex flex-col items-center -translate-x-1/2 -translate-y-full cursor-pointer">
            <div class="bg-slate-950 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow-md whitespace-nowrap border border-yellow-400 mb-1 flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>${fromLabel}</span>
            </div>
            <div class="w-8 h-8 rounded-full bg-emerald-500 border-3 border-white shadow-xl flex items-center justify-center text-white font-bold text-sm">
              📍
            </div>
            <div class="w-2 h-2 rounded-full bg-emerald-600 -mt-1"></div>
          </div>
        `,
        iconSize: [32, 42],
        iconAnchor: [16, 42],
      });

      if (!fromMarkerRef.current) {
        fromMarkerRef.current = L.marker(fromCoords, { icon: fromIcon }).addTo(map);
      } else {
        fromMarkerRef.current.setLatLng(fromCoords);
        fromMarkerRef.current.setIcon(fromIcon);
      }
    } else if (fromMarkerRef.current) {
      map.removeLayer(fromMarkerRef.current);
      fromMarkerRef.current = null;
    }

    // 2. To Marker (Drop - Red/Yellow)
    if (toCoords && toCoords[0] && toCoords[1]) {
      const toIcon = L.divIcon({
        className: 'custom-drop-pin',
        html: `
          <div class="flex flex-col items-center -translate-x-1/2 -translate-y-full cursor-pointer">
            <div class="bg-slate-950 text-yellow-400 text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow-md whitespace-nowrap border border-yellow-400 mb-1 flex items-center gap-1">
              <span>🏁 ${toLabel}</span>
            </div>
            <div class="w-8 h-8 rounded-full bg-rose-600 border-3 border-white shadow-xl flex items-center justify-center text-white font-bold text-sm">
              🎯
            </div>
            <div class="w-2 h-2 rounded-full bg-rose-700 -mt-1"></div>
          </div>
        `,
        iconSize: [32, 42],
        iconAnchor: [16, 42],
      });

      if (!toMarkerRef.current) {
        toMarkerRef.current = L.marker(toCoords, { icon: toIcon }).addTo(map);
      } else {
        toMarkerRef.current.setLatLng(toCoords);
        toMarkerRef.current.setIcon(toIcon);
      }
    } else if (toMarkerRef.current) {
      map.removeLayer(toMarkerRef.current);
      toMarkerRef.current = null;
    }

    // 3. Driver Live Marker (rotating vehicle)
    if (driverCoords && driverCoords[0] && driverCoords[1]) {
      let currentBearing = driverBearing;
      if (prevDriverCoordsRef.current) {
        const computed = calcBearing(
          prevDriverCoordsRef.current[0],
          prevDriverCoordsRef.current[1],
          driverCoords[0],
          driverCoords[1]
        );
        if (driverCoords[0] !== prevDriverCoordsRef.current[0] || driverCoords[1] !== prevDriverCoordsRef.current[1]) {
          currentBearing = computed;
        }
      }
      prevDriverCoordsRef.current = driverCoords;

      const driverIcon = L.divIcon({
        className: 'custom-driver-pin',
        html: `
          <div class="relative flex flex-col items-center -translate-x-1/2 -translate-y-1/2">
            ${
              driverSpeed > 0
                ? `<div class="absolute -top-7 bg-slate-900 text-yellow-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-yellow-400 whitespace-nowrap shadow-md">
                    ${Math.round(driverSpeed)} km/h
                   </div>`
                : ''
            }
            <div class="relative w-12 h-12 rounded-full bg-yellow-400 border-3 border-slate-950 shadow-2xl flex items-center justify-center pulse-live">
              <span class="text-2xl vehicle-marker" style="transform: rotate(${currentBearing}deg); display: inline-block;">
                ${driverVehicleIcon || '🚗'}
              </span>
            </div>
            <div class="bg-slate-950 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-yellow-400 shadow-sm mt-0.5 whitespace-nowrap">
              ${driverName || 'Driver Live'}
            </div>
          </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });

      if (!driverMarkerRef.current) {
        driverMarkerRef.current = L.marker(driverCoords, { icon: driverIcon, zIndexOffset: 1000 }).addTo(map);
      } else {
        driverMarkerRef.current.setLatLng(driverCoords);
        driverMarkerRef.current.setIcon(driverIcon);
      }
    } else if (driverMarkerRef.current) {
      map.removeLayer(driverMarkerRef.current);
      driverMarkerRef.current = null;
    }

    // 4. Blue Dotted Route Line between Pickup & Drop
    if (showBlueDotLine && fromCoords && toCoords && fromCoords[0] && toCoords[0]) {
      // Clean previous
      if (blueRouteLineRef.current) {
        map.removeLayer(blueRouteLineRef.current);
        blueRouteLineRef.current = null;
      }

      // Draw primary animated blue dotted line
      blueRouteLineRef.current = L.polyline([fromCoords, toCoords], {
        color: '#2563eb', // Vivid Blue
        weight: 6,
        opacity: 0.95,
        className: 'blue-dot-route', // SVG animation defined in index.css
      }).addTo(map);

      // Attempt high-accuracy road routing via OSRM if online
      fetch(
        `https://router.project-osrm.org/route/v1/driving/${fromCoords[1]},${fromCoords[0]};${toCoords[1]},${toCoords[0]}?overview=full&geometries=geojson`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data && data.routes && data.routes[0]) {
            if (blueRouteLineRef.current) {
              map.removeLayer(blueRouteLineRef.current);
            }
            blueRouteLineRef.current = L.geoJSON(data.routes[0].geometry, {
              style: {
                color: '#2563eb',
                weight: 6,
                opacity: 0.95,
                className: 'blue-dot-route',
              },
            }).addTo(map);
          }
        })
        .catch(() => {
          // Keep straight dotted line as fallback
        });
    } else if (blueRouteLineRef.current) {
      map.removeLayer(blueRouteLineRef.current);
      blueRouteLineRef.current = null;
    }

    // 5. Driver to Pickup connecting Blue Dotted Line (when driver is on the way)
    if (showBlueDotLine && driverCoords && fromCoords && driverCoords[0] && fromCoords[0]) {
      if (driverToPickupLineRef.current) {
        map.removeLayer(driverToPickupLineRef.current);
        driverToPickupLineRef.current = null;
      }

      driverToPickupLineRef.current = L.polyline([driverCoords, fromCoords], {
        color: '#0284c7', // Cyan/Sky blue for driver leg
        weight: 5,
        opacity: 0.9,
        dashArray: '4, 10',
        className: 'blue-dot-glow',
      }).addTo(map);
    } else if (driverToPickupLineRef.current) {
      map.removeLayer(driverToPickupLineRef.current);
      driverToPickupLineRef.current = null;
    }

    // Fit Bounds dynamically
    const boundsPoints: L.LatLngExpression[] = [];
    if (fromCoords && fromCoords[0]) boundsPoints.push(fromCoords);
    if (toCoords && toCoords[0]) boundsPoints.push(toCoords);
    if (driverCoords && driverCoords[0]) boundsPoints.push(driverCoords);

    if (boundsPoints.length >= 2) {
      const bounds = L.latLngBounds(boundsPoints);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 14);
    }
  }, [fromCoords, toCoords, driverCoords, driverBearing, driverSpeed, showBlueDotLine, fromLabel, toLabel, driverVehicleIcon]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border-2 border-slate-900 shadow-md ${className}`}>
      {/* Map Element */}
      <div ref={mapContainerRef} style={{ height, width: '100%' }} />

      {/* Easy Trip floating badge */}
      <div className="absolute top-2.5 left-2.5 z-[500] bg-slate-950/90 text-yellow-400 backdrop-blur-xs px-2.5 py-1 rounded-xl border border-yellow-400/40 text-[10px] font-extrabold flex items-center gap-1.5 shadow-lg">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
        <span>ASSAM EASY TRIP MAP</span>
      </div>

      {/* Blue Dotted Line legend indicator */}
      {showBlueDotLine && (fromCoords || toCoords) && (
        <div className="absolute bottom-2.5 left-2.5 z-[500] bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-300 text-[10px] font-bold text-slate-800 shadow-md flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
          </div>
          <span>Blue Dot Route Line</span>
        </div>
      )}
    </div>
  );
};
