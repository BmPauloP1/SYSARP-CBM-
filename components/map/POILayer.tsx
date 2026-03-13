import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

export interface POI {
  id: string;
  lat: number;
  lng: number;
  type: 'viatura' | 'solo' | 'k9' | 'vestigios' | 'risco' | 'comando';
  name: string;
}

export const POI_ICONS: Record<POI['type'], string> = {
  viatura: '🚓',
  solo: '👮',
  k9: '🐕',
  vestigios: '🔬',
  risco: '⚠️',
  comando: '🏢',
};

export const createPoiIcon = (type: POI['type']) => {
  return L.divIcon({
    html: `<div style="font-size: 24px; display: flex; align-items: center; justify-content: center; background: white; border-radius: 50%; width: 40px; height: 40px; border: 2px solid #1e293b; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${POI_ICONS[type]}</div>`,
    className: 'custom-poi-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

interface POILayerProps {
  pois: POI[];
}

const POILayer: React.FC<POILayerProps> = ({ pois }) => {
  return (
    <>
      {pois.map((poi) => (
        <Marker
          key={poi.id}
          position={[poi.lat, poi.lng]}
          icon={createPoiIcon(poi.type)}
        >
          <Popup>
            <div className="p-2">
              <h3 className="font-bold text-slate-900 capitalize">{poi.type.replace('_', ' ')}</h3>
              <p className="text-sm text-slate-600">{poi.name || 'Sem nome'}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
};

export default POILayer;
