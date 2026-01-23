
import React, { useEffect } from 'react';
import { useMap } from "react-leaflet";
import L from 'leaflet';
import "@geoman-io/leaflet-geoman-free";

interface SectorsLayerProps {
  onCreated?: (e: any) => void;
  onDeleted?: (e: any) => void;
  onEdited?: (e: any) => void;
}

export default function SectorsLayer({ onCreated, onDeleted, onEdited }: SectorsLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!map || !map.pm) return; // Correção Crítica

    // Configure Geoman (Leaflet-PM)
    map.pm.addControls({
      position: 'topright',
      drawCircle: true,
      drawCircleMarker: false,
      drawMarker: true,
      drawPolygon: true,
      drawPolyline: true,
      drawRectangle: true,
      drawText: false,
      cutPolygon: false,
      dragMode: false,
      rotateMode: false,
      editMode: false,
      removalMode: false,
    });

    // Set path options for drawing
    map.pm.setPathOptions({
      color: '#ef4444',
      fillColor: '#ef4444',
      fillOpacity: 0.2,
    });

    const handleCreate = (e: any) => {
      // If it's a circle, convert to polygon to ensure GeoJSON compatibility
      if (e.shape === 'Circle') {
         const poly = L.PM.Utils.circleToPolygon(e.layer, 60);
         e.layer = poly;
      }

      if (onCreated) {
        const typeMap: Record<string, string> = {
            'Marker': 'marker',
            'Line': 'polyline',
            'Polygon': 'polygon',
            'Rectangle': 'polygon',
            'Circle': 'polygon'
        };

        onCreated({
            layer: e.layer,
            layerType: typeMap[e.shape] || 'polygon'
        });
      }
      
      map.removeLayer(e.layer);
    };

    map.on('pm:create', handleCreate);

    return () => {
      if (map.pm) map.pm.removeControls();
      map.off('pm:create', handleCreate);
    };
  }, [map, onCreated, onDeleted, onEdited]);

  return null;
}
