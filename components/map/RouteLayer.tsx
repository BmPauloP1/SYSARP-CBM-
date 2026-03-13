import React from 'react';
import { Polyline, Popup } from 'react-leaflet';

export interface Route {
  id: string;
  positions: [number, number][];
  type: 'patrulhamento' | 'deslocamento';
  name: string;
}

const ROUTE_COLORS: Record<Route['type'], string> = {
  patrulhamento: '#10b981', // emerald
  deslocamento: '#8b5cf6', // violet
};

interface RouteLayerProps {
  routes: Route[];
}

const RouteLayer: React.FC<RouteLayerProps> = ({ routes }) => {
  return (
    <>
      {routes.map((route) => (
        <Polyline
          key={route.id}
          positions={route.positions}
          pathOptions={{
            color: ROUTE_COLORS[route.type],
            weight: 4,
            dashArray: route.type === 'patrulhamento' ? '10, 10' : undefined,
          }}
        >
          <Popup>
            <div className="p-2">
              <h3 className="font-bold text-slate-900">{route.name}</h3>
              <p className="text-sm text-slate-600 capitalize">Tipo: {route.type}</p>
            </div>
          </Popup>
        </Polyline>
      ))}
    </>
  );
};

export default RouteLayer;
