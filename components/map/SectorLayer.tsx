import React from 'react';
import { Polygon, Popup } from 'react-leaflet';

export interface Sector {
  id: string;
  positions: [number, number][];
  type: 'setor' | 'risco' | 'busca';
  name: string;
}

const SECTOR_COLORS: Record<Sector['type'], string> = {
  setor: '#3b82f6', // blue
  risco: '#ef4444', // red
  busca: '#f59e0b', // amber
};

interface SectorLayerProps {
  sectors: Sector[];
}

const SectorLayer: React.FC<SectorLayerProps> = ({ sectors }) => {
  return (
    <>
      {sectors.map((sector) => (
        <Polygon
          key={sector.id}
          positions={sector.positions}
          pathOptions={{
            color: SECTOR_COLORS[sector.type],
            fillColor: SECTOR_COLORS[sector.type],
            fillOpacity: 0.3,
            weight: 3,
          }}
        >
          <Popup>
            <div className="p-2">
              <h3 className="font-bold text-slate-900">{sector.name}</h3>
              <p className="text-sm text-slate-600 capitalize">Tipo: {sector.type}</p>
            </div>
          </Popup>
        </Polygon>
      ))}
    </>
  );
};

export default SectorLayer;
