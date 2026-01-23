
import React from 'react';
import { Marker, Popup } from "react-leaflet";
import L from 'leaflet';

// Tactical Icon
const tacticalIcon = L.divIcon({
  className: "tactical-drone-icon",
  html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

export default function DronesLayer({ operationId }: { operationId?: string }) {
  // Mock data - in production this would fetch from tactical_drones table filtered by operationId
  const drones = [
    { id: 't1', lat: -25.42, lng: -49.29, name: 'Alpha 1', status: 'Active' },
  ]; 

  return (
    <>
      {drones.map(drone => (
        <Marker key={drone.id} position={[drone.lat, drone.lng]} icon={tacticalIcon}>
          <Popup>
            <div className="text-xs">
                <strong>{drone.name}</strong><br />
                Status: {drone.status}<br/>
                <span className="text-slate-500">Tactical Command</span>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
