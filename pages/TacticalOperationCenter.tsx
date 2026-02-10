
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import "@geoman-io/leaflet-geoman-free";
import html2canvas from 'html2canvas'; 
import { base44 } from '../services/base44Client';
import { tacticalService, TacticalSector, TacticalDrone, TacticalPOI, TacticalKmlLayer } from '../services/tacticalService';
import { Operation, Drone, Pilot, MISSION_COLORS, MISSION_HIERARCHY } from '../types';
import { Card, Button, Input, Select, Badge } from '../components/ui_components';
import { 
  ArrowLeft, Radio, Plus, Trash2, Crosshair, Hexagon, Flag, 
  MapPin, Settings, X, Save, Eye, EyeOff, Move, Navigation,
  AlertTriangle, ShieldAlert, Target, Video, ListFilter, History, Zap, 
  Map as MapIcon, Globe, ChevronRight, ChevronLeft, Maximize, Minimize, MousePointer2,
  Users, Truck, Dog, UserCheck, Ruler, LayoutDashboard, Camera, CheckCircle, Loader2, Layers, Satellite, FileUp, Files,
  Footprints, Package, GripHorizontal
} from 'lucide-react';
import SectorsLayer from '../components/maps/tactical/SectorsLayer';

const PHONETIC = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL', 'INDIA', 'JULIETT', 'KILO', 'LIMA', 'MIKE', 'NOVEMBER', 'OSCAR', 'PAPA', 'QUEBEC', 'ROMEO', 'SIERRA', 'TANGO', 'UNIFORM', 'VICTOR', 'WHISKEY', 'X-RAY', 'YANKEE', 'ZULU'];
const TACTICAL_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#6366f1'];

const poiIconCache: Record<string, L.DivIcon> = {};
const droneIconCache: Record<string, L.DivIcon> = {};

// Helper para extrair ID de vídeo (YouTube)
const extractVideoId = (url: string) => {
  if (!url) return null;
  const youtubeMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  if (youtubeMatch) return { type: 'youtube', id: youtubeMatch[1] };
  return { type: 'iframe', url };
};

const calculatePolygonArea = (coordinates: any) => {
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) return 0;
    try {
        const latLngs = L.GeoJSON.coordsToLatLngs(coordinates, 1)[0] as L.LatLng[];
        if (!latLngs || latLngs.length < 3) return 0;
        let area = 0; const radius = 6378137;
        for (let i = 0; i < latLngs.length; i++) {
            const p1 = latLngs[i]; const p2 = latLngs[(i + 1) % latLngs.length];
            area += (p2.lng - p1.lng) * Math.PI / 180 * (2 + Math.sin(p1.lat * Math.PI / 180) + Math.sin(p2.lat * Math.PI / 180));
        }
        area = Math.abs(area * radius * radius / 2.0); return area;
    } catch (e) { return 0; }
};

const formatArea = (m2: number) => {
    if (m2 >= 10000) return `${(m2 / 10000).toFixed(2)} ha`;
    if (m2 > 0) return `${Math.round(m2).toLocaleString('pt-BR')} m²`;
    return "0 m²";
};

const isPointInPolygon = (lat: number, lng: number, polygonCoords: any) => {
    if (!polygonCoords || !polygonCoords[0]) return false;
    const coords = polygonCoords[0]; let inside = false;
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
        const xi = coords[i][1], yi = coords[i][0]; const xj = coords[j][1], yj = coords[j][0];
        const intersect = ((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

const getPoiIcon = (type: string) => {
    if (poiIconCache[type]) return poiIconCache[type];
    let iconHtml = ''; let color = '';
    switch(type) {
        case 'base': iconHtml = `<svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 text-white"><path d="M12.75 3.066a2.25 2.25 0 00-1.5 0l-9.75 3.9A2.25 2.25 0 000 9.066v9.457c0 1.05.738 1.956 1.767 2.169l9.75 2.025a2.25 2.25 0 00.966 0l9.75-2.025A2.25 2.25 0 0024 18.523V9.066a2.25 2.25 0 00-1.5-2.1l-9.75-3.9z" /></svg>`; color = '#b91c1c'; break;
        case 'victim': iconHtml = `<svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 text-white"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`; color = '#ef4444'; break;
        case 'hazard': iconHtml = `<svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 text-white"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`; color = '#f59e0b'; break;
        case 'ground_team': iconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4 text-white"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`; color = '#2563eb'; break;
        case 'vehicle': iconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4 text-white"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M9 18h6"/><path d="M19 18h2a1 1 0 0 0 1-1v-5l-3-4h-5"/></svg>`; color = '#dc2626'; break;
        case 'k9': iconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4 text-white"><path d="M10 5.172l.596.596a2 2 0 0 0 2.828 0L14 5.172M20 21l-2-6M6 21l2-6M12 21v-6M4 4l3 3M20 4l-3 3M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z"/></svg>`; color = '#78350f'; break;
        case 'footprint': iconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4 text-white"><path d="M4 16v-2.382a2 2 0 0 1 1.106-1.789l5.788-2.894A2 2 0 0 1 12 8.146V6M16 21v-2.382a2 2 0 0 1 1.106-1.789l2.788-1.394A2 2 0 0 1 21 13.646V11.5M12 21v-2.382a2 2 0 0 1 1.106-1.789l1.788-0.894A2 2 0 0 1 16 15.146V13M8 21v-2.382a2 2 0 0 1 1.106-1.789l2.788-1.394A2 2 0 0 1 13 13.646V11.5"/></svg>`; color = '#4b5563'; break;
        case 'object': iconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4 text-white"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`; color = '#0891b2'; break;
        default: iconHtml = `<svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 text-white"><circle cx="12" cy="12" r="10"/></svg>`; color = '#64748b';
    }
    const icon = L.divIcon({ className: 'custom-poi-marker', html: `<div style="background-color: ${color}; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border: 2.5px solid white;">${iconHtml}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
    poiIconCache[type] = icon;
    return icon;
};

const createTacticalDroneIcon = (td: TacticalDrone) => {
    const pilotName = td.pilot?.full_name?.split(' ')[0] || 'PIC';
    const alt = td.flight_altitude || 60; const rad = td.radius || 200;
    const color = td.status === 'active' ? '#22c55e' : '#f59e0b';
    const isMain = td.id === 'main-drone-virtual';
    const hasStream = !!td.stream_url;
    const cacheKey = `${isMain}-${pilotName}-${alt}-${rad}-${td.status}-${hasStream}`;
    
    if (droneIconCache[cacheKey]) return droneIconCache[cacheKey];
    const icon = L.divIcon({ 
        className: 'drone-tactical-marker', 
        html: `<div style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 6px 12px rgba(0,0,0,0.4));">
            ${hasStream ? `<div style="position: absolute; top: -15px; background: #ef4444; border-radius: 50%; width: 10px; height: 10px; border: 1.5px solid white; z-index: 10;" class="animate-pulse"></div>` : ''}
            <div style="background: ${isMain ? '#b91c1c' : '#0f172a'}; color: white; font-size: 9px; font-weight: 900; padding: 2px 8px; border-radius: 4px; margin-bottom: 4px; border: 1.5px solid rgba(255,255,255,0.4); white-space: nowrap; text-transform: uppercase; letter-spacing: -0.2px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                ${pilotName}${isMain ? ' (PRINCIPAL)' : ''}
            </div>
            <div style="background-color: ${isMain ? '#ef4444' : color}; width: 40px; height: 40px; border: 3px solid white; border-radius: 10px; transform: rotate(45deg); display: flex; align-items: center; justify-content: center;">
                <div style="transform: rotate(-45deg);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="width: 22px; height: 22px;">
                        <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
                        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                    </svg>
                </div>
            </div>
            <div style="background: white; color: #1e293b; font-size: 9px; font-weight: 900; padding: 3px 6px; border-radius: 4px; margin-top: 5px; border: 1px solid #cbd5e1; white-space: nowrap; display: flex; gap: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.15);">
                <span style="color: #2563eb;">${alt}M</span>
                <span style="color: #dc2626;">R:${rad}M</span>
            </div>
        </div>`, 
        iconSize: [110, 110], 
        iconAnchor: [55, 55] 
    });
    droneIconCache[cacheKey] = icon;
    return icon;
};

// Componente de Janela Flutuante para Transmissão
const FloatingPiP = ({ stream, onClose }: { stream: { id: string, name: string, url: string }, onClose: () => void }) => {
    const [pos, setPos] = useState({ x: 100, y: 100 });
    const [size, setSize] = useState({ w: 320, h: 180 });
    const draggingRef = useRef(false);
    const startRef = useRef({ x: 0, y: 0 });
    const videoData = extractVideoId(stream.url);

    const handleMouseDown = (e: React.MouseEvent) => {
        draggingRef.current = true;
        startRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!draggingRef.current) return;
        setPos({ x: e.clientX - startRef.current.x, y: e.clientY - startRef.current.y });
    };

    const handleMouseUp = () => {
        draggingRef.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    return (
        <div 
            className="fixed z-[9000] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col group animate-fade-in"
            style={{ left: pos.x, top: pos.y, width: size.w, height: size.h + 30, resize: 'both' }}
        >
            <div 
                className="h-8 bg-slate-800 flex items-center justify-between px-3 cursor-move shrink-0"
                onMouseDown={handleMouseDown}
            >
                <div className="flex items-center gap-2">
                    <Video className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-[10px] font-black text-slate-300 uppercase truncate">{stream.name}</span>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded text-slate-400">
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div className="flex-1 bg-black relative">
                {videoData?.type === 'youtube' ? (
                    <iframe
                        src={`https://www.youtube.com/embed/${videoData.id}?rel=0&modestbranding=1&autoplay=1`}
                        className="w-full h-full"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                ) : (
                    <iframe src={stream.url} className="w-full h-full" frameBorder="0" allowFullScreen />
                )}
            </div>
        </div>
    );
};

const MapDrawingBridge = ({ drawMode, setDrawMode }: { drawMode: string | null, setDrawMode: (mode: string | null) => void }) => {
    const map = useMap();
    useEffect(() => {
        if (!map || !map.pm) return;
        try {
            if (drawMode) { 
                const options = { snappable: true, cursorMarker: true, hintlineStyle: { color: '#3388ff', dashArray: [5, 5] } };
                switch(drawMode) {
                    case 'sector': map.pm.enableDraw('Polygon', options); break;
                    case 'route': map.pm.enableDraw('Line', options); break; 
                    case 'poi': map.pm.enableDraw('Marker', options); break;
                }
            } else map.pm.disableDraw();
        } catch (error) {
            console.error("Geoman Draw Error:", error);
            map.pm.disableDraw();
            setDrawMode(null);
        }
        return () => { if (map && map.pm) map.pm.disableDraw(); };
    }, [drawMode, map, setDrawMode]); 
    return null;
};

const MapController = ({ center, isCreating, onMapReady }: { center: [number, number], isCreating: boolean, onMapReady?: (map: L.Map) => void }) => {
    const map = useMap();
    useEffect(() => { if (onMapReady) onMapReady(map); }, [map, onMapReady]);
    useEffect(() => {
        const timer = setTimeout(() => { if (map && map.getContainer()) map.invalidateSize(); }, 400);
        return () => clearTimeout(timer);
    }, [map]);
    useEffect(() => { 
        if (!map || isCreating) return; 
        if (map.getContainer()) map.flyTo(center, map.getZoom(), { duration: 1 }); 
    }, [center, map, isCreating]);
    return null;
};

export default function TacticalOperationCenter() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null); 
  const leafletMapRef = useRef<L.Map | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [sectors, setSectors] = useState<TacticalSector[]>([]);
  const [pois, setPois] = useState<TacticalPOI[]>([]);
  const [tacticalDrones, setTacticalDrones] = useState<TacticalDrone[]>([]);
  const [kmlLayers, setKmlLayers] = useState<TacticalKmlLayer[]>([]);
  const [availableDrones, setAvailableDrones] = useState<Drone[]>([]);
  const [availablePilots, setAvailablePilots] = useState<Pilot[]>([]);
  const [timeline, setTimeline] = useState<{id: string, text: string, time: string, icon: any}[]>([]);
  const [pcPosition, setPcPosition] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'plan' | 'timeline' | 'weather'>('plan');
  const [activePanel, setActivePanel] = useState<'create' | 'manage' | 'import' | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<any>(null); 
  const [entityType, setEntityType] = useState<'sector' | 'poi' | 'drone' | 'kml' | null>(null);
  const [mapType, setMapType] = useState<'street' | 'satellite'>('street');
  const [currentDrawMode, setCurrentDrawMode] = useState<string | null>(null);
  const [visibleLayers, setVisibleLayers] = useState({ sectors: true, routes: true, pois: true, drones: true, base: true });
  const [newItemType, setNewItemType] = useState<'sector' | 'poi' | 'line'>('sector');
  const [newItemName, setNewItemName] = useState('');
  const [newItemColor, setNewItemColor] = useState('#ef4444');
  const [newItemSubType, setNewItemSubType] = useState('victim'); 
  const [tempGeometry, setTempGeometry] = useState<any>(null); 
  const [mainResources, setMainResources] = useState<{ pilot?: Pilot, drone?: Drone }>({});
  
  // PiP State
  const [activePiPs, setActivePiPs] = useState<Record<string, { id: string, name: string, url: string }>>({});

  // Import State
  const [importType, setImportType] = useState<'sector' | 'path' | 'full'>('sector');

  useEffect(() => { if (id) loadTacticalData(id); }, [id]);

  const loadTacticalData = async (opId: string) => {
    try {
      const [op, sects, points, tDrones, allDrones, allPilots, layers] = await Promise.all([
          base44.entities.Operation.filter({ id: opId }).then(res => res[0]), 
          tacticalService.getSectors(opId), 
          tacticalService.getPOIs(opId), 
          tacticalService.getTacticalDrones(opId), 
          base44.entities.Drone.list(), 
          base44.entities.Pilot.list(),
          tacticalService.getKmlLayers(opId)
      ]);
      if (!op) { navigate('/operations'); return; }
      const enriched = tDrones.map(td => ({ ...td, drone: allDrones.find(d => d.id === td.drone_id), pilot: allPilots.find(p => p.id === td.pilot_id) }));
      const mainPilot = allPilots.find(p => p.id === op.pilot_id);
      const mainDrone = allDrones.find(d => d.id === op.drone_id);
      setMainResources({ pilot: mainPilot, drone: mainDrone });
      setOperation(op); 
      if (!pcPosition) setPcPosition([op.latitude, op.longitude]);
      setSectors(sects); 
      setPois(points); 
      setTacticalDrones(enriched); 
      setAvailableDrones(allDrones); 
      setAvailablePilots(allPilots);
      setKmlLayers(layers);
    } catch (e) {} finally { setLoading(false); }
  };

  const handleTogglePiP = (id: string, name: string, url?: string) => {
      if (!url) return;
      setActivePiPs(prev => {
          const newPiPs = { ...prev };
          if (newPiPs[id]) {
              delete newPiPs[id];
          } else {
              newPiPs[id] = { id, name, url };
          }
          return newPiPs;
      });
  };

  const operationalSummary = useMemo(() => {
      const mainDroneCount = (operation?.drone_id) ? 1 : 0;
      const totalDrones = tacticalDrones.length + mainDroneCount;
      const totalAreaM2 = sectors.filter(s => s.type === 'sector' && s.geojson?.coordinates).reduce((acc, s) => acc + calculatePolygonArea(s.geojson.coordinates), 0);
      return { 
          totalAreaM2, 
          resources: { 
              drones: totalDrones, 
              sectors: sectors.filter(s => s.type === 'sector').length, 
              pois: pois.length, 
              k9: pois.filter(p => p.type === 'k9').length, 
              teams: pois.filter(p => p.type === 'ground_team').length, 
              vehicles: pois.filter(p => p.type === 'vehicle').length, 
              victims: pois.filter(p => p.type === 'victim').length 
          } 
      };
  }, [sectors, pois, tacticalDrones, operation]);

  const syncTacticalSummary = async () => {
      if (!id || !operation) return;
      try { await base44.entities.Operation.update(id, { tactical_summary: { drones_count: operationalSummary.resources.drones, sectors_count: operationalSummary.resources.sectors, pois_count: operationalSummary.resources.pois, teams_count: operationalSummary.resources.teams, vehicles_count: operationalSummary.resources.vehicles, k9_count: operationalSummary.resources.k9, victims_count: operationalSummary.resources.victims, total_area_m2: operationalSummary.totalAreaM2 } }); } catch (e) {}
  };

  const addLog = (text: string, icon: any) => {
      setTimeline(prev => [{ id: crypto.randomUUID(), text, time: new Date().toLocaleTimeString('pt-BR'), icon }, ...prev]);
  };

  const handleCaptureSnapshot = async () => {
      if (!id || isCapturing || !leafletMapRef.current) return;
      setIsCapturing(true); 
      addLog("ENQUADRANDO TEATRO OPERACIONAL...", Target);
      const map = leafletMapRef.current;
      const originalCenter = map.getCenter();
      const originalZoom = map.getZoom();
      try {
          const bounds = L.latLngBounds([]);
          sectors.forEach(s => { if (s.geojson?.coordinates) bounds.extend(L.geoJSON(s.geojson).getBounds()); });
          kmlLayers.forEach(l => { if (l.visible && l.geojson) bounds.extend(L.geoJSON(l.geojson).getBounds()); });
          pois.forEach(p => bounds.extend([p.lat, p.lng]));
          tacticalDrones.forEach(td => { if (td.current_lat && td.current_lng) bounds.extend([td.current_lat, td.current_lng]); });
          if (pcPosition) bounds.extend(pcPosition);
          if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [60, 60], animate: false });
              map.invalidateSize();
              await new Promise(r => setTimeout(r, 2000));
          }
          await syncTacticalSummary();
          const mapEl = mapRef.current?.querySelector('.leaflet-container') as HTMLElement;
          if (!mapEl) throw new Error("Mapa não encontrado");
          const canvas = await html2canvas(mapEl, { useCORS: true, allowTaint: true, scale: 2, backgroundColor: null, ignoreElements: (element) => element.classList.contains('leaflet-control-container') });
          const base64 = canvas.toDataURL('image/jpeg', 0.8);
          tacticalService.saveMapSnapshot(id, base64);
          map.setView(originalCenter, originalZoom, { animate: false });
          addLog("SNAPSHOT INTEGRAL SALVO.", CheckCircle);
          alert("Teatro operacional capturado com sucesso!");
      } catch (e) { console.error(e); alert("Falha ao capturar mapa."); } finally { setIsCapturing(false); }
  };

  const handleDrawCreated = (e: any) => {
    const geojson = e.layer.toGeoJSON(); 
    let type: 'poi' | 'line' | 'sector' = 'sector';
    if (e.layerType === 'marker' || e.shape === 'Marker') type = 'poi';
    else if (e.layerType === 'line' || e.shape === 'Line' || e.shape === 'Polyline') type = 'line';
    else type = 'sector';
    setNewItemType(type); setTempGeometry(geojson); setCurrentDrawMode(null);
    if (type !== 'poi') { setNewItemName(PHONETIC[sectors.length % PHONETIC.length]); setNewItemColor(TACTICAL_COLORS[sectors.length % TACTICAL_COLORS.length]); }
    else setNewItemName(""); 
    setSidebarOpen(true); setActivePanel('create');
  };

  const saveNewItem = async () => {
      if (!tempGeometry || !id || !newItemName) { alert("Identificação obrigatória."); return; }
      try {
          if (newItemType === 'poi') { 
            const [lng, lat] = tempGeometry.geometry.coordinates; 
            await tacticalService.createPOI({ operation_id: id, name: newItemName, type: newItemSubType as any, lat, lng }); 
          } else { 
            await tacticalService.createSector({ operation_id: id, name: newItemName, type: newItemType === 'line' ? 'route' : 'sector', color: newItemColor, geojson: tempGeometry.geometry, responsible: "N/A" }); 
          }
          setActivePanel(null); setTempGeometry(null); await loadTacticalData(id); syncTacticalSummary();
          addLog(`NOVO ELEMENTO: ${newItemName}`, newItemType === 'poi' ? Flag : Hexagon);
      } catch (e) { alert("Falha ao persistir."); }
  };

  const parseKml = (text: string) => {
    try {
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "text/xml");
        
        if (xml.getElementsByTagName("parsererror").length > 0) return null;

        const placemarks = Array.from(xml.getElementsByTagName("Placemark"));
        const features: any[] = [];

        placemarks.forEach(pm => {
            const name = pm.getElementsByTagName("name")[0]?.textContent || "Elemento Importado";
            const polygonTags = pm.getElementsByTagName("Polygon");
            const lineTags = pm.getElementsByTagName("LineString");
            const pointTags = pm.getElementsByTagName("Point");

            const processCoords = (coordsTag: Element) => {
                const raw = coordsTag.textContent?.trim() || "";
                return raw.split(/\s+/).map(p => {
                    const parts = p.split(",").map(Number);
                    return [parts[0], parts[1]];
                }).filter(p => !isNaN(p[0]) && !isNaN(p[1]));
            };

            if (polygonTags.length > 0) {
                const coords = processCoords(polygonTags[0].getElementsByTagName("coordinates")[0]);
                if (coords.length >= 3) {
                    features.push({ 
                        type: "Feature", 
                        geometry: { type: "Polygon", coordinates: [coords] }, 
                        properties: { name, type: 'sector' } 
                    });
                }
            } else if (lineTags.length > 0) {
                const coords = processCoords(lineTags[0].getElementsByTagName("coordinates")[0]);
                if (coords.length >= 2) {
                    features.push({ 
                        type: "Feature", 
                        geometry: { type: "LineString", coordinates: coords }, 
                        properties: { name, type: 'path' } 
                    });
                }
            } else if (pointTags.length > 0) {
                const coords = processCoords(pointTags[0].getElementsByTagName("coordinates")[0]);
                if (coords.length > 0) {
                    features.push({ 
                        type: "Feature", 
                        geometry: { type: "Point", coordinates: coords[0] }, 
                        properties: { name, type: 'poi' } 
                    });
                }
            }
        });

        return features.length > 0 ? { type: "FeatureCollection", features } : null;
    } catch (e) {
        console.error("KML Parse Error:", e);
        return null;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    if (file.name.toLowerCase().endsWith('.kmz')) {
        alert("Arquivos .KMZ do Google Earth são compactados. Por favor, exporte como .KML (formato texto) para garantir a leitura no sistema.");
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const content = ev.target?.result as string;
      
      if (content.startsWith('PK')) {
          alert("Erro: Este é um arquivo binário (KMZ). Por favor, use a opção 'Salvar como... .KML' no Google Earth.");
          return;
      }

      const geojson = parseKml(content);
      if (geojson) {
        await tacticalService.saveKmlLayer({
          operation_id: id,
          name: file.name.replace(".kml", "").replace(".kmz", ""),
          type: importType,
          geojson,
          visible: true,
          color: importType === 'sector' ? '#3b82f6' : (importType === 'path' ? '#f59e0b' : '#10b981')
        });
        loadTacticalData(id);
        addLog(`CAMADA IMPORTADA: ${file.name}`, Files);
      } else alert("Não foi possível extrair geometrias deste arquivo. Verifique se o formato está correto.");
    };
    reader.readAsText(file);
  };

  const toggleKmlVisibility = async (layer: TacticalKmlLayer) => {
    await tacticalService.updateKmlLayer(layer.id, { visible: !layer.visible });
    loadTacticalData(id!);
  };

  const deleteKmlLayer = async (layerId: string) => {
    if (confirm("Remover esta camada do teatro operacional?")) {
      await tacticalService.deleteKmlLayer(layerId);
      loadTacticalData(id!);
    }
  };

  const handleDroneDragEnd = async (e: any, drone: TacticalDrone) => {
      const pos = e.target.getLatLng();
      setTimeout(async () => {
          let detectedSectorId = "";
          for (const sector of sectors) { 
            if (sector.type === 'sector' && isPointInPolygon(pos.lat, pos.lng, sector.geojson.coordinates)) { detectedSectorId = sector.id; break; } 
          }
          await tacticalService.updateDroneStatus(drone.id, { current_lat: pos.lat, current_lng: pos.lng, sector_id: detectedSectorId || undefined });
          loadTacticalData(id!);
      }, 0);
  };

  const handleAssignDrone = async (droneId: string, pilotId: string) => {
      if (!droneId || !id) return;
      await tacticalService.assignDrone({ operation_id: id, drone_id: droneId, pilot_id: pilotId, status: 'active', current_lat: operation?.latitude, current_lng: operation?.longitude, flight_altitude: 60, radius: 200, stream_url: availableDrones.find(d => d.id === droneId)?.prefix.includes("01") ? "https://www.youtube.com/live/v1AyuKms2nE" : undefined });
      await loadTacticalData(id); syncTacticalSummary();
  };

  const handleMainDroneDragEnd = async (e: any) => {
      const pos = e.target.getLatLng();
      setTimeout(async () => {
          setPcPosition([pos.lat, pos.lng]);
          if (operation) { try { await base44.entities.Operation.update(operation.id, { latitude: pos.lat, longitude: pos.lng }); } catch(e) {} }
      }, 0);
  };

  if (loading || !operation) return <div className="h-screen bg-slate-950 flex items-center justify-center text-white font-black"><Crosshair className="w-8 h-8 animate-spin mr-3 text-red-600"/> SINCRONIZANDO TEATRO OPERACIONAL...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden text-slate-800 font-sans">
      
      {/* Janelas Flutuantes de Transmissão */}
      {Object.values(activePiPs).map(pip => (
          <FloatingPiP key={pip.id} stream={pip} onClose={() => handleTogglePiP(pip.id, pip.name)} />
      ))}

      <div className="h-14 bg-[#7f1d1d] border-b border-red-900/40 flex items-center justify-between px-4 shadow-2xl z-[1000] shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/operations')} className="h-9 w-9 p-0 border-white/20 bg-white/10 text-white rounded-full"><ArrowLeft className="w-4 h-4" /></Button>
          <div className="min-w-0">
            <h1 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-tighter leading-none"><Crosshair className="w-4 h-4 text-red-400" /> CCO TÁTICO</h1>
            <p className="text-[9px] text-red-100 font-bold uppercase opacity-60 mt-1 truncate max-w-[200px]">{operation.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleCaptureSnapshot} disabled={isCapturing} className={`h-9 px-4 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 border shadow-lg ${isCapturing ? 'bg-slate-700 text-slate-400' : 'bg-blue-600 text-white border-blue-400 hover:bg-blue-700'}`}>{isCapturing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Camera className="w-4 h-4" />} {isCapturing ? 'CAPTURANDO...' : 'CAPTURAR SNAPSHOT'}</Button>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`h-9 px-5 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 transition-all shadow-xl border border-white/10 ${sidebarOpen ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-white text-red-700'}`}>{sidebarOpen ? <><X className="w-4 h-4 text-white"/> FECHAR PAINEL</> : <><Maximize className="w-4 h-4"/> ABRIR PAINEL</>}</button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden relative">
          <div className={`${sidebarOpen ? 'w-80' : 'w-0'} bg-white border-r border-slate-200 flex flex-col shadow-2xl z-[500] transition-all duration-300 overflow-hidden shrink-0`}>
              <div className="flex bg-slate-100 p-1.5 m-3 rounded-xl shrink-0"><button onClick={() => { setActiveTab('plan'); setActivePanel(null); }} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'plan' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500'}`}>Teatro</button><button onClick={() => { setActiveTab('timeline'); setActivePanel(null); }} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'timeline' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500'}`}>Logs</button><button onClick={() => { setActiveTab('weather'); setActivePanel(null); }} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'weather' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500'}`}>MET</button></div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 relative bg-white space-y-5">
                  {activeTab === 'plan' && !activePanel && (
                      <div className="space-y-5 animate-fade-in">
                          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4 shadow-sm">
                              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b pb-2"><LayoutDashboard className="w-3.5 h-3.5"/> Resumo de Cena</h3>
                              <div className="grid grid-cols-2 gap-3">
                                  <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-inner"><p className="text-[8px] font-black text-slate-400 uppercase">Área Total</p><p className="text-sm font-black text-blue-600">{formatArea(operationalSummary.totalAreaM2)}</p></div>
                                  <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-inner"><p className="text-[8px] font-black text-slate-400 uppercase">Drones no Ar</p><p className="text-sm font-black text-red-600">{operationalSummary.resources.drones} Unid.</p></div>
                              </div>
                          </div>

                          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-sm">
                              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between border-b pb-2">
                                <span className="flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-blue-600"/> Camadas Externas</span>
                                <button onClick={() => setActivePanel('import')} className="p-1 hover:bg-slate-100 rounded text-blue-600"><Plus className="w-3.5 h-3.5"/></button>
                              </h3>
                              <div className="space-y-2">
                                  {kmlLayers.length === 0 && <p className="text-[10px] text-slate-400 italic text-center py-2">Nenhuma camada importada.</p>}
                                  {kmlLayers.map(layer => (
                                      <div key={layer.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                                          <div className="flex items-center gap-3 min-w-0">
                                              <button onClick={() => toggleKmlVisibility(layer)} className={`${layer.visible ? 'text-blue-600' : 'text-slate-300'}`}>
                                                  {layer.visible ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                                              </button>
                                              <div className="min-w-0">
                                                  <p className="text-[10px] font-bold text-slate-700 truncate uppercase">{layer.name}</p>
                                                  <p className="text-[8px] text-slate-400 uppercase font-black">
                                                      {layer.type === 'sector' ? 'Setorização' : (layer.type === 'path' ? 'Percurso' : 'Completo')}
                                                  </p>
                                              </div>
                                          </div>
                                          <button onClick={() => deleteKmlLayer(layer.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>
                                      </div>
                                  ))}
                              </div>
                          </div>

                          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3 shadow-2xl">
                              <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2"><Plus className="w-3.5 h-3.5"/> Ativar Vetor RPA</h3>
                              <div className="space-y-2">
                                  <Select className="h-9 text-[11px] bg-slate-800 border-slate-700 text-white" id="drone-select"><option value="">Aeronave...</option>{availableDrones.filter(d => d.status === 'available').map(d => <option key={d.id} value={d.id}>{d.prefix} - {d.model}</option>)}</Select>
                                  <Select className="h-9 text-[11px] bg-slate-800 border-slate-700 text-white" id="pilot-select"><option value="">Comandante...</option>{availablePilots.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</Select>
                                  <Button className="w-full h-10 bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest shadow-lg" onClick={() => handleAssignDrone((document.getElementById('drone-select') as HTMLSelectElement).value, (document.getElementById('pilot-select') as HTMLSelectElement).value)}>Lançar no Mapa</Button>
                              </div>
                          </div>
                      </div>
                  )}

                  {activeTab === 'timeline' && (<div className="p-2 space-y-4 animate-fade-in bg-white">{timeline.map(e => (<div key={e.id} className="flex gap-3 bg-white p-3 rounded-xl border border-slate-100 items-start shadow-sm"><div className="p-2 bg-slate-50 rounded-lg shadow-sm"><e.icon className="w-4 h-4 text-red-500" /></div><div className="min-w-0"><p className="font-bold text-[11px] text-slate-800 leading-tight">{e.text}</p><p className="text-[9px] text-slate-400 font-black mt-1.5 uppercase">{e.time}</p></div></div>))}</div>)}
                  
                  {(activePanel === 'create' || activePanel === 'manage' || activePanel === 'import') && (
                      <div className="absolute inset-0 bg-white z-[600] animate-fade-in flex flex-col p-5 space-y-5 border-l-4 border-red-600 shadow-2xl">
                          <div className="flex justify-between items-center border-b pb-3">
                              <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                                  {activePanel === 'create' ? <><Plus className="w-4 h-4 text-blue-600"/> Identificar Elemento</> : 
                                   activePanel === 'import' ? <><FileUp className="w-4 h-4 text-orange-600"/> Importar KML / Google Earth</> :
                                   <><Settings className="w-4 h-4 text-slate-600"/> Gerenciar Ativo</>}
                              </h2>
                              <button onClick={() => { setActivePanel(null); setTempGeometry(null); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400"/></button>
                          </div>
                          <div className="space-y-5 overflow-y-auto pr-1">
                              {activePanel === 'import' && (
                                  <div className="space-y-6">
                                      <div className="space-y-3">
                                          <label className="text-[10px] font-black uppercase text-slate-500">Tipo de Camada</label>
                                          <div className="grid grid-cols-3 gap-1.5">
                                              <button onClick={() => setImportType('sector')} className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${importType === 'sector' ? 'bg-blue-600 text-white border-blue-700 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                  <Hexagon className="w-5 h-5"/><span className="text-[8px] font-black uppercase">Setores</span>
                                              </button>
                                              <button onClick={() => setImportType('path')} className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${importType === 'path' ? 'bg-orange-600 text-white border-orange-700 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                  <Navigation className="w-5 h-5"/><span className="text-[8px] font-black uppercase">Rastro</span>
                                              </button>
                                              <button onClick={() => setImportType('full')} className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${importType === 'full' ? 'bg-green-600 text-white border-green-700 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                  <LayoutDashboard className="w-5 h-5"/><span className="text-[8px] font-black uppercase">Completo</span>
                                              </button>
                                          </div>
                                      </div>
                                      <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl text-center bg-slate-50 space-y-4">
                                          <FileUp className="w-10 h-10 text-slate-300 mx-auto" />
                                          <div>
                                              <p className="text-xs font-bold text-slate-700">Selecione o Arquivo .KML</p>
                                              <p className="text-[9px] text-slate-400 mt-1 uppercase">Google Earth / Mapas Externos</p>
                                          </div>
                                          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".kml" className="hidden" />
                                          <Button onClick={() => fileInputRef.current?.click()} className="w-full bg-slate-900 text-[10px] font-black h-10">Procurar Arquivo</Button>
                                      </div>
                                  </div>
                              )}
                              {activePanel === 'create' && (<>
                                <Input label="Identificação Tática" autoFocus value={newItemName} onChange={e => setNewItemName(e.target.value)} className="font-black text-xs uppercase h-10 bg-slate-50 border-slate-200" labelClassName="text-[10px] font-black uppercase text-slate-500" />
                                {newItemType === 'poi' && (
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'base', label: 'Base / PC', icon: MapPin }, 
                                            { id: 'victim', label: 'Vítima', icon: UserCheck }, 
                                            { id: 'hazard', label: 'Zona Perigo', icon: ShieldAlert }, 
                                            { id: 'ground_team', label: 'Equipe Solo', icon: Users }, 
                                            { id: 'vehicle', label: 'Viatura BM', icon: Truck }, 
                                            { id: 'k9', label: 'Cão Busca', icon: Dog },
                                            { id: 'footprint', label: 'Pegada', icon: Footprints },
                                            { id: 'object', label: 'Objeto', icon: Package }
                                        ].map(t => (
                                            <button key={t.id} onClick={() => setNewItemSubType(t.id)} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${newItemSubType === t.id ? 'bg-red-600 text-white shadow-xl' : 'bg-slate-50 text-slate-500'}`}>
                                                <t.icon className="w-5 h-5" />
                                                <span className="text-[9px] font-black uppercase">{t.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <Button onClick={saveNewItem} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[11px] tracking-widest shadow-xl">Salvar Elemento</Button>
                              </>)}
                              {activePanel === 'manage' && entityType === 'drone' && selectedEntity && (
                                  <div className="space-y-5">
                                      <div className="p-4 bg-slate-900 rounded-3xl flex items-center justify-between text-white border border-slate-800 shadow-2xl">
                                          <div>
                                              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Aeronave Ativa</p>
                                              <h4 className="text-lg font-black">{selectedEntity.drone?.prefix}</h4>
                                          </div>
                                          {selectedEntity.stream_url && (
                                              <button 
                                                onClick={() => handleTogglePiP(selectedEntity.id, selectedEntity.drone?.prefix || 'Drone', selectedEntity.stream_url)}
                                                className={`p-2 rounded-full transition-all ${activePiPs[selectedEntity.id] ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                                                title="Monitorar Transmissão"
                                              >
                                                  <Video className="w-5 h-5" />
                                              </button>
                                          )}
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                          <Input label="Altitude (m)" type="number" value={selectedEntity.flight_altitude} onChange={e => { const val = Number(e.target.value); tacticalService.updateDroneStatus(selectedEntity.id, { flight_altitude: val }); setSelectedEntity({...selectedEntity, flight_altitude: val}); loadTacticalData(id!); }} className="text-xs h-10 font-black" />
                                          <Input label="Raio (m)" type="number" value={selectedEntity.radius} onChange={e => { const val = Number(e.target.value); tacticalService.updateDroneStatus(selectedEntity.id, { radius: val }); setSelectedEntity({...selectedEntity, radius: val}); loadTacticalData(id!); }} className="text-xs h-10 font-black" />
                                      </div>
                                      <Button variant="danger" onClick={async () => { if(confirm("Desmobilizar?")) { await tacticalService.removeDroneFromOp(selectedEntity.id); setActivePanel(null); loadTacticalData(id!); syncTacticalSummary(); } }} className="w-full h-11 text-[10px] font-black uppercase">Desmobilizar Unidade</Button>
                                  </div>
                              )}
                              {activePanel === 'manage' && entityType === 'poi' && selectedEntity && (
                                  <div className="space-y-5">
                                      <div className="p-4 bg-slate-100 rounded-2xl flex items-center justify-between border border-slate-200">
                                          <div>
                                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ponto de Interesse</p>
                                              <h4 className="text-sm font-bold text-slate-800">{selectedEntity.name}</h4>
                                          </div>
                                          {selectedEntity.stream_url && (
                                              <button 
                                                onClick={() => handleTogglePiP(selectedEntity.id, selectedEntity.name, selectedEntity.stream_url)}
                                                className={`p-2 rounded-full transition-all ${activePiPs[selectedEntity.id] ? 'bg-red-600 text-white' : 'bg-blue-100 text-blue-600'}`}
                                                title="Transmissão Solo/Unidade"
                                              >
                                                  <Video className="w-5 h-5" />
                                              </button>
                                          )}
                                      </div>
                                      <div className="space-y-3">
                                          <Input label="Identificação" value={selectedEntity.name} onChange={e => { const val = e.target.value; setSelectedEntity({...selectedEntity, name: val}); tacticalService.updatePOI(selectedEntity.id, { name: val }); }} className="text-xs h-10 font-bold" />
                                          <textarea 
                                              className="w-full p-3 border border-slate-200 rounded-xl text-xs h-24 bg-slate-50 focus:ring-2 focus:ring-blue-500"
                                              placeholder="Observações do ponto..."
                                              value={selectedEntity.description || ''}
                                              onChange={e => { const val = e.target.value; setSelectedEntity({...selectedEntity, description: val}); tacticalService.updatePOI(selectedEntity.id, { description: val }); }}
                                          />
                                          <Input 
                                              label="URL de Transmissão (PiP)"
                                              placeholder="YouTube / RTSP..."
                                              value={selectedEntity.stream_url || ''}
                                              onChange={e => { const val = e.target.value; setSelectedEntity({...selectedEntity, stream_url: val}); tacticalService.updatePOI(selectedEntity.id, { stream_url: val }); }}
                                              className="text-xs h-9"
                                          />
                                      </div>
                                      <Button variant="outline" onClick={async () => { if(confirm("Remover este ponto?")) { await tacticalService.deletePOI(selectedEntity.id); setActivePanel(null); loadTacticalData(id!); } }} className="w-full h-10 text-[10px] font-black text-red-600 uppercase border-red-100 hover:bg-red-50">Excluir Ponto</Button>
                                  </div>
                              )}
                          </div>
                      </div>
                  )}
              </div>
          </div>
          <div className="flex-1 relative z-0 bg-slate-100" ref={mapRef}>
              <div className="absolute top-5 left-1/2 -translate-x-1/2 z-[2000] flex pointer-events-none">
                  <div className="bg-white/95 backdrop-blur-2xl border border-slate-200 rounded-2xl shadow-2xl flex items-center p-2 gap-1 pointer-events-auto ring-4 ring-black/5">
                      <div className="px-5 border-r border-slate-200 flex items-center gap-3">
                          <MousePointer2 className="w-5 h-5 text-sysarp-primary" />
                          <span className="text-[11px] font-black text-slate-900 uppercase tracking-tighter">CCO Tático</span>
                      </div>
                      <div className="flex items-center gap-1">
                          <button onClick={() => setCurrentDrawMode(currentDrawMode === 'sector' ? null : 'sector')} className={`p-3 rounded-xl transition-all group relative ${currentDrawMode === 'sector' ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-300' : 'hover:bg-blue-50 text-blue-600'}`}>
                              <Hexagon className="w-6 h-6"/><span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-2 py-1 rounded font-black opacity-0 group-hover:opacity-100 z-50 uppercase whitespace-nowrap">Área</span>
                          </button>
                          <button onClick={() => setCurrentDrawMode(currentDrawMode === 'route' ? null : 'route')} className={`p-3 rounded-xl transition-all group relative ${currentDrawMode === 'route' ? 'bg-orange-600 text-white shadow-lg ring-2 ring-orange-300' : 'hover:bg-orange-50 text-orange-600'}`}>
                              <Navigation className="w-6 h-6"/><span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-2 py-1 rounded font-black opacity-0 group-hover:opacity-100 z-50 uppercase whitespace-nowrap">Rota</span>
                          </button>
                          <button onClick={() => setCurrentDrawMode(currentDrawMode === 'poi' ? null : 'poi')} className={`p-3 rounded-xl transition-all group relative ${currentDrawMode === 'poi' ? 'bg-red-600 text-white shadow-lg ring-2 ring-red-300' : 'hover:bg-blue-50 text-red-600'}`}>
                              <Flag className="w-6 h-6"/><span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-2 py-1 rounded font-black opacity-0 group-hover:opacity-100 z-50 uppercase whitespace-nowrap">Ponto</span>
                          </button>
                          {currentDrawMode && (<button onClick={() => setCurrentDrawMode(null)} className="p-3 bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600 rounded-xl border border-slate-200 ml-2 animate-fade-in"><X className="w-6 h-6"/></button>)}
                      </div>
                  </div>
              </div>
              <div className="absolute top-1/2 right-4 transform -translate-y-1/2 z-[2000] pointer-events-auto flex flex-col gap-2">
                  <button onClick={() => setMapType(prev => prev === 'street' ? 'satellite' : 'street')} className="bg-white hover:bg-slate-50 text-slate-700 w-12 h-12 flex items-center justify-center rounded-2xl shadow-xl border border-slate-200 transition-all hover:scale-105 active:scale-95 group relative">
                      {mapType === 'street' ? <Layers className="w-6 h-6" /> : <Satellite className="w-6 h-6" />}
                      <span className="absolute right-14 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">{mapType === 'street' ? 'Mudar para Satélite' : 'Mudar para Mapa'}</span>
                  </button>
              </div>
              <MapContainer center={[operation.latitude, operation.longitude]} zoom={17} style={{ height: '100%', width: '100%', background: 'transparent' }} preferCanvas={true}>
                  <MapController center={[operation.latitude, operation.longitude]} isCreating={!!tempGeometry} onMapReady={(map) => { leafletMapRef.current = map; }} />
                  <MapDrawingBridge drawMode={currentDrawMode} setDrawMode={setCurrentDrawMode} />
                  <TileLayer url={mapType === 'street' ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"} crossOrigin="anonymous" />
                  <SectorsLayer onCreated={handleDrawCreated} />
                  {visibleLayers.base && pcPosition && (<Marker position={pcPosition} icon={createTacticalDroneIcon({ id: 'main-drone-virtual', operation_id: operation.id, drone_id: operation.drone_id, pilot_id: operation.pilot_id, status: 'active', flight_altitude: operation.flight_altitude, radius: operation.radius, drone: mainResources.drone, pilot: mainResources.pilot, stream_url: operation.stream_url })} draggable={true} eventHandlers={{ click: () => { setSelectedEntity({...operation}); setEntityType('drone'); setActivePanel('manage'); }, dragend: handleMainDroneDragEnd }} />)}
                  {visibleLayers.sectors && sectors.filter(s => s.type !== 'route').map(s => (<Polygon key={s.id} positions={L.GeoJSON.coordsToLatLngs(s.geojson.coordinates, 1) as any} pathOptions={{ color: s.color, fillOpacity: 0.25, weight: 3 }} eventHandlers={{ click: () => { setSelectedEntity({...s}); setEntityType('sector'); setActivePanel('manage'); } }} />))}
                  {visibleLayers.routes && sectors.filter(s => s.type === 'route').map(s => (<Polyline key={s.id} positions={L.GeoJSON.coordsToLatLngs(s.geojson.coordinates, 0) as any} pathOptions={{ color: s.color, weight: 6, dashArray: '8, 12' }} eventHandlers={{ click: () => { setSelectedEntity({...s}); setEntityType('sector'); setActivePanel('manage'); } }} />))}
                  {visibleLayers.pois && pois.map(p => (<Marker key={p.id} position={[p.lat, p.lng]} icon={getPoiIcon(p.type)} eventHandlers={{ click: () => { setSelectedEntity({...p}); setEntityType('poi'); setActivePanel('manage'); } }} />))}
                  {visibleLayers.drones && tacticalDrones.map(td => td.current_lat && (<Marker key={td.id} position={[td.current_lat, td.current_lng]} icon={createTacticalDroneIcon(td)} draggable={true} eventHandlers={{ click: () => { setSelectedEntity({...td}); setEntityType('drone'); setActivePanel('manage'); }, dragend: (e) => handleDroneDragEnd(e, td) }} />))}
                  
                  {kmlLayers.filter(l => l.visible && l.geojson?.features).map(layer => (
                      <React.Fragment key={layer.id}>
                          {layer.geojson.features.map((f: any, fidx: number) => {
                              try {
                                  if (!f.geometry?.coordinates || f.geometry.coordinates.length === 0) return null;
                                  
                                  if (f.geometry.type === 'Polygon') {
                                      return <Polygon key={`${layer.id}-f-${fidx}`} positions={L.GeoJSON.coordsToLatLngs(f.geometry.coordinates, 1) as any} pathOptions={{ color: layer.color, weight: 2, fillOpacity: 0.15 }} />;
                                  } else if (f.geometry.type === 'LineString') {
                                      return <Polyline key={`${layer.id}-f-${fidx}`} positions={L.GeoJSON.coordsToLatLngs(f.geometry.coordinates, 0) as any} pathOptions={{ color: layer.color, weight: 3, dashArray: '5, 5' }} />;
                                  } else if (f.geometry.type === 'Point') {
                                      const [lng, lat] = f.geometry.coordinates;
                                      return <Marker key={`${layer.id}-f-${fidx}`} position={[lat, lng]} icon={getPoiIcon('interest')} />;
                                  }
                                  return null;
                              } catch(e) { return null; }
                          })}
                      </React.Fragment>
                  ))}
              </MapContainer>
          </div>
      </div>
    </div>
  );
}
