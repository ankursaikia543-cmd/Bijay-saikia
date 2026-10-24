import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { calcBearing } from '../services/storage';
import { Driver } from '../types';

export const getVehicleSymbol = (vtype?: string): string => {
  if (!vtype) return '🚗';
  const v = vtype.toLowerCase();
  if (v.includes('scooty') || v.includes('scooter')) return '🛵';
  if (v.includes('bike') || v.includes('moto') || v.includes('motorcycle') || v.includes('two')) return '🏍️';
  if (v.includes('auto') || v.includes('rickshaw') || v.includes('toto') || v.includes('tempo')) return '🛺';
  if (v.includes('suv') || v.includes('van') || v.includes('bolero') || v.includes('innova')) return '🚐';
  if (v.includes('sedan') || v.includes('dzire') || v.includes('etios')) return '🚙';
  return '🚗';
};

export type MapLayerType = 'esri' | 'googleRoads' | 'googleSatellite';

export interface LiveRouteMapProps {
  mapId?: string;
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
  fleetDrivers?: Driver[] | any[];
  onMapClick?: (coords: [number, number]) => void;
  className?: string;
  height?: string;
  showBlueDotLine?: boolean;
  centerCoords?: [number, number];
  zoom?: number;
  interactive?: boolean;
}

export const LiveRouteMap: React.FC<LiveRouteMapProps> = ({
  mapId = 'live-map',
  fromCoords,
  toCoords,
  fromLabel = 'Pickup',
  toLabel = 'Drop',
  driverCoords,
  driverBearing = 0,
  driverVehicleIcon = '🚗',
  driverName = 'Driver',
  driverSpeed = 0,
  fleetDrivers,
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
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);

  const fromMarkerRef = useRef<L.Marker | null>(null);
  const toMarkerRef = useRef<L.Marker | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const blueRouteLineRef = useRef<L.Layer | null>(null);
  const driverToPickupLineRef = useRef<L.Polyline | null>(null);
  const prevDriverCoordsRef = useRef<[number, number] | null>(null);
  const prevRouteKeyRef = useRef<string>('');
  const prevBoundsKeyRef = useRef<string>('');
  const fleetLayerRef = useRef<L.LayerGroup | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const resizeTimeoutRef = useRef<any>(null);

  // Active Map Layer type: 'esri' = original Agor Map (default)
  const [activeLayer, setActiveLayer] = useState<MapLayerType>('esri');

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // Construct TileLayer based on layer type
  const createTileLayer = (layerType: MapLayerType): L.TileLayer => {
    if (layerType === 'googleRoads') {
      return L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '© Google Maps',
      });
    }

    if (layerType === 'googleSatellite') {
      return L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '© Google Maps Satellite',
      });
    }

    // Default: Esri World Street Map (High reliability, clear roads, never blocked)
    return L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: '© Esri & Contributors',
      }
    );
  };

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up prior instance if container changed or remounted
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (e) {}
      mapInstanceRef.current = null;
    }

    // Leaflet safety: remove existing _leaflet_id to avoid container already initialized errors
    if ((mapContainerRef.current as any)._leaflet_id) {
      delete (mapContainerRef.current as any)._leaflet_id;
    }

    const defaultCenter = centerCoords || [26.6247, 93.6035];
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: zoom,
      zoomControl: false,
      attributionControl: false,
      fadeAnimation: false,
      zoomAnimation: true,
    });

    // Add zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Apply primary tile layer
    const initialTile = createTileLayer(activeLayer);
    initialTile.addTo(map);
    currentTileLayerRef.current = initialTile;

    if (interactive) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        if (onMapClickRef.current) {
          onMapClickRef.current([e.latlng.lat, e.latlng.lng]);
        }
      });
    }

    mapInstanceRef.current = map;

    // Trigger multiple invalidateSize passes to guarantee zero blank areas even on slow renders
    const invalidate = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ pan: false });
      }
    };

    const timers = [
      setTimeout(invalidate, 50),
      setTimeout(invalidate, 150),
      setTimeout(invalidate, 300),
      setTimeout(invalidate, 600),
      setTimeout(invalidate, 1200),
    ];

    // Handle container resize safely
    let lastWidth = mapContainerRef.current.clientWidth;
    let lastHeight = mapContainerRef.current.clientHeight;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (Math.abs(width - lastWidth) > 8 || Math.abs(height - lastHeight) > 8) {
          lastWidth = width;
          lastHeight = height;
          if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
          resizeTimeoutRef.current = setTimeout(invalidate, 120);
        }
      }
    });

    resizeObserver.observe(mapContainerRef.current);
    window.addEventListener('resize', invalidate);

    return () => {
      timers.forEach(clearTimeout);
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      resizeObserver.disconnect();
      window.removeEventListener('resize', invalidate);
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {}
        mapInstanceRef.current = null;
      }
    };
  }, [mapId]);

  // 2. Switch Base Layer dynamically
  const handleSwitchLayer = (type: MapLayerType) => {
    setActiveLayer(type);
    const map = mapInstanceRef.current;
    if (!map) return;

    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
    }
    const newLayer = createTileLayer(type);
    newLayer.addTo(map);
    currentTileLayerRef.current = newLayer;

    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ pan: false });
      }
    }, 50);
  };

  // 3. Update Pickup, Drop, Driver Markers & Animated Route Line
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Pickup Marker (Green)
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

    // 2. Drop Marker (Red/Target)
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

    // 3. Driver Live Marker with exact vehicle icon/logo (Bike: 🏍️, Scooty: 🛵, Auto: 🛺, Car: 🚗, etc.)
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

      const vehicleLogo = getVehicleSymbol(driverVehicleIcon);

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
            <div class="relative w-12 h-12 rounded-full bg-yellow-400 border-3 border-slate-950 shadow-2xl flex items-center justify-center">
              <span class="text-2xl vehicle-marker" style="transform: rotate(${currentBearing}deg); display: inline-block;">
                ${vehicleLogo}
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

    // 4. Blue Route Line between Pickup & Drop
    const currentRouteKey = `${fromCoords?.[0]?.toFixed(4)}_${fromCoords?.[1]?.toFixed(4)}_${toCoords?.[0]?.toFixed(4)}_${toCoords?.[1]?.toFixed(4)}`;
    if (showBlueDotLine && fromCoords && toCoords && fromCoords[0] && toCoords[0]) {
      if (prevRouteKeyRef.current !== currentRouteKey) {
        prevRouteKeyRef.current = currentRouteKey;

        if (blueRouteLineRef.current) {
          map.removeLayer(blueRouteLineRef.current);
          blueRouteLineRef.current = null;
        }

        // Draw primary animated blue dotted line
        blueRouteLineRef.current = L.polyline([fromCoords, toCoords], {
          color: '#2563eb',
          weight: 6,
          opacity: 0.95,
          className: 'blue-dot-route',
        }).addTo(map);

        // Fetch high-accuracy road routing via OSRM
        fetch(
          `https://router.project-osrm.org/route/v1/driving/${fromCoords[1]},${fromCoords[0]};${toCoords[1]},${toCoords[0]}?overview=full&geometries=geojson`
        )
          .then((res) => res.json())
          .then((data) => {
            if (data && data.routes && data.routes[0] && mapInstanceRef.current) {
              if (blueRouteLineRef.current) {
                mapInstanceRef.current.removeLayer(blueRouteLineRef.current);
              }
              blueRouteLineRef.current = L.geoJSON(data.routes[0].geometry, {
                style: {
                  color: '#2563eb',
                  weight: 6,
                  opacity: 0.95,
                  className: 'blue-dot-route',
                },
              }).addTo(mapInstanceRef.current);
            }
          })
          .catch(() => {});
      }
    } else {
      prevRouteKeyRef.current = '';
      if (blueRouteLineRef.current) {
        map.removeLayer(blueRouteLineRef.current);
        blueRouteLineRef.current = null;
      }
    }

    // 5. Driver to Pickup connecting Blue Line
    if (showBlueDotLine && driverCoords && fromCoords && driverCoords[0] && fromCoords[0]) {
      if (!driverToPickupLineRef.current) {
        driverToPickupLineRef.current = L.polyline([driverCoords, fromCoords], {
          color: '#0284c7',
          weight: 5,
          opacity: 0.9,
          dashArray: '4, 10',
          className: 'blue-dot-glow',
        }).addTo(map);
      } else {
        driverToPickupLineRef.current.setLatLngs([driverCoords, fromCoords]);
      }
    } else if (driverToPickupLineRef.current) {
      map.removeLayer(driverToPickupLineRef.current);
      driverToPickupLineRef.current = null;
    }

    // 6. Fleet Drivers Layer (Admin Portal)
    if (fleetDrivers && fleetDrivers.length > 0) {
      if (!fleetLayerRef.current) {
        fleetLayerRef.current = L.layerGroup().addTo(map);
      } else {
        fleetLayerRef.current.clearLayers();
      }

      fleetDrivers.forEach((d) => {
        const dLat = Number(d.lat || 26.6247);
        const dLng = Number(d.lng || 93.6035);
        if (isNaN(dLat) || isNaN(dLng)) return;

        const isDuty = d.isOnDuty !== false;
        const iconSymbol = getVehicleSymbol(d.vtype);
        const iconHtml = `
          <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -50%); cursor:pointer;">
            <div style="background:${isDuty ? '#10b981' : '#64748b'}; color:#ffffff; border:2px solid #0f172a; border-radius:18px; padding:3px 8px; font-size:11px; font-weight:800; display:flex; align-items:center; gap:4px; box-shadow:0 3px 8px rgba(0,0,0,0.35); white-space:nowrap;">
              <span>${iconSymbol}</span>
              <span>${d.name}</span>
            </div>
            <div style="width:0; height:0; border-left:5px solid transparent; border-right:5px solid transparent; border-top:6px solid #0f172a; margin-top:-1px;"></div>
          </div>
        `;

        const fleetIcon = L.divIcon({
          className: 'fleet-driver-pin',
          html: iconHtml,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([dLat, dLng], { icon: fleetIcon });
        marker.bindPopup(`
          <div style="font-family:sans-serif; min-width:140px; font-size:12px; color:#0f172a;">
            <strong style="font-size:13px; color:#0f172a;">${d.name}</strong> (${d.vtype})<br/>
            <span>🚗 ${d.vehno}</span><br/>
            <span>📍 ${d.loc}</span><br/>
            <span>📞 <a href="tel:${d.phone}" style="color:#2563eb; font-weight:bold;">${d.phone}</a></span><br/>
            <span style="font-weight:bold; color:${isDuty ? '#16a34a' : '#dc2626'};">${isDuty ? '🟢 On Duty' : '🔴 Off Duty'}</span>
          </div>
        `);
        marker.addTo(fleetLayerRef.current!);
      });
    } else if (fleetLayerRef.current) {
      fleetLayerRef.current.clearLayers();
    }

    // 7. Dynamic Bounds Fitting
    const boundsKey = `${fromCoords?.[0]?.toFixed(3)}_${fromCoords?.[1]?.toFixed(3)}_${toCoords?.[0]?.toFixed(3)}_${toCoords?.[1]?.toFixed(3)}`;
    if (boundsKey !== prevBoundsKeyRef.current) {
      prevBoundsKeyRef.current = boundsKey;

      const boundsPoints: L.LatLngExpression[] = [];
      if (fromCoords && fromCoords[0]) boundsPoints.push(fromCoords);
      if (toCoords && toCoords[0]) boundsPoints.push(toCoords);

      if (boundsPoints.length >= 2) {
        const bounds = L.latLngBounds(boundsPoints);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      } else if (boundsPoints.length === 1) {
        map.panTo(boundsPoints[0], { animate: true });
      }
    }
  }, [fromCoords, toCoords, driverCoords, driverBearing, driverSpeed, showBlueDotLine, fromLabel, toLabel, driverVehicleIcon, fleetDrivers]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border-2 border-slate-900 shadow-md ${className}`}>
      {/* Map Canvas */}
      <div
        id={mapId}
        ref={mapContainerRef}
        style={{ height, minHeight: height, width: '100%', backgroundColor: '#cbd5e1' }}
      />

      {/* Floating Header Badge */}
      <div className="absolute top-2.5 left-2.5 z-[500] bg-slate-950/90 text-yellow-400 backdrop-blur-xs px-2.5 py-1 rounded-xl border border-yellow-400/40 text-[10px] font-extrabold flex items-center gap-1.5 shadow-lg">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
        <span>যাত্ৰা (YATRA) MAP</span>
      </div>

      {/* Quick Map Layer Switcher */}
      <div className="absolute top-2.5 right-2.5 z-[500] flex items-center gap-1 bg-slate-950/90 backdrop-blur-xs p-1 rounded-xl border border-slate-700 shadow-lg text-[10px] font-bold">
        <button
          type="button"
          onClick={() => handleSwitchLayer('esri')}
          title="Agor Map (Esri World Street Map - Clear Roads & Town Names)"
          className={`px-2 py-0.5 rounded-lg transition ${
            activeLayer === 'esri'
              ? 'bg-yellow-400 text-slate-950 font-black shadow'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          🗺️ পুৰণি মেপ
        </button>
        <button
          type="button"
          onClick={() => handleSwitchLayer('googleRoads')}
          title="Google Roads & Village/Gaon Names"
          className={`px-2 py-0.5 rounded-lg transition ${
            activeLayer === 'googleRoads'
              ? 'bg-yellow-400 text-slate-950 font-black shadow'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          🛣️ গাওঁ/ৰাস্তা
        </button>
        <button
          type="button"
          onClick={() => handleSwitchLayer('googleSatellite')}
          title="Google Satellite Hybrid"
          className={`px-2 py-0.5 rounded-lg transition ${
            activeLayer === 'googleSatellite'
              ? 'bg-yellow-400 text-slate-950 font-black shadow'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          🛰️ চেটেলাইট
        </button>
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

export default LiveRouteMap;
