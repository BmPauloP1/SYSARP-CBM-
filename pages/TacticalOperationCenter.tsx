import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../leaflet-setup';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, useMap, useMapEvents, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { PreFlightChecklist } from '../components/PreFlightChecklist';
import html2canvas from 'html2canvas'; 
import { base44 } from '../services/base44Client';
import { tacticalService, TacticalSector, TacticalDrone, TacticalPOI, TacticalKmlLayer } from '../services/tacticalService';
import { searchPlanningService, TerrainType, ExperienceLevel, BackpackStatus } from '../services/searchPlanningService';
import { Operation, Drone, Pilot, MISSION_COLORS } from '../types';
import { Card, Button, Input, Select, Badge } from '../components/ui_components';
import { 
  ArrowLeft, Plus, Trash2, Hexagon, Flag, 
  MapPin, Settings, X, Navigation,
  Video, ChevronRight, Globe, Camera, 
  Users, Truck, Dog, Heart, AlertTriangle, 
  Layers, Satellite, Activity, LocateFixed, Loader2,
  FileUp, Ruler, Maximize2, Move, Shield, Save, Database, Copy, Eye, EyeOff, UploadCloud, FileType, CheckCircle
} from 'lucide-react';
import SectorsLayer from '../components/maps/tactical/SectorsLayer';
import TacticalDrawControls from '../components/map/TacticalDrawControls';
import OperationDailyLog from '../components/OperationDailyLog';

// NATO Phonetic Alphabet for naming sectors
const PHONETIC = [
  'ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL',
  'INDIA', 'JULIETT', 'KILO', 'LIMA', 'MIKE', 'NOVEMBER', 'OSCAR', 'PAPA',
  'QUEBEC', 'ROMEO', 'SIERRA', 'TANGO', 'UNIFORM', 'VICTOR', 'WHISKEY',
  'X-RAY', 'YANKEE', 'ZULU'
];

// Paleta de Cores Táticas para Vetores e Setores
const TACTICAL_PALETTE = [
  '#2563eb', // Blue
  '#059669', // Emerald
  '#7c3aed', // Violet
  '#ea580c', // Orange
  '#db2777', // Pink
  '#0891b2', // Cyan
  '#b91c1c', // Red
  '#4b5563'  // Gray
];

const extractVideoData = (url: string) => {
  if (!url) return null;
  const liveMatch = url.match(/youtube\.com\/live\/([^?&/]{11})/);
  if (liveMatch) return `https://www.youtube.com/embed/${liveMatch[1]}?autoplay=1&rel=0`;
  const youtubeMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  if (youtubeMatch) return `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1&rel=0`;
  return url; 
};

// Parser básico de KML para GeoJSON (Suporta Point, LineString, Polygon)
const parseKmlToGeoJson = (kmlText: string) => {
    try {
        const parser = new DOMParser();
        const xml = parser.parseFromString(kmlText, "text/xml");
        const features: any[] = [];

        const extractCoords = (coordStr: string) => {
            return coordStr.trim().split(/\s+/).map(pair => {
                const [lng, lat] = pair.split(',').map(Number);
                return [lng, lat];
            });
        };

        // Polygons
        const polygons = xml.getElementsByTagName("Polygon");
        for (let i = 0; i < polygons.length; i++) {
            const coords = polygons[i].getElementsByTagName("coordinates")[0]?.textContent;
            if (coords) {
                features.push({
                    type: "Feature",
                    geometry: { type: "Polygon", coordinates: [extractCoords(coords)] },
                    properties: { name: "Área KML" }
                });
            }
        }

        // LineStrings
        const lines = xml.getElementsByTagName("LineString");
        for (let i = 0; i < lines.length; i++) {
            const coords = lines[i].getElementsByTagName("coordinates")[0]?.textContent;
            if (coords) {
                features.push({
                    type: "Feature",
                    geometry: { type: "LineString", coordinates: extractCoords(coords) },
                    properties: { name: "Linha KML" }
                });
            }
        }

        if (features.length === 0) return null;
        return { type: "FeatureCollection", features };
    } catch (e) {
        console.error("KML Parse Error:", e);
        return null;
    }
};

const MapResizer = () => {
    const map = useMap();
    useEffect(() => {
        const timer = setTimeout(() => { map.invalidateSize(); }, 500);
        return () => clearTimeout(timer);
    }, [map]);
    return null;
};

const MapEvents = ({ onMapClick }: { onMapClick: (e: any) => void }) => {
    useMapEvents({
        click: onMapClick
    });
    return null;
};

const calculatePolygonArea = (coordinates: any) => {
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) return 0;
    try {
        const coords = L.GeoJSON.coordsToLatLngs(coordinates, 1);
        if (!coords || !Array.isArray(coords) || coords.length === 0) return 0;
        const latLngs = coords[0] as L.LatLng[];
        if (!latLngs || !Array.isArray(latLngs) || latLngs.length < 3) return 0;
        let area = 0; const radius = 6378137;
        for (let i = 0; i < latLngs.length; i++) {
            const p1 = latLngs[i]; const p2 = latLngs[(i + 1) % latLngs.length];
            area += (p2.lng - p1.lng) * Math.PI / 180 * (2 + Math.sin(p1.lat * Math.PI / 180) + Math.sin(p2.lat * Math.PI / 180));
        }
        return Math.abs(area * radius * radius / 2.0);
    } catch (e) { return 0; }
};

const formatArea = (m2: number) => {
    if (m2 >= 10000) return `${(m2 / 10000).toFixed(2)} ha`;
    return `${Math.round(m2).toLocaleString('pt-BR')} m²`;
};

const getDroneIcon = (color: string, hasStream?: boolean) => {
    return L.divIcon({
        className: 'drone-marker-custom',
        html: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; cursor: grab;">
                ${hasStream ? `
                <div style="position: absolute; inset: 0; background: rgba(239, 68, 68, 0.4); border-radius: 50%; animate: pulse 1.5s infinite;" class="animate-pulse"></div>
                <div style="position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; font-size: 7px; font-weight: 900; padding: 1px 4px; border-radius: 4px; border: 1.5px solid white; z-index: 50;">LIVE</div>
                ` : ''}
                <div style="background-color: ${color}; width: 32px; height: 32px; border: 3px solid white; border-radius: 8px; transform: rotate(45deg); box-shadow: 0 6px 12px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="width: 20px; height: 20px; transform: rotate(-45deg);">
                        <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
                        <circle cx="4.5" cy="9" r="2" /><circle cx="19.5" cy="9" r="2" />
                        <circle cx="4.5" cy="15" r="2" /><circle cx="19.5" cy="15" r="2" />
                    </svg>
                </div>
            </div>
        `,
        iconSize: [42, 42],
        iconAnchor: [21, 21]
    });
};

const getPoiIcon = (type: string, hasStream?: boolean) => {
    let color = '#64748b'; let iconSvg = '';
    switch(type) {
        case 'base': color = '#b91c1c'; iconSvg = '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'; break;
        case 'victim': color = '#ef4444'; iconSvg = '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'; break;
        case 'hazard': color = '#f59e0b'; iconSvg = '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'; break;
        case 'ground_team': color = '#2563eb'; iconSvg = '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'; break;
        case 'vehicle': color = '#dc2626'; iconSvg = '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M9 18h6"/><path d="M19 18h2a1 1 0 0 0 1-1v-5l-3-4h-5"/>'; break;
        case 'k9': color = '#78350f'; iconSvg = '<path d="M10 5.172l.596.596a2 2 0 0 0 2.828 0L14 5.172M20 21l-2-6M6 21l2-6M12 21v-6M4 4l3 3M20 4l-3 3M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z"/>'; break;
        case 'command_post': color = '#1e40af'; iconSvg = '<path d="M15 6l-4 4l-4-4"/><path d="M11 10v11"/><path d="M21 10h-6"/><path d="M3 10h6"/><path d="M21 19h-6"/><path d="M3 19h6"/>'; break;
        case 'evidence': color = '#4a044e'; iconSvg = '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'; break;
        case 'footprints': color = '#57534e'; iconSvg = '<path d="M4 16.85V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.15"/><path d="M8.63 13.51a2 2 0 0 1-.26 3.01L8 16.85"/><path d="M15.63 13.51a2 2 0 0 0-.26 3.01L15 16.85"/><path d="M12 3a7.49 7.49 0 0 0-6 6c0 2.5.83 4.5 2.13 5.68a2 2 0 0 1 2.62 0L12 15.5l1.25-.82a2 2 0 0 1 2.62 0C17.17 13.5 18 11.5 18 9a7.49 7.49 0 0 0-6-6"/>'; break;
        case 'obstacle': color = '#7f1d1d'; iconSvg = '<path d="M18 6L6 18"/><path d="M6 6l12 12"/>'; break;
        default: iconSvg = '<circle cx="12" cy="12" r="10"/>';
    }
    return L.divIcon({ 
        className: 'custom-poi-marker', 
        html: `<div style="position: relative; background-color: ${color}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.4); border: 2px solid white;">${hasStream ? `<div style="position: absolute; top: -8px; background: #ef4444; border-radius: 50%; width: 10px; height: 10px; border: 1.5px solid white;" class="animate-pulse"></div>` : ''}<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="width: 16px; height: 16px;">${iconSvg}</svg></div>`, 
        iconSize: [32, 32], 
        iconAnchor: [16, 16] 
    });
};

export default function TacticalOperationCenter() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null); 
  const mainMapRef = useRef<L.Map | null>(null);

  const [operation, setOperation] = useState<Operation | null>(null);
  const [sectors, setSectors] = useState<TacticalSector[]>([]);
  const [pois, setPois] = useState<TacticalPOI[]>([]);
  const [kmlLayers, setKmlLayers] = useState<TacticalKmlLayer[]>([]);
  const [tacticalDrones, setTacticalDrones] = useState<TacticalDrone[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDiaryModalOpen, setIsDiaryModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [activeTab, setActiveTab] = useState<'resources' | 'layers'>('resources');
  const [activePanel, setActivePanel] = useState<'create' | 'manage' | null>(null);
  const [entityType, setEntityType] = useState<'sector' | 'poi' | 'drone' | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<any>(null); 
  const [mapType, setMapType] = useState<'street' | 'satellite'>('street');
  const [currentDrawMode, setCurrentDrawMode] = useState<string | null>(null);
  const [tempGeometry, setTempGeometry] = useState<any>(null); 
  const [pendingPoi, setPendingPoi] = useState<{lat: number, lng: number} | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemSubType, setNewItemSubType] = useState('base');
  const [newItemStream, setNewItemStream] = useState('');
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [pendingDroneData, setPendingDroneData] = useState<any>(null);
  
  const [selectedDroneId, setSelectedDroneId] = useState('');
  const [selectedPilotId, setSelectedPilotId] = useState('');

  const [pipStream, setPipStream] = useState<string | null>(null);
  const [pipPos, setPipPos] = useState({ x: window.innerWidth - 420, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Search Planning State
  const [isSearchPlanningOpen, setIsSearchPlanningOpen] = useState(false);
  const [searchParams, setSearchParams] = useState({
    lkp: null as [number, number] | null,
    destination: null as [number, number] | null,
    terrain: 'plano' as TerrainType,
    experience: 'iniciante' as ExperienceLevel,
    backpack: 'sem_mochila' as BackpackStatus,
    timeHours: 1,
    areaType: 'possibilidade' as 'possibilidade' | 'apg' | 'apga'
  });
  const [isSelectingLkp, setIsSelectingLkp] = useState(false);
  const [isSelectingDest, setIsSelectingDest] = useState(false);

  useEffect(() => { 
      if (id) {
          loadTacticalData(id); 
          setKmlLayers(tacticalService.getKmlLayers(id));
      }
  }, [id]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPipPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    };
    const handleMouseUp = () => { setIsDragging(false); };
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

    const handleDragStart = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragOffset.current = { x: e.clientX - pipPos.x, y: e.clientY - pipPos.y };
    };

    const handleGenerateSearchArea = async () => {
        if (!searchParams.lkp) {
            alert("Defina o LKP no mapa primeiro.");
            return;
        }

        const speed = searchPlanningService.calculateSpeed(searchParams.terrain, searchParams.backpack, searchParams.experience);
        const autonomyKm = speed * searchParams.timeHours;

        try {
            if (searchParams.areaType === 'possibilidade') {
                // Criar um POI de Interesse com a informação da autonomia
                await tacticalService.createPOI({
                    operation_id: id!,
                    name: `Área de Possibilidade (${autonomyKm.toFixed(1)}km)`,
                    type: 'interest',
                    lat: searchParams.lkp[0],
                    lng: searchParams.lkp[1],
                    description: `Autonomia estimada: ${autonomyKm.toFixed(2)} km baseada em ${searchParams.timeHours}h de deslocamento.`
                });
            } else {
                if (!searchParams.destination) {
                    alert("Defina o Destino no mapa para APG/APGA.");
                    return;
                }

                const offsetNm = searchParams.areaType === 'apg' ? 0.5 : 1.0;
                const offsetKm = searchPlanningService.nmToKm(offsetNm);
                
                // APG/APGA: 0.5 NM ou 1.0 NM de afastamento lateral
                // Início: 0.5 NM antes do LKP (para APG) ou 0 (para APGA)
                // Fim: 1.0 NM após o destino
                const startOffsetKm = searchParams.areaType === 'apg' ? searchPlanningService.nmToKm(0.5) : 0;
                const endOffsetKm = searchPlanningService.nmToKm(1.0);

                const polygonCoords = searchPlanningService.calculateRouteRectangle(
                    searchParams.lkp,
                    searchParams.destination,
                    offsetKm,
                    startOffsetKm,
                    endOffsetKm
                );

                await tacticalService.createSector({
                    operation_id: id!,
                    name: `${searchParams.areaType.toUpperCase()} (${offsetNm} NM)`,
                    type: 'zone',
                    color: '#f59e0b',
                    geojson: {
                        type: 'Polygon',
                        coordinates: [polygonCoords.map((c: [number, number]) => [c[1], c[0]])]
                    }
                });
            }

            setIsSearchPlanningOpen(false);
            loadTacticalData(id!);
            alert("Área de busca gerada com sucesso!");
        } catch (error) {
            console.error("Erro ao gerar área:", error);
            alert("Erro ao salvar área de busca.");
        }
    };

  const loadTacticalData = async (opId: string) => {
    try {
      // Fetch operation first to allow page to load
      const op = await base44.entities.Operation.filter({ id: opId }).then(res => res[0]);
      if (!op) { navigate('/operations'); return; }
      
      setOperation(op);
      setLoading(false); // Page opens!

      // Load rest in background
      const [sects, points, tDrones, allDrones, allPilots] = await Promise.all([
          tacticalService.getSectors(opId), 
          tacticalService.getPOIs(opId), 
          tacticalService.getTacticalDrones(opId), 
          base44.entities.Drone.list(), 
          base44.entities.Pilot.list()
      ]);
      
      const enrichedDrones = tDrones.map((td: TacticalDrone, idx: number) => ({ 
          ...td, 
          drone: allDrones.find(d => d.id === td.drone_id), 
          pilot: allPilots.find(p => p.id === td.pilot_id),
          flight_altitude: td.flight_altitude || op.flight_altitude || 60,
          radius: td.radius || op.radius || 200,
          observer_name: op.observer_name,
          color: TACTICAL_PALETTE[(idx + 1) % TACTICAL_PALETTE.length]
      }));

      if (op.drone_id && !enrichedDrones.some(td => td.drone_id === op.drone_id)) {
          const mainDrone = allDrones.find(d => d.id === op.drone_id);
          const mainPilot = allPilots.find(p => p.id === op.pilot_id);
          enrichedDrones.unshift({
              id: `primary-${op.id}`,
              operation_id: op.id,
              drone_id: op.drone_id,
              pilot_id: op.pilot_id,
              status: 'active',
              current_lat: op.latitude,
              current_lng: op.longitude,
              drone: mainDrone,
              pilot: mainPilot,
              flight_altitude: op.flight_altitude || 60,
              radius: op.radius || 200,
              observer_name: op.observer_name,
              stream_url: op.stream_url,
              color: TACTICAL_PALETTE[0]
          } as any);
      }

      setSectors(sects || []); 
      setPois(points || []); 
      setTacticalDrones((enrichedDrones || []) as any);
      setDrones(allDrones || []); 
      setPilots(allPilots || []);
    } catch (e: any) { 
        console.error(e);
        if (e.code === 'PGRST205') handleSchemaError();
    }
  };

  const handleSchemaError = () => {
    setSqlError(`
CREATE TABLE IF NOT EXISTS public.tactical_drones (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    operation_id uuid REFERENCES public.operations(id) ON DELETE CASCADE,
    drone_id uuid REFERENCES public.drones(id) ON DELETE CASCADE,
    pilot_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    status text DEFAULT 'active',
    current_lat float,
    current_lng float,
    sector_id uuid,
    battery_level int,
    flight_altitude float,
    radius float,
    stream_url text,
    created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.tactical_sectors (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    operation_id uuid REFERENCES public.operations(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text DEFAULT 'sector',
    color text,
    geojson jsonb,
    responsible text,
    notes text,
    assigned_drones uuid[],
    stream_url text,
    created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.tactical_pois (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    operation_id uuid REFERENCES public.operations(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text NOT NULL,
    lat float NOT NULL,
    lng float NOT NULL,
    description text,
    stream_url text,
    created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.tactical_drones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tactical_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tactical_pois ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso Total Publico" ON public.tactical_drones FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Total Publico" ON public.tactical_sectors FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Total Publico" ON public.tactical_pois FOR ALL TO public USING (true) WITH CHECK (true);
NOTIFY pgrst, 'reload schema';
    `);
  };

  const handleLocatePilot = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
        if (mainMapRef.current) mainMapRef.current.flyTo([pos.coords.latitude, pos.coords.longitude], 18, { duration: 1.5 });
    }, null, { enableHighAccuracy: true });
  };

  const operationalSummary = useMemo(() => {
    const safeSectors = sectors || [];
    const safePois = pois || [];
    const safeDrones = tacticalDrones || [];
    
    const totalAreaM2 = safeSectors.reduce((acc, s) => {
        const coords = s.geojson?.coordinates || s.geojson?.geometry?.coordinates;
        if (!coords) return acc;
        return acc + calculatePolygonArea(coords);
    }, 0);

    return { 
        totalAreaM2, 
        drones: safeDrones.length, 
        victims: safePois.filter(p => p.type === 'victim').length, 
        teams: safePois.filter(p => p.type === 'ground_team').length, 
        vehicles: safePois.filter(p => p.type === 'vehicle').length, 
        k9s: safePois.filter(p => p.type === 'k9').length 
    };
  }, [sectors, pois, tacticalDrones]);

  const handleDrawCreated = (e: any) => {
    const geojson = e.layer.toGeoJSON(); 
    let type: 'poi' | 'sector' = e.layerType === 'marker' ? 'poi' : 'sector';
    setEntityType(type); setTempGeometry(geojson); setCurrentDrawMode(null);
    if (type === 'sector') setNewItemName(PHONETIC[sectors.length % PHONETIC.length]);
    else setNewItemName(`Ponto ${pois.length + 1}`);
    setActivePanel('create'); setSidebarOpen(true);
  };

  const handleSaveElement = async () => {
      if (!id || !tempGeometry) return;
      try {
          if (entityType === 'poi') {
              const [lng, lat] = tempGeometry.geometry.coordinates;
              await tacticalService.createPOI({ operation_id: id, name: newItemName, type: newItemSubType as any, lat, lng, stream_url: newItemStream });
          } else {
              // Regra de cores sequenciais para os setores
              const sectorIndex = sectors.length;
              const sectorColor = TACTICAL_PALETTE[(sectorIndex + 1) % TACTICAL_PALETTE.length];
              
              await tacticalService.createSector({ 
                  operation_id: id, 
                  name: newItemName, 
                  type: 'sector', 
                  color: sectorColor, 
                  geojson: tempGeometry.geometry 
              });
          }
          setActivePanel(null); setNewItemStream(''); loadTacticalData(id);
      } catch(e: any) { if (e.code === 'PGRST205') handleSchemaError(); else alert("Erro ao salvar elemento."); }
  };

  const handleDroneDrag = async (td: any, e: any) => {
      const { lat, lng } = e.target.getLatLng();
      setTacticalDrones(prev => prev.map(item => item.id === td.id ? { ...item, current_lat: lat, current_lng: lng } : item));
      try {
          if (td.id.startsWith('primary-')) {
              await base44.entities.Operation.update(id!, { latitude: Number(lat), longitude: Number(lng) });
          } else {
              await tacticalService.updateDroneStatus(td.id, { current_lat: Number(lat), current_lng: Number(lng) });
          }
      } catch (err) {
          console.error("Falha ao persistir nova posição:", err);
      }
  };

  const handleAddDroneToTactical = async () => {
      if (!id || !selectedDroneId || !selectedPilotId) return;
      
      const drone = drones.find(d => d.id === selectedDroneId);
      const pilot = pilots.find(p => p.id === selectedPilotId);

      if (pilot) {
          const lastFlight = pilot.last_flight_date ? new Date(pilot.last_flight_date) : null;
          const now = new Date();
          const diffDays = lastFlight ? Math.ceil(Math.abs(now.getTime() - lastFlight.getTime()) / (1000 * 60 * 60 * 24)) : 999;
          
          if (diffDays > 30) {
              if (!confirm(`ATENÇÃO: O piloto ${pilot.full_name} não realiza voos há ${diffDays} dias. Deseja prosseguir mesmo com a necessidade de reciclagem?`)) {
                  return;
              }
          }
      }

      setPendingDroneData({
          operation_id: id,
          drone_id: selectedDroneId,
          pilot_id: selectedPilotId,
          status: 'active',
          current_lat: Number(operation?.latitude),
          current_lng: Number(operation?.longitude),
          flight_altitude: Number(operation?.flight_altitude || 60),
          radius: Number(operation?.radius || 200),
          stream_url: newItemStream,
          drone_prefix: drone?.prefix || 'Drone'
      });
      
      setIsChecklistOpen(true);
  };

  const handleChecklistComplete = async (checklistData: any) => {
      if (!pendingDroneData) return;
      
      setLoading(true);
      try {
          const { drone_prefix, ...data } = pendingDroneData;
          await tacticalService.assignDrone(data);
          
          // Salvar checklist
          await base44.entities.DroneChecklist.create({
              drone_id: data.drone_id,
              pilot_id: data.pilot_id,
              date: new Date().toISOString(),
              items: Object.entries(checklistData).map(([name, checked]) => ({ category: 'Pre-Voo', name, checked: checked as boolean })),
              status: 'approved'
          });

          await base44.entities.Drone.update(data.drone_id, { status: 'in_operation' });
          
          // Atualizar data do último voo do piloto
          await base44.entities.Pilot.update(data.pilot_id, { last_flight_date: new Date().toISOString() });

          alert("Aeronave HARPIA autorizada e lançada no mapa!");
          setIsChecklistOpen(false);
          setPendingDroneData(null);
          setSelectedDroneId(''); setSelectedPilotId(''); setNewItemStream(''); setActivePanel(null); loadTacticalData(id!);
      } catch (e: any) {
          alert("Erro ao autorizar voo.");
      } finally {
          setLoading(false);
      }
  };

  const handleSaveDroneTactical = async () => {
    if (!selectedEntity || entityType !== 'drone') return;
    setLoading(true);
    try {
      if (selectedEntity.id.startsWith('primary-')) {
          await base44.entities.Operation.update(id!, { stream_url: newItemStream });
      } else {
          await tacticalService.updateDroneStatus(selectedEntity.id, { stream_url: newItemStream });
      }
      alert("Configurações do vetor atualizadas!");
      setActivePanel(null);
      setNewItemStream('');
      loadTacticalData(id!);
    } catch (e) {
      alert("Erro ao salvar alterações no vetor.");
    } finally {
        setLoading(false);
    }
  };

  const handleSavePOITactical = async () => {
    if (!selectedEntity || entityType !== 'poi') return;
    setLoading(true);
    try {
        await tacticalService.updatePOI(selectedEntity.id, { stream_url: newItemStream });
        alert("Ponto de Interesse atualizado!");
        setActivePanel(null);
        setNewItemStream('');
        loadTacticalData(id!);
    } catch (e) {
        alert("Erro ao salvar alterações no Ponto de Interesse.");
    } finally {
        setLoading(false);
    }
  };

  const handleCreatePOITactical = async () => {
    if (!pendingPoi || !id) return;
    setLoading(true);
    try {
        await tacticalService.createPOI({
            operation_id: id,
            name: newItemName || `Novo ${newItemSubType}`,
            type: newItemSubType as any,
            lat: pendingPoi.lat,
            lng: pendingPoi.lng,
            stream_url: newItemStream
        });
        alert("Ponto de Interesse criado!");
        setActivePanel(null);
        setPendingPoi(null);
        setNewItemName('');
        setNewItemStream('');
        loadTacticalData(id);
    } catch (e) {
        alert("Erro ao criar Ponto de Interesse.");
    } finally {
        setLoading(false);
    }
  };

  const handleCaptureSnapshot = async () => {
    if (!mapRef.current || !id || !mainMapRef.current) return;
    setIsCapturing(true);
    try {
      const map = mainMapRef.current;
      const bounds = L.featureGroup();

      sectors.forEach(s => {
        if (s.geojson) bounds.addLayer(L.geoJSON(s.geojson as any));
      });
      kmlLayers.filter(l => l.visible).forEach(l => {
        if (l.geojson) bounds.addLayer(L.geoJSON(l.geojson as any));
      });
      pois.forEach(p => {
        bounds.addLayer(L.marker([p.lat, p.lng]));
      });
      tacticalDrones.forEach(td => {
        if (td.current_lat && td.current_lng) bounds.addLayer(L.marker([td.current_lat, td.current_lng]));
      });

      if (bounds.getLayers().length > 0) {
        map.fitBounds(bounds.getBounds(), { padding: [50, 50] });
      }

      setTimeout(async () => {
        if (!mapRef.current) {
          console.error("Map element not found after delay.");
          alert("Não foi possível capturar o mapa. Tente novamente.");
          setIsCapturing(false);
          return;
        }
        try {
          const canvas = await html2canvas(mapRef.current, {
            useCORS: true,
            logging: false,
            ignoreElements: (el) => !!(el.classList.contains('leaflet-control-container') || el.closest('.leaflet-control-container'))
          });
          const base64 = canvas.toDataURL('image/jpeg', 0.8);
          await tacticalService.saveMapSnapshot(id, base64);
          alert("Snapshot do teatro de operações salvo com sucesso!");
        } catch (error) {
          console.error("Falha na captura:", error);
          alert("Erro ao processar imagem do mapa.");
        } finally {
          setIsCapturing(false);
        }
      }, 1000);

    } catch (error) {
      console.error("Erro ao preparar snapshot:", error);
      alert("Erro ao preparar o mapa para captura.");
      setIsCapturing(false);
    }
  };

  const handleKmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        const text = event.target?.result as string;
        const geojson = parseKmlToGeoJson(text);
        
        if (geojson) {
            const newLayer: TacticalKmlLayer = {
                id: crypto.randomUUID(),
                operation_id: id,
                name: file.name,
                geojson: geojson,
                visible: true,
                color: TACTICAL_PALETTE[kmlLayers.length % TACTICAL_PALETTE.length]
            };
            
            tacticalService.saveKmlLayer(id, newLayer);
            setKmlLayers(prev => [...prev, newLayer]);
            alert("Camada KML importada com sucesso!");
        } else {
            alert("Erro ao interpretar arquivo KML. Verifique se o formato está correto.");
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const toggleKmlVisibility = (layerId: string) => {
      const updated = kmlLayers.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l);
      setKmlLayers(updated);
      // Aqui poderíamos persistir a visibilidade também se desejado
  };

  const removeKmlLayer = (layerId: string) => {
      if (!id || !confirm("Remover esta camada permanentemente?")) return;
      const updated = kmlLayers.filter(l => l.id !== layerId);
      setKmlLayers(updated);
      localStorage.setItem(`sysarp_kml_${id}`, JSON.stringify(updated));
  };

  if (loading || !operation) return <div className="h-screen bg-slate-950 flex items-center justify-center text-white font-black animate-pulse uppercase tracking-widest">Sincronizando Teatro de Operações...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden text-slate-800 font-sans relative">
      
      {sqlError && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
              <Card className="w-full max-w-3xl bg-white border-t-8 border-red-600 shadow-2xl rounded-3xl overflow-hidden">
                  <div className="p-6 bg-red-50 flex items-center gap-4">
                      <div className="p-3 bg-red-600 rounded-2xl text-white"><Database className="w-8 h-8" /></div>
                      <div>
                          <h3 className="text-xl font-black text-red-900 uppercase">Configuração de Banco</h3>
                          <p className="text-sm text-red-700">Tabelas táticas inexistentes. Execute o SQL no Supabase.</p>
                      </div>
                  </div>
                  <div className="p-6 bg-slate-50 flex flex-col gap-4">
                      <pre className="bg-slate-900 text-green-400 p-5 rounded-2xl text-[10px] overflow-auto font-mono max-h-[40vh] shadow-inner">{sqlError}</pre>
                      <div className="flex justify-end gap-3">
                          <Button variant="outline" onClick={() => setSqlError(null)} className="font-bold">FECHAR</Button>
                          <Button onClick={() => { navigator.clipboard.writeText(sqlError); alert("SQL Copiado!"); }} className="bg-blue-600 text-white font-bold px-8 shadow-lg shadow-blue-200">COPIAR SQL</Button>
                      </div>
                  </div>
              </Card>
          </div>
      )}

      <div className="h-20 bg-[#7f1d1d] border-b border-red-900/40 flex items-center justify-between px-6 shrink-0 z-[1000] shadow-2xl">
        <div className="flex items-center gap-4 text-white">
          <button onClick={() => navigate('/operations')} className="h-12 w-12 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-all border border-white/20 shadow-inner cursor-pointer">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-base md:text-lg font-black uppercase tracking-tighter truncate max-w-[250px] md:max-w-none leading-none">{operation.name}</h1>
            <p className="text-[11px] text-red-200 opacity-80 font-mono mt-1 uppercase tracking-widest font-black">#{operation.occurrence_number} • CENTRO DE COMANDO CBMPR</p>
          </div>
        </div>
        <Button onClick={() => setSidebarOpen(!sidebarOpen)} className="bg-white text-red-700 h-11 px-8 font-black text-xs uppercase shadow-2xl border-none active:scale-95 transition-transform cursor-pointer">
            {sidebarOpen ? 'OCULTAR PAINEL' : 'EXIBIR CONTROLES'}
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
          <div className={`${sidebarOpen ? 'w-full lg:w-96' : 'w-0'} bg-white border-r border-slate-200 flex flex-col shadow-2xl z-[500] transition-all duration-300 overflow-hidden shrink-0`}>
              <div className="flex bg-slate-100 p-1.5 m-4 rounded-2xl shrink-0 border border-slate-200">
                  <button onClick={() => setActiveTab('resources')} className={`flex-1 py-3 text-[11px] font-black uppercase rounded-xl transition-all cursor-pointer ${activeTab === 'resources' ? 'bg-white text-red-700 shadow-md' : 'text-slate-500'}`}>Recursos</button>
                  <button onClick={() => setActiveTab('layers')} className={`flex-1 py-3 text-[11px] font-black uppercase rounded-xl transition-all cursor-pointer ${activeTab === 'layers' ? 'bg-white text-red-700 shadow-md' : 'text-slate-500'}`}>Camadas</button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                  {activeTab === 'resources' ? (
                      !activePanel ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                            <Card className="p-4 bg-slate-900 text-white border-none shadow-lg">
                                <p className="text-[9px] font-black text-white/40 uppercase mb-1">Área Atuação</p>
                                <h4 className="text-lg font-black">{formatArea(operationalSummary.totalAreaM2)}</h4>
                            </Card>
                            <Card className="p-4 bg-slate-900 text-white border-none shadow-lg">
                                <p className="text-[9px] font-black text-white/40 uppercase mb-1">Vetores HARPIA</p>
                                <h4 className="text-lg font-black">{operationalSummary.drones} Ativos</h4>
                            </Card>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1"><Ruler className="w-3.5 h-3.5" /> Planejamento de Busca</h3>
                            <Button 
                                onClick={() => setIsSearchPlanningOpen(true)} 
                                className="w-full bg-amber-600 hover:bg-amber-700 text-white h-12 rounded-2xl font-black uppercase text-[11px] flex items-center justify-center gap-3 shadow-lg"
                            >
                                <Activity className="w-5 h-5" /> CALCULAR ÁREA DE BUSCA
                            </Button>
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-center">
                            <div className="bg-red-50 py-2 rounded-lg"><p className="text-[9px] font-black text-red-400 uppercase">Vítimas</p><p className="text-sm font-black text-red-800">{operationalSummary.victims}</p></div>
                            <div className="bg-blue-50 py-2 rounded-lg"><p className="text-[9px] font-black text-blue-400 uppercase">Equipes</p><p className="text-sm font-black text-blue-800">{operationalSummary.teams}</p></div>
                            <div className="bg-slate-100 py-2 rounded-lg"><p className="text-[9px] font-black text-slate-400 uppercase">Viaturas</p><p className="text-sm font-black text-slate-800">{operationalSummary.vehicles}</p></div>
                            <div className="bg-amber-50 py-2 rounded-lg"><p className="text-[9px] font-black text-amber-400 uppercase">K9</p><p className="text-sm font-black text-amber-800">{operationalSummary.k9s}</p></div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1"><MapPin className="w-3.5 h-3.5" /> Objetivos e Pontos</h3>
                            <div className="space-y-2">
                                {sectors.map((s, idx) => (
                                    <div key={s.id} onClick={() => { setSelectedEntity(s); setEntityType('sector'); setActivePanel('manage'); }} className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors shadow-sm group">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 rounded-xl" style={{ backgroundColor: (s.color || TACTICAL_PALETTE[0]) + '20', color: s.color || TACTICAL_PALETTE[0] }}><Hexagon className="w-5 h-5"/></div>
                                            <div><p className="text-xs font-black uppercase text-slate-800">{s.name}</p><p className="text-[9px] text-slate-400 font-bold">{formatArea(calculatePolygonArea(s.geojson?.coordinates || s.geojson?.geometry?.coordinates))}</p></div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-red-600 transition-colors"/>
                                    </div>
                                ))}
                                {pois.map(p => (
                                    <div key={p.id} onClick={() => { setSelectedEntity(p); setEntityType('poi'); setActivePanel('manage'); setNewItemStream(p.stream_url || ''); }} className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors shadow-sm group">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 rounded-full bg-slate-100 text-slate-600">
                                                {p.type === 'victim' ? <Heart className="w-5 h-5 text-red-600"/> : p.type === 'ground_team' ? <Users className="w-5 h-5 text-blue-600"/> : p.type === 'vehicle' ? <Truck className="w-5 h-5 text-red-600"/> : p.type === 'k9' ? <Dog className="w-5 h-5 text-amber-900"/> : <MapPin className="w-5 h-5"/>}
                                            </div>
                                            <div><p className="text-xs font-black uppercase text-slate-800">{p.name}</p><p className="text-[9px] text-slate-400 font-bold uppercase">{p.type}</p></div>
                                        </div>
                                        {p.stream_url && <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-slate-100">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1"><Activity className="w-3.5 h-3.5" /> Aeronaves no Teatro</h3>
                            <button 
                                onClick={() => { setEntityType('drone'); setActivePanel('create'); }} 
                                className="w-full bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 text-white h-16 rounded-2xl font-black uppercase text-[11px] flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(37,99,235,0.3)] hover:scale-[1.03] active:scale-[0.97] transition-all ring-4 ring-blue-500/10 cursor-pointer"
                            >
                                <Plus className="w-6 h-6" /> ADICIONAR HARPIA
                            </button>

                            <div className="space-y-2 mt-4">
                                {tacticalDrones.map((td: any) => (
                                    <div key={td.id} onClick={() => { setSelectedEntity(td); setEntityType('drone'); setActivePanel('manage'); setNewItemStream(td.stream_url || ''); }} className="p-4 bg-white rounded-2xl border-2 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-all shadow-sm" style={{ borderColor: td.color + '40' }}>
                                        <div className="p-2.5 rounded-xl shadow-sm border border-slate-100" style={{ backgroundColor: td.color + '15' }}><Activity className="w-5 h-5" style={{ color: td.color }}/></div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-black uppercase text-slate-800 leading-none">{td.drone?.prefix}</p>
                                            <p className="text-[9px] text-slate-400 truncate uppercase mt-1 font-bold">PIC: {td.pilot?.full_name}</p>
                                        </div>
                                        {td.stream_url ? <Badge className="text-[8px] bg-red-600 text-white animate-pulse border-none">LIVE</Badge> : <Badge variant="success" className="text-[8px]">ONLINE</Badge>}
                                    </div>
                                ))}
                            </div>
                        </div>
                      </>
                  ) : activePanel === 'create' ? (
                      <div className="space-y-6 animate-fade-in">
                          <h2 className="text-xs font-black uppercase text-blue-700 flex items-center gap-2"><Plus className="w-4 h-4"/> Lançar HARPIA</h2>
                          <div className="space-y-4">
                              {entityType === 'drone' ? (
                                  <>
                                      <Select label="Aeronave Disponível" value={selectedDroneId} onChange={e => setSelectedDroneId(e.target.value)} required>
                                          <option value="">Selecione...</option>
                                          {drones.filter(d => d.status === 'available').map(d => <option key={d.id} value={d.id}>{d.prefix} - {d.model}</option>)}
                                      </Select>
                                      <Select label="Piloto em Comando (PIC)" value={selectedPilotId} onChange={e => setSelectedPilotId(e.target.value)} required>
                                          <option value="">Selecione...</option>
                                          {pilots.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                                      </Select>
                                      <Input label="Link de Live (YouTube/RTSP)" value={newItemStream} onChange={e => setNewItemStream(e.target.value)} placeholder="Cole o link de transmissão..." />
                                      <div className="flex gap-3 pt-4">
                                          <Button variant="outline" className="flex-1 font-black cursor-pointer" onClick={() => setActivePanel(null)}>Cancelar</Button>
                                          <Button className="flex-1 bg-blue-700 text-white font-black uppercase shadow-lg shadow-blue-100 cursor-pointer" onClick={handleAddDroneToTactical}>Lançar no Mapa</Button>
                                      </div>
                                  </>
                              ) : (
                                  <>
                                                                            <Input label="Identificação / Nome" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Ex: SETOR ALFA..." />
                                      {entityType === 'poi' && (
                                        <Select label="Tipo de Ponto" value={newItemSubType} onChange={e => setNewItemSubType(e.target.value)}>
                                          <option value="base">Base de Operações</option>
                                          <option value="victim">Vítima</option>
                                          <option value="hazard">Perigo / Risco</option>
                                          <option value="ground_team">Equipe Terrestre</option>
                                          <option value="vehicle">Viatura</option>
                                          <option value="k9">Cão de Busca (K9)</option>
                                          <option value="command_post">Posto de Comando</option>
                                          <option value="evidence">Vestígio</option>
                                          <option value="footprints">Pegadas</option>
                                          <option value="obstacle">Obstáculo</option>
                                        </Select>
                                      )}
                                      <div className="flex gap-3 pt-4">
                                          <Button variant="outline" className="flex-1 font-black cursor-pointer" onClick={() => setActivePanel(null)}>Cancelar</Button>
                                          <Button className="flex-1 bg-red-700 text-white font-black uppercase shadow-lg shadow-red-100 cursor-pointer" onClick={entityType === 'poi' && pendingPoi ? handleCreatePOITactical : handleSaveElement}>Salvar Elemento</Button>
                                      </div>
                                  </>
                              )}
                          </div>
                      </div>
                  ) : (
                      <div className="space-y-6 animate-fade-in">
                           <h2 className="text-xs font-black uppercase text-slate-500 flex items-center gap-2"><Settings className="w-4 h-4"/> Gestão do Elemento</h2>
                           <div className="p-6 bg-slate-900 rounded-[2rem] text-white shadow-2xl border border-slate-800" style={entityType === 'drone' ? { borderTop: `8px solid ${selectedEntity.color}` } : {}}>
                               <p className="text-[10px] font-black text-white/40 uppercase mb-2 tracking-widest">{entityType === 'sector' ? 'SETORIZADOR' : entityType === 'drone' ? 'VETOR OPERACIONAL' : 'PONTO TÁTICO'}</p>
                               <h4 className="text-2xl font-black uppercase tracking-tight">{entityType === 'drone' ? (selectedEntity as any).drone?.prefix : (selectedEntity as any).name}</h4>
                               {entityType === 'poi' && <p className="text-[10px] text-white/40 font-mono mt-1 uppercase">{selectedEntity.type}</p>}
                               {entityType === 'drone' && (
                                   <div className="mt-4 space-y-2.5 border-t border-white/10 pt-4">
                                       <div className="flex justify-between items-center"><span className="text-[10px] text-white/40 uppercase font-black tracking-tighter">PIC (Piloto)</span><span className="text-xs font-bold uppercase" style={{ color: selectedEntity.color }}>{selectedEntity.pilot?.full_name}</span></div>
                                       <div className="flex justify-between items-center"><span className="text-[10px] text-white/40 uppercase font-black tracking-tighter">Altitude Alvo</span><span className="text-xs font-bold">{selectedEntity.flight_altitude}m AGL</span></div>
                                   </div>
                               )}
                               {selectedEntity.stream_url && (
                                   <div className="mt-6 p-4 bg-red-600 rounded-2xl flex items-center justify-between shadow-lg shadow-red-900/40">
                                       <span className="text-[10px] font-black uppercase flex items-center gap-2"><Video className="w-4 h-4"/> LIVE ATIVA</span>
                                       <button onClick={() => setPipStream(extractVideoData(selectedEntity.stream_url))} className="text-[10px] bg-white text-red-700 px-5 py-2 rounded-full font-black shadow-xl active:scale-95 transition-transform cursor-pointer">ABRIR</button>
                                   </div>
                               )}
                           </div>
                           {(entityType === 'drone' || entityType === 'poi') && (
                               <Card className="p-5 border border-slate-200 bg-slate-50 space-y-4 rounded-3xl shadow-inner">
                                   <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 ml-1"><Video className="w-3.5 h-3.5 text-blue-600" /> Link de Transmissão</h3>
                                   <Input value={newItemStream} onChange={e => setNewItemStream(e.target.value)} placeholder="Cole o link aqui..." className="bg-white text-xs h-11" />
                                   <Button onClick={entityType === 'drone' ? handleSaveDroneTactical : handleSavePOITactical} className="w-full h-12 bg-blue-600 text-white font-black text-[11px] uppercase rounded-xl shadow-lg shadow-blue-100 cursor-pointer">Salvar Alterações</Button>
                               </Card>
                           )}
                           <div className="space-y-3 pt-4">
                               <Button variant="outline" className="w-full text-[10px] font-black uppercase h-14 rounded-2xl cursor-pointer" onClick={() => setActivePanel(null)}>Retornar ao Painel</Button>
                               <Button variant="danger" className="w-full text-[10px] font-black uppercase h-14 rounded-2xl shadow-xl shadow-red-100 cursor-pointer" onClick={async () => {
                                   if (!confirm("Confirmar remoção?")) return;
                                   if (entityType === 'sector') await tacticalService.deleteSector(selectedEntity.id);
                                   else if (entityType === 'poi') await tacticalService.deletePOI(selectedEntity.id);
                                   else {
                                       await tacticalService.removeDroneFromOp(selectedEntity.id);
                                       if (selectedEntity.drone_id) await base44.entities.Drone.update(selectedEntity.drone_id, { status: 'available' });
                                   }
                                   setActivePanel(null); loadTacticalData(id!);
                               }}>Remover do Cenário</Button>
                           </div>
                      </div>
                  )
                  ) : (
                    <div className="space-y-6 animate-fade-in">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1"><Layers className="w-3.5 h-3.5" /> Camadas do Mapa</h3>
                        
                        {/* Botão de Upload KML */}
                        <div className="p-6 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-all group relative cursor-pointer overflow-hidden">
                            <input 
                                type="file" 
                                accept=".kml" 
                                onChange={handleKmlUpload} 
                                className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                            />
                            <div className="flex flex-col items-center gap-3">
                                <div className="p-3 bg-white rounded-full shadow-sm text-blue-600 group-hover:scale-110 transition-transform">
                                    <UploadCloud className="w-8 h-8" />
                                </div>
                                <div className="text-center">
                                    <p className="text-xs font-black text-slate-700 uppercase">Carregar KML / KMZ</p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Importar polígonos e rotas externas</p>
                                </div>
                            </div>
                        </div>

                        {/* Lista de Camadas */}
                        <div className="space-y-3">
                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Camadas Ativas</h4>
                            {kmlLayers.length === 0 ? (
                                <div className="py-10 text-center">
                                    <Globe className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                    <p className="text-[10px] text-slate-400 font-bold italic">Nenhuma camada externa carregada</p>
                                </div>
                            ) : (
                                kmlLayers.map(layer => (
                                    <div key={layer.id} className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-sm group">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="p-2 rounded-lg" style={{ backgroundColor: layer.color + '20', color: layer.color }}>
                                                <FileType className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black text-slate-700 truncate uppercase">{layer.name}</p>
                                                <p className="text-[8px] text-slate-400 font-bold uppercase">SIG / KML DATA</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => toggleKmlVisibility(layer.id)}
                                                className={`p-2 rounded-xl transition-colors cursor-pointer ${layer.visible ? 'text-blue-600 hover:bg-blue-50' : 'text-slate-400 hover:bg-slate-100'}`}
                                                title={layer.visible ? "Ocultar" : "Exibir"}
                                            >
                                                {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                            </button>
                                            <button 
                                                onClick={() => removeKmlLayer(layer.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                                                title="Remover"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                  )}
              </div>
          </div>

          <div className="flex-1 relative z-0 bg-slate-100" ref={mapRef}>
              {pipStream && (
                  <div className="absolute bg-slate-900 rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.6)] border border-slate-700 z-[3000] overflow-hidden animate-fade-in flex flex-col ring-[12px] ring-black/5" style={{ left: pipPos.x, top: pipPos.y, width: window.innerWidth < 768 ? '320px' : '480px', cursor: isDragging ? 'grabbing' : 'default' }}>
                      {isDragging && <div className="absolute inset-0 z-50 bg-transparent" />}
                      <div onMouseDown={handleDragStart} className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700 cursor-grab active:cursor-grabbing select-none">
                          <div className="flex items-center gap-3">
                              <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse border border-red-400"></div>
                              <span className="text-[11px] font-black text-white uppercase tracking-widest">FEED TÁTICO</span>
                          </div>
                          <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setPipStream(null)} className="p-2 hover:bg-red-600 hover:text-white rounded-xl text-slate-400 transition-all cursor-pointer"><X className="w-5 h-5"/></button>
                      </div>
                      <div className="aspect-video bg-black relative overflow-hidden">
                          <iframe src={pipStream} className="absolute top-0 left-0 w-full h-full border-none" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen></iframe>
                      </div>
                      <div className="p-2.5 bg-slate-800 flex justify-center pointer-events-none opacity-50"><button className="text-[9px] font-black text-white uppercase tracking-widest flex items-center gap-2"><Move className="w-3.5 h-3.5"/> ARRASTE PARA MOVER</button></div>
                  </div>
              )}

              <div className="absolute bottom-10 right-8 z-[1000] flex flex-col gap-4">
                  <button onClick={() => setMapType(mapType === 'street' ? 'satellite' : 'street')} className="bg-white text-slate-700 w-16 h-16 flex items-center justify-center rounded-[1.5rem] shadow-2xl border border-slate-200 hover:bg-slate-50 transition-all hover:scale-105 active:scale-95 cursor-pointer">{mapType === 'street' ? <Layers className="w-7 h-7" /> : <Satellite className="w-7 h-7" />}</button>
                  <button onClick={handleCaptureSnapshot} disabled={isCapturing} className="bg-white text-slate-700 w-16 h-16 flex items-center justify-center rounded-[1.5rem] shadow-2xl border border-slate-200 hover:bg-slate-50 transition-all hover:scale-105 active:scale-95 disabled:bg-slate-200 disabled:cursor-not-allowed cursor-pointer">
                    {isCapturing ? <Loader2 className="w-7 h-7 animate-spin" /> : <Camera className="w-7 h-7" />}
                  </button>
                  <button onClick={handleLocatePilot} className="bg-blue-600 text-white w-16 h-16 flex items-center justify-center rounded-[1.5rem] shadow-2xl border-4 border-white hover:bg-blue-700 transition-all hover:scale-110 active:scale-90 animate-pulse shadow-blue-500/40 cursor-pointer"><LocateFixed className="w-8 h-8" /></button>
              </div>

              <MapContainer 
                center={[operation.latitude, operation.longitude]} 
                zoom={17} 
                style={{ height: '100%', width: '100%' }} 
                ref={(map) => { if (map) mainMapRef.current = map; }} 
                preferCanvas={true}
              >
                  <MapResizer />
                  <MapEvents 
                    onMapClick={(e) => {
                      if (isSelectingLkp) {
                        setSearchParams(p => ({ ...p, lkp: [e.latlng.lat, e.latlng.lng] }));
                        setIsSelectingLkp(false);
                        setIsSearchPlanningOpen(true);
                      } else if (isSelectingDest) {
                        setSearchParams(p => ({ ...p, destination: [e.latlng.lat, e.latlng.lng] }));
                        setIsSelectingDest(false);
                        setIsSearchPlanningOpen(true);
                      }
                    }} 
                  />
                  <TileLayer 
                    url={mapType === 'street' ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"} 
                    {...({ useCache: true, crossOrigin: true } as any)}
                  />
                  {kmlLayers.filter(l => l.visible).map(layer => (
                      <GeoJSON key={layer.id} data={layer.geojson} style={{ color: layer.color, weight: 3 }} />
                  ))}
                  
                  {/* Renderização de Camadas KML Externas */}
                  {kmlLayers.map(layer => layer.visible && (
                      <GeoJSON 
                        key={layer.id} 
                        data={layer.geojson} 
                        pathOptions={{ 
                            color: layer.color, 
                            fillColor: layer.color, 
                            fillOpacity: 0.15, 
                            weight: 3,
                            dashArray: '4, 4'
                        }} 
                      />
                  ))}

                  {sectors.map((s: any) => {
                      const coords = s.geojson?.coordinates || s.geojson?.geometry?.coordinates;
                      if (!coords) return null;
                      return s.type === 'route' ? 
                        <Polyline key={s.id} positions={L.GeoJSON.coordsToLatLngs(coords, 0) as any} pathOptions={{ color: s.color || '#f97316', weight: 6, dashArray: '5, 10' }} /> : 
                        <Polygon key={s.id} positions={L.GeoJSON.coordsToLatLngs(coords, 1) as any} pathOptions={{ color: s.color || '#ef4444', fillOpacity: 0.2, weight: 2 }} />;
                  })}
                  {pois.map((p: any) => (<Marker key={p.id} position={[p.lat, p.lng]} icon={getPoiIcon(p.type, !!p.stream_url)} eventHandlers={{ click: () => { setSelectedEntity(p); setEntityType('poi'); setActivePanel('manage'); setNewItemStream(p.stream_url || ''); } }} />))}
                  {tacticalDrones.map((td: any) => td.current_lat && (<Marker 
                    key={td.id} 
                    position={[td.current_lat, td.current_lng]} 
                    icon={getDroneIcon(td.color || '#2563eb', !!td.stream_url)} 
                    draggable={true}
                    eventHandlers={{ 
                        click: () => { setSelectedEntity(td); setEntityType('drone'); setActivePanel('manage'); setNewItemStream(td.stream_url || ''); },
                        dragend: (e) => handleDroneDrag(td, e)
                    }}
                  >
                    <Popup>
                        <div className="p-4 min-w-[240px] font-sans">
                            <h4 className="font-black text-base uppercase leading-none mb-1 text-slate-900" style={{ color: td.color }}>{td.drone?.prefix}</h4>
                            <p className="text-[10px] text-slate-500 font-bold uppercase mb-4">{td.drone?.model}</p>
                            <div className="space-y-2 mb-5">
                                <div className="flex items-center gap-3 text-[11px] bg-slate-50 p-2 rounded-xl border border-slate-100" style={{ borderLeft: `4px solid ${td.color}` }}><Users className="w-4 h-4 text-slate-600" /><div><span className="text-slate-400 font-bold text-[9px] uppercase block">PIC (Piloto)</span><span className="font-black text-slate-800 uppercase">{td.pilot?.full_name}</span></div></div>
                                <div className="grid grid-cols-2 gap-2"><div className="bg-slate-50 p-2 rounded-xl border border-slate-100"><span className="text-slate-400 font-bold text-[9px] uppercase block">Altura</span><span className="font-black text-slate-800 text-xs">{td.flight_altitude}m</span></div><div className="bg-slate-50 p-2 rounded-xl border border-slate-100"><span className="text-slate-400 font-bold text-[9px] uppercase block">Raio</span><span className="font-black text-slate-800 text-xs">{td.radius}m</span></div></div>
                            </div>
                            {td.stream_url && (<button onClick={() => setPipStream(extractVideoData(td.stream_url!))} className="w-full bg-red-600 text-white font-black uppercase text-[10px] py-3.5 rounded-2xl flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"><Video className="w-4 h-4"/> MONITORAR CÂMERA</button>)}
                            <div className="mt-3 text-[9px] text-slate-400 text-center font-bold uppercase italic">Segure e arraste para reposicionar</div>
                        </div>
                    </Popup>
                  </Marker>))}

                  <TacticalDrawControls 
                    onRefresh={() => operation?.id && loadTacticalData(operation.id)} 
                    onPoiPlacement={(lat, lng) => {
                        setPendingPoi({ lat, lng });
                        setEntityType('poi');
                        setActivePanel('create');
                    }}
                  />
              </MapContainer>

              {isChecklistOpen && (
                  <PreFlightChecklist 
                    isOpen={isChecklistOpen} 
                    onClose={() => setIsChecklistOpen(false)} 
                    onComplete={handleChecklistComplete}
                    droneName={pendingDroneData?.drone_prefix || ''}
                  />
              )}

              {/* SEARCH PLANNING MODAL */}
              {isSearchPlanningOpen && (
                <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                  <Card className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                    <div className="p-6 bg-amber-600 text-white flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <Activity className="w-6 h-6" />
                        <h3 className="text-xl font-black uppercase tracking-tight">Planejamento de Busca SAR</h3>
                      </div>
                      <button onClick={() => setIsSearchPlanningOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Localização</h4>
                          <div className="space-y-2">
                            <Button 
                              onClick={() => { setIsSelectingLkp(true); setIsSearchPlanningOpen(false); }} 
                              variant={searchParams.lkp ? 'outline' : 'primary'}
                              className={`w-full h-12 rounded-xl font-bold uppercase text-xs flex items-center justify-between px-4 ${searchParams.lkp ? 'border-green-500 text-green-600' : 'bg-blue-600 text-white'}`}
                            >
                              <span className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {searchParams.lkp ? 'LKP DEFINIDO' : 'DEFINIR LKP'}</span>
                              {searchParams.lkp && <CheckCircle className="w-4 h-4" />}
                            </Button>
                            
                            {(searchParams.areaType === 'apg' || searchParams.areaType === 'apga') && (
                              <Button 
                                onClick={() => { setIsSelectingDest(true); setIsSearchPlanningOpen(false); }} 
                                variant={searchParams.destination ? 'outline' : 'primary'}
                                className={`w-full h-12 rounded-xl font-bold uppercase text-xs flex items-center justify-between px-4 ${searchParams.destination ? 'border-green-500 text-green-600' : 'bg-blue-600 text-white'}`}
                              >
                                <span className="flex items-center gap-2"><Flag className="w-4 h-4" /> {searchParams.destination ? 'DESTINO DEFINIDO' : 'DEFINIR DESTINO'}</span>
                                {searchParams.destination && <CheckCircle className="w-4 h-4" />}
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Tipo de Área</h4>
                          <div className="grid grid-cols-1 gap-2">
                            <button 
                              onClick={() => setSearchParams(p => ({ ...p, areaType: 'possibilidade' }))}
                              className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${searchParams.areaType === 'possibilidade' ? 'border-amber-600 bg-amber-50' : 'border-slate-100 hover:border-slate-200'}`}
                            >
                              <p className="text-xs font-black text-slate-800 uppercase">Área de Possibilidade</p>
                              <p className="text-[10px] text-slate-500 font-medium">Círculo baseado na autonomia</p>
                            </button>
                            <button 
                              onClick={() => setSearchParams(p => ({ ...p, areaType: 'apg' }))}
                              className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${searchParams.areaType === 'apg' ? 'border-amber-600 bg-amber-50' : 'border-slate-100 hover:border-slate-200'}`}
                            >
                              <p className="text-xs font-black text-slate-800 uppercase">APG (Genérica)</p>
                              <p className="text-[10px] text-slate-500 font-medium">0.5 NM de afastamento da rota</p>
                            </button>
                            <button 
                              onClick={() => setSearchParams(p => ({ ...p, areaType: 'apga' }))}
                              className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${searchParams.areaType === 'apga' ? 'border-amber-600 bg-amber-50' : 'border-slate-100 hover:border-slate-200'}`}
                            >
                              <p className="text-xs font-black text-slate-800 uppercase">APGA (Ampliada)</p>
                              <p className="text-[10px] text-slate-500 font-medium">1.0 NM de afastamento da rota</p>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Select label="Terreno" value={searchParams.terrain} onChange={e => setSearchParams(p => ({ ...p, terrain: e.target.value as any }))}>
                          <option value="plano">Plano</option>
                          <option value="aclive">Aclive (Subida)</option>
                          <option value="declive">Declive (Descida)</option>
                        </Select>
                        <Select label="Perfil" value={searchParams.experience} onChange={e => setSearchParams(p => ({ ...p, experience: e.target.value as any }))}>
                          <option value="iniciante">Iniciante</option>
                          <option value="intermediario">Intermediário</option>
                          <option value="experiente">Experiente</option>
                        </Select>
                        <Select label="Equipamento" value={searchParams.backpack} onChange={e => setSearchParams(p => ({ ...p, backpack: e.target.value as any }))}>
                          <option value="sem_mochila">Sem Mochila</option>
                          <option value="com_mochila">Com Mochila</option>
                        </Select>
                      </div>

                      <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <div className="flex-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Tempo Deslocamento (Horas)</p>
                          <input 
                            type="range" min="1" max="24" step="1" 
                            value={searchParams.timeHours} 
                            onChange={e => setSearchParams(p => ({ ...p, timeHours: parseInt(e.target.value) }))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                          />
                          <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400">
                            <span>1h</span><span>12h</span><span>24h</span>
                          </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 text-center min-w-[100px] shadow-sm">
                          <p className="text-[9px] font-black text-slate-400 uppercase">Total</p>
                          <p className="text-2xl font-black text-amber-600">{searchParams.timeHours}h</p>
                        </div>
                      </div>

                      {searchParams.lkp && (
                        <div className="p-4 bg-green-50 rounded-2xl border border-green-100 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-black text-green-600 uppercase">Estimativa de Autonomia</p>
                            <p className="text-lg font-black text-green-900">
                              {(searchPlanningService.calculateSpeed(searchParams.terrain, searchParams.backpack, searchParams.experience) * searchParams.timeHours).toFixed(2)} km
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-green-600 uppercase">Velocidade Média</p>
                            <p className="text-lg font-black text-green-900">
                              {searchPlanningService.calculateSpeed(searchParams.terrain, searchParams.backpack, searchParams.experience).toFixed(1)} km/h
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-200 flex gap-3">
                      <Button onClick={() => setIsSearchPlanningOpen(false)} variant="outline" className="flex-1 h-14 rounded-2xl font-black uppercase text-xs cursor-pointer">Cancelar</Button>
                      <Button onClick={handleGenerateSearchArea} className="flex-[2] bg-amber-600 hover:bg-amber-700 text-white h-14 rounded-2xl font-black uppercase text-xs shadow-lg cursor-pointer">GERAR ÁREA AUTOMÁTICA</Button>
                    </div>
                  </Card>
                </div>
              )}
          </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 12px; }
        .leaflet-container { border-radius: inherit; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      {isDiaryModalOpen && operation && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white p-6 rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black text-slate-800 uppercase">Diário de Bordo</h2>
              <button onClick={() => setIsDiaryModalOpen(false)} className="text-slate-500 hover:text-slate-800"><X className="w-6 h-6" /></button>
            </div>
            <OperationDailyLog operationId={operation.id} pilots={pilots} drones={drones} currentUser={currentUser} />
          </Card>
        </div>
      )}
    </div>
  );
}
