import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { HealthcareFacility } from '../types';
import { calculateDistanceKm, formatCoordinates } from '../utils/geoUtils';

interface EmergencyMapProps {
  patientLocation: { latitude: number; longitude: number; label?: string };
  workerLocation?: { latitude: number; longitude: number; label?: string } | null;
  facilities: HealthcareFacility[];
  selectedFacilityId?: string | null;
  searchRadiusKm: number;
  onSelectFacility?: (facility: HealthcareFacility) => void;
}

export const EmergencyMap: React.FC<EmergencyMapProps> = ({
  patientLocation,
  workerLocation,
  facilities,
  selectedFacilityId,
  searchRadiusKm,
  onSelectFacility,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const circleLayerRef = useRef<L.Circle | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [patientLocation.latitude, patientLocation.longitude],
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers & Search Radius Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    if (circleLayerRef.current) {
      circleLayerRef.current.remove();
      circleLayerRef.current = null;
    }

    const bounds = L.latLngBounds([[patientLocation.latitude, patientLocation.longitude]]);

    // 1. Search Radius Circle
    const radiusCircle = L.circle([patientLocation.latitude, patientLocation.longitude], {
      radius: searchRadiusKm * 1000,
      color: '#FF6B6B',
      fillColor: '#FF6B6B',
      fillOpacity: 0.08,
      weight: 2,
      dashArray: '5, 8',
    }).addTo(map);
    circleLayerRef.current = radiusCircle;

    // 2. Patient Location Pin (Red Neo-Brutalist Pin)
    const patientIcon = L.divIcon({
      className: 'custom-patient-marker',
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          <div style="
            background: #FF6B6B;
            color: #111111;
            font-weight: 900;
            font-size: 11px;
            font-family: sans-serif;
            padding: 3px 7px;
            border: 2px solid #111111;
            border-radius: 6px;
            box-shadow: 2px 2px 0px #111111;
            white-space: nowrap;
          ">
            🚨 PATIENT LOCATION
          </div>
          <div style="
            width: 14px;
            height: 14px;
            background: #FF6B6B;
            border: 2px solid #111111;
            border-radius: 50%;
            margin-top: 2px;
            box-shadow: 1px 1px 0px #111111;
          "></div>
        </div>
      `,
      iconSize: [120, 42],
      iconAnchor: [60, 42],
    });

    const patientMarker = L.marker([patientLocation.latitude, patientLocation.longitude], {
      icon: patientIcon,
      zIndexOffset: 1000,
    }).addTo(markersLayerRef.current);

    patientMarker.bindPopup(`
      <div style="font-family: 'Space Grotesk', Inter, sans-serif; padding: 4px;">
        <h4 style="margin: 0 0 4px; font-weight: 900; font-size: 14px; color: #111111;">
          🚨 Emergency Incident Point
        </h4>
        <p style="margin: 0; font-size: 12px; font-weight: 700; color: #4A4A4A;">
          ${patientLocation.label || 'Patient GPS Location'}
        </p>
        <p style="margin: 4px 0 0; font-size: 11px; color: #6E6E6E;">
          ${formatCoordinates(patientLocation.latitude, patientLocation.longitude)}
        </p>
      </div>
    `);

    // 3. ASHA Worker Pin (Teal Neo-Brutalist Pin, if different location)
    if (
      workerLocation &&
      (Math.abs(workerLocation.latitude - patientLocation.latitude) > 0.0002 ||
        Math.abs(workerLocation.longitude - patientLocation.longitude) > 0.0002)
    ) {
      bounds.extend([workerLocation.latitude, workerLocation.longitude]);

      const workerIcon = L.divIcon({
        className: 'custom-worker-marker',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            <div style="
              background: #FFC900;
              color: #111111;
              font-weight: 900;
              font-size: 11px;
              font-family: sans-serif;
              padding: 3px 6px;
              border: 2px solid #111111;
              border-radius: 6px;
              box-shadow: 2px 2px 0px #111111;
              white-space: nowrap;
            ">
              👩‍⚕️ ASHA WORKER
            </div>
            <div style="
              width: 12px;
              height: 12px;
              background: #008F83;
              border: 2px solid #111111;
              border-radius: 50%;
              margin-top: 2px;
            "></div>
          </div>
        `,
        iconSize: [110, 40],
        iconAnchor: [55, 40],
      });

      const workerMarker = L.marker([workerLocation.latitude, workerLocation.longitude], {
        icon: workerIcon,
        zIndexOffset: 900,
      }).addTo(markersLayerRef.current);

      workerMarker.bindPopup(`
        <div style="font-family: 'Space Grotesk', Inter, sans-serif; padding: 4px;">
          <h4 style="margin: 0 0 4px; font-weight: 900; font-size: 13px; color: #111111;">
            👩‍⚕️ ASHA Worker Current Position
          </h4>
          <p style="margin: 0; font-size: 11px; color: #4A4A4A;">
            ${formatCoordinates(workerLocation.latitude, workerLocation.longitude)}
          </p>
        </div>
      `);
    }

    // 4. Healthcare Facilities Pins
    facilities.forEach((fac) => {
      const dist = calculateDistanceKm(
        patientLocation.latitude,
        patientLocation.longitude,
        fac.latitude,
        fac.longitude
      );

      // Only plot if within selected radius
      if (dist <= searchRadiusKm) {
        bounds.extend([fac.latitude, fac.longitude]);

        const isSelected = fac.id === selectedFacilityId;
        const bgColor =
          fac.type === 'DH'
            ? '#FF6B6B'
            : fac.type === 'CHC'
            ? '#FFC900'
            : fac.type === 'PHC'
            ? '#008F83'
            : '#845EC2';

        const textColor = fac.type === 'PHC' ? '#FFFFFF' : '#111111';

        const facIcon = L.divIcon({
          className: 'custom-facility-marker',
          html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
              <div style="
                background: ${bgColor};
                color: ${textColor};
                font-weight: 900;
                font-size: 10px;
                font-family: sans-serif;
                padding: 2.5px 6px;
                border: ${isSelected ? '3px solid #111111' : '2px solid #111111'};
                border-radius: 6px;
                box-shadow: ${isSelected ? '3.5px 3.5px 0px #111111' : '2px 2px 0px #111111'};
                white-space: nowrap;
                transform: ${isSelected ? 'scale(1.1)' : 'scale(1)'};
              ">
                🏥 ${fac.type} • ${dist} km
              </div>
              <div style="
                width: 10px;
                height: 10px;
                background: ${bgColor};
                border: 2px solid #111111;
                border-radius: 50%;
                margin-top: 1px;
              "></div>
            </div>
          `,
          iconSize: [95, 36],
          iconAnchor: [47, 36],
        });

        const marker = L.marker([fac.latitude, fac.longitude], {
          icon: facIcon,
          zIndexOffset: isSelected ? 800 : 500,
        }).addTo(markersLayerRef.current!);

        const popupContent = document.createElement('div');
        popupContent.style.fontFamily = "'Space Grotesk', Inter, sans-serif";
        popupContent.style.padding = '4px';
        popupContent.innerHTML = `
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="background: ${bgColor}; color: ${textColor}; font-size: 10px; font-weight: 900; padding: 2px 6px; border: 1.5px solid #111111; border-radius: 4px;">
              ${fac.typeName}
            </span>
            <span style="font-size: 10px; font-weight: 800; color: #4A4A4A;">
              ${fac.facilityCode}
            </span>
          </div>
          <h4 style="margin: 0 0 4px; font-size: 14px; font-weight: 900; color: #111111; line-height: 1.2;">
            ${fac.name}
          </h4>
          <p style="margin: 0 0 6px; font-size: 11px; color: #4A4A4A;">
            📍 ${fac.address}
          </p>
          <div style="display: flex; items-center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 800; color: #111111;">
              ⚡ Distance: <strong>${dist} km</strong>
            </span>
            <span style="font-size: 11px; font-weight: 800; color: #008F83;">
              ${fac.emergencyAvailable24x7 ? '✓ 24x7 Emergency' : ''}
            </span>
          </div>
          <div style="display: flex; gap: 6px;">
            <a href="tel:${fac.phone}" style="
              flex: 1;
              text-align: center;
              padding: 5px 8px;
              background: #FFC900;
              color: #111111;
              font-weight: 900;
              font-size: 11px;
              text-decoration: none;
              border: 1.5px solid #111111;
              border-radius: 5px;
              box-shadow: 1.5px 1.5px 0px #111111;
            ">
              📞 Call (${fac.phone})
            </a>
            <button id="select-fac-btn-${fac.id}" style="
              flex: 1;
              padding: 5px 8px;
              background: #008F83;
              color: #FFFFFF;
              font-weight: 900;
              font-size: 11px;
              border: 1.5px solid #111111;
              border-radius: 5px;
              box-shadow: 1.5px 1.5px 0px #111111;
              cursor: pointer;
            ">
              ✓ Select Target
            </button>
          </div>
        `;

        marker.bindPopup(popupContent);

        marker.on('popupopen', () => {
          const btn = document.getElementById(`select-fac-btn-${fac.id}`);
          if (btn && onSelectFacility) {
            btn.onclick = () => {
              onSelectFacility(fac);
              marker.closePopup();
            };
          }
        });
      }
    });

    // Fit map bounds to view all markers within search radius comfortably
    try {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } catch {
      map.setView([patientLocation.latitude, patientLocation.longitude], 12);
    }
  }, [patientLocation, workerLocation, facilities, selectedFacilityId, searchRadiusKm, onSelectFacility]);

  return (
    <div className="w-full relative border-2 border-black rounded-xl overflow-hidden shadow-brutal bg-white">
      {/* Map Header Indicator */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-cream border-b-2 border-black text-xs font-bold text-black">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-danger animate-ping" />
          <span className="font-black font-heading uppercase text-[11px] tracking-wide">
            Live GPS Emergency Radius Map ({searchRadiusKm} km)
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-neutral-600">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-danger border border-black" />
            <span className="font-bold">Patient</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-teal border border-black" />
            <span className="font-bold">Govt PHC</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow border border-black" />
            <span className="font-bold">Govt CHC</span>
          </span>
        </div>
      </div>

      {/* Leaflet Container */}
      <div ref={mapContainerRef} className="w-full h-[320px] sm:h-[380px] z-10" />
    </div>
  );
};
