
import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from 'leaflet';

// Strategic Base Icon
const baseIcon = L.divIcon({
    className: 'custom-base-icon',
    html: `<div style="background-color: #b91c1c; width: 20px; height: 20px; border-radius: 4px; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 10px;">HQ</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});

interface StrategicMapOpProps {
    center?: [number, number];
    zoom?: number;
    operationId?: string;
}

export default function StrategicMapOp({ center = [-25.4, -49.3], zoom = 11 }: StrategicMapOpProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "100vh", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Strategic Elements - No Manipulation allowed */}
      
      {/* Operation Base / Command Post */}
      <Marker position={center} icon={baseIcon}>
        <Popup><strong>Posto de Comando (PC)</strong><br/>Coordenação Estratégica</Popup>
      </Marker>

      {/* General Area of Operation (Visualization Only) */}
      <Circle 
        center={center} 
        radius={2000} 
        pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.1, dashArray: '5, 10' }} 
      />

    </MapContainer>
  );
}
