
import React from 'react';
import { MapContainer, TileLayer } from "react-leaflet";
import SectorsLayer from "./tactical/SectorsLayer";
import DronesLayer from "./tactical/DronesLayer";

interface TacticalMapOpProps {
    center?: [number, number];
    zoom?: number;
    operationId?: string;
}

export default function TacticalMapOp({ center = [-25.42, -49.29], zoom = 15, operationId }: TacticalMapOpProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "100vh", width: "100%" }}
    >
      {/* Darker map for tactical contrast */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />

      <SectorsLayer />
      <DronesLayer operationId={operationId} />
    </MapContainer>
  );
}
