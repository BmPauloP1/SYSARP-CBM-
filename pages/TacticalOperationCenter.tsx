import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import "@geoman-io/leaflet-geoman-free";
import html2canvas from 'html2canvas'; 
import { base44 } from '../services/base44Client';
import { supabase } from '../services/supabase';
import { tacticalService, TacticalSector, TacticalDrone, TacticalPOI, TacticalKmlLayer } from '../services/tacticalService';
import { Operation, Drone, Pilot, MISSION_COLORS, MISSION_HIERARCHY } from '../types';
import { Card, Button, Input, Select, Badge } from '../components/ui_components';
import { 
  ArrowLeft, Radio, Plus, Trash2, Crosshair, Hexagon, Flag, 
  MapPin, Settings, X, Save, Eye, EyeOff, Move, Navigation,
  AlertTriangle, ShieldAlert, Target, Video, ListFilter, History, Zap, 
  Map as MapIcon, Globe, ChevronRight, ChevronLeft, Maximize, Minimize, MousePointer2,
  Users, Truck, Dog, UserCheck, Ruler, LayoutDashboard, Camera, CheckCircle, Loader2, Layers, Satellite, FileUp, Files,
  Footprints, Package, GripHorizontal, Activity, Wifi, Gauge, Thermometer, Wind, Battery, Plane, Heart, AlertOctagon, Search
} from 'lucide-react';
import SectorsLayer from '../components/maps/tactical/SectorsLayer';

const PHONETIC = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL', 'INDIA', 'JULIETT', 'KILO', 'LIMA', 'MIKE', 'NOVEMBER', 'OSCAR', 'PAPA', 'QUEBEC', 'ROMEO', 'SIERRA', 'TANGO', 'UNIFORM', 'VICTOR', 'WHISKEY', 'X-RAY', 'YANKEE', 'ZULU'];
const TACTICAL_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#6366f1'];

const poiIconCache: Record<string, L.DivIcon> = {};
const droneIconCache: Record<string, L.DivIcon> = {};

// Utilitários de Cálculo de Área
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
        return Math.abs(area * radius * radius / 2.0);
    } catch (e) { return 0; }
};

const formatArea = (m2: number) => {
    if (m2 >= 10000) return `${(m2 / 10000).toFixed(2)} ha`;
    return `${Math.round(m2).toLocaleString('pt-BR')} m²`;
};

// Ícones de POI com alerta visual de transmissão
const getPoiIcon = (type: string, hasStream?: boolean) => {
    const cacheKey = `${type}-${hasStream}`;
    if (poiIconCache[cacheKey]) return poiIconCache[cacheKey];
    
    let color = '#64748b';
    let iconSvg = '';

    switch(type) {
        case 'base': color = '#b91c1c'; iconSvg = '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'; break;
        case 'victim': color = '#ef4444'; iconSvg = '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'; break;
        case 'hazard': color = '#f59e0b'; iconSvg = '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'; break;
        case 'ground_team': color = '#2563eb'; iconSvg = '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'; break;
        case 'vehicle': color = '#dc2626'; iconSvg = '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M9 18h6"/><path d="M19 18h2a1 1 0 0 0 1-1v-5l-3-4h-5"/>'; break;
        case 'k9': color = '#78350f'; iconSvg = '<path d="M10 5.172l.596.596a2 2 0 0 0 2.828 0L14 5.172M20 21l-2-6M6 21l2-6M12 21v-6M4 4l3 3M20 4l-3 3M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z"/>'; break;
        case 'footprint': color = '#4b5563'; iconSvg = '<path d="M4 16v-2.382a2 2 0 0 1 1.106-1.789l5.788-2.894A2 2 0 0 1 12 8.146V6M16 21v-2.382a2 2 0 0 1 1.106-1.789l2.788-1.394A2 2 0 0 1 13 13.646V11.5M12 21v-2.382a2 2 0 0 1 1.106-1.789l1.788-0.894A2 2 0 0 1 16 15.146V13M8 21v-2.382a2 2 0 0 1 1.106-1.789l2.788-1.394A2 2 0 0 1 13 13.646V11.5"/>'; break;
        case 'object': color = '#0891b2'; iconSvg = '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>'; break;
        default: iconSvg = '<circle cx="12" cy="12" r="10"/>';
    }

    const icon = L.divIcon({ 
        className: 'custom-poi-marker', 
        html: `<div style="position: relative; background-color: ${color}; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border: 2.5px solid white;">
            ${hasStream ? `<div style="position: absolute; top: -12px; background: #ef4444; border-radius: 50%; width: 12px; height: 12px; border: 2px solid white;" class="animate-pulse shadow-lg"></div>` : ''}
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;">${iconSvg}</svg>
        </div>`, 
        iconSize: [38, 38], 
        iconAnchor: [19, 19] 
    });
    poiIconCache[cacheKey] = icon;
    return icon;
};

// Ícone para Drones com Telemetria e Alerta de Live
const createTacticalDroneIcon = (td: any) => {
    const pilotName = td.pilot?.full_name?.split(' ')[0] || td.pilot_id || 'PIC';
    const alt = Math.round(td.altitude || td.flight_altitude || 60);
    const bat = td.battery_percent || td.battery || td.battery_level || 100;
    const isMain = td.id?.startsWith('main-op-drone');
    const color = isMain ? '#ef4444' : (td.drone_sn ? '#2563eb' : '#10b981');
    const hasStream = !!td.stream_url;
    
    const cacheKey = `${pilotName}-${alt}-${bat}-${hasStream}-${color}-${isMain}`;
    if (droneIconCache[cacheKey]) return droneIconCache[cacheKey];

    const icon = L.divIcon({ 
        className: 'drone-tactical-marker', 
        html: `<div style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 6px 12px rgba(0,0,0,0.4)); position: relative;">
            ${hasStream ? `<div style="position: absolute; top: -15px; background: #ef4444; border-radius: 50%; width: 12px; height: 12px; border: 2px solid white; z-index: 10;" class="animate-pulse shadow-lg"></div>` : ''}
            <div style="background: #0f172a; color: white; font-size: 9px; font-weight: 900; padding: 2px 8px; border-radius: 4px; margin-bottom: 4px; border: 1.5px solid rgba(255,255,255,0.4); white-space: nowrap; text-transform: uppercase; letter-spacing: -0.2px;">
                ${pilotName}${isMain ? ' (PRINCIPAL)' : ''}
            </div>
            <div style="background-color: ${color}; width: 40px; height: 40px; border: 3px solid white; border-radius: 10px; transform: rotate(45deg); display: flex; align-items: center; justify-content: center; transition: all 0.3s ease;">
                <div style="transform: rotate(-45deg);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="width: 22px; height: 22px;">
                        <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                    </svg>
                </div>
            </div>
            <div style="background: white; color: #1e293b; font-size: 9px; font-weight: 900; padding: 3px 6px; border-radius: 4px; margin-top: 5px; border: 1px solid #cbd5e1; white-space: nowrap; display: flex; gap: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.15);">
                <span style="color: #2563eb;">${alt}M</span>
                <span style="${bat < 20 ? 'color: #ef4444;' : 'color: #16a34a;'}">${bat}%</span>
            </div>
        </div>`, 
        iconSize: [110, 110], 
        iconAnchor: [55, 55] 
    });
    droneIconCache[cacheKey] = icon;
    return icon;
};

// Componente de Janela Flutuante Arrastável para Mosaico de Vídeo
const FloatingPiP: React.FC<{ stream: { id: string, name: string, url: string }, onClose: () => void }> = ({ stream, onClose }) => {
    const [pos, setPos] = useState({ x: 20 + (Math.random() * 60), y: 120 + (Math.random() * 60) });
    const draggingRef = useRef(false);
    const startRef = useRef({ x: 0, y: 0 });
    const [isMinimized, setIsMinimized] = useState(false);

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
        <div className="fixed z-[9000] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col group animate-fade-in ring-1 ring-white/10" style={{ left: pos.x, top: pos.y, width: isMinimized ? 180 : 340 }}>
            <div className="h-9 bg-slate-800 flex items-center justify-between px-3 cursor-move border-b border-slate-700 shrink-0" onMouseDown={handleMouseDown}>
                <div className="flex items-center gap-2 overflow-hidden">
                    <Video className="w-3.5 h-3.5 text-red-500 shrink-0 animate-pulse" />
                    <span className="text-[10px] font-black text-slate-300 uppercase truncate">{stream.name}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 hover:bg-white/10 rounded transition-colors"><Minimize className="w-3 h-3 text-slate-400" /></button>
                    <button onClick={onClose} className="p-1.5 hover:bg-red-600 rounded text-slate-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                </div>
            </div>
            {!isMinimized && (
                <div className="aspect-video bg-black relative">
                    <iframe src={stream.url.replace('watch?v=', 'embed/')} className="w-full h-full pointer-events-auto" frameBorder="0" allowFullScreen />
                </div>
            )}
        </div>
    );
};

const MapController = ({ center, isCreating, onMapReady }: { center: [number, number], isCreating: boolean, onMapReady: (map: L.Map) => void }) => {
    const map = useMap();
    useEffect(() => {
        onMapReady(map);
        map.setView(center, map.getZoom());
    }, [center, map, onMapReady]);
    return null;
};

const MapDrawingBridge = ({ drawMode, setDrawMode }: { drawMode: string | null, setDrawMode: (mode: string | null) => void }) => {
    const map = useMap();
    useEffect(() => {
        if (!map || !(map as any).pm) return;
        const pm = (map as any).pm;
        pm.disableDraw();
        if (drawMode === 'sector') pm.enableDraw('Polygon', { snappable: true, cursorMarker: true, pathOptions: { color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2 } });
        else if (drawMode === 'route') pm.enableDraw('Line', { snappable: true, cursorMarker: true, pathOptions: { color: '#f59e0b', weight: 4, dashArray: '5, 10' } });
        else if (drawMode === 'poi') pm.enableDraw('Marker', { snappable: true, cursorMarker: true });
    }, [drawMode, map]);
    return null;
};

export default function TacticalOperationCenter() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null); 
  const leafletMapRef = useRef<L.Map | null>(null);
  
  const [operation, setOperation] = useState<Operation | null>(null);
  const [sectors, setSectors] = useState<TacticalSector[]>([]);
  const [pois, setPois] = useState<TacticalPOI[]>([]);
  const [tacticalDrones, setTacticalDrones] = useState<TacticalDrone[]>([]);
  const [kmlLayers, setKmlLayers] = useState<TacticalKmlLayer[]>([]);
  
  const [drones, setDrones] = useState<Drone[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'resources' | 'kml'>('resources');
  const [activePanel, setActivePanel] = useState<'create' | 'manage' | null>(null);
  
  const [selectedEntity, setSelectedEntity] = useState<any>(null); 
  const [entityType, setEntityType] = useState<'sector' | 'poi' | 'drone' | null>(null);
  const [mapType, setMapType] = useState<'street' | 'satellite'>('street');
  const [currentDrawMode, setCurrentDrawMode] = useState<string | null>(null);
  const [tempGeometry, setTempGeometry] = useState<any>(null); 
  const [activePiPs, setActivePiPs] = useState<Record<string, { id: string, name: string, url: string }>>({});
  
  // Formulários
  const [assignDroneId, setAssignDroneId] = useState("");
  const [assignPilotId, setAssignPilotId] = useState("");
  const [assignStreamUrl, setAssignStreamUrl] = useState("");
  const [newItemName, setNewItemName] = useState('');
  const [newItemColor, setNewItemColor] = useState('#3b82f6');
  const [newItemSubType, setNewItemSubType] = useState('ground_team');
  const [newItemStreamUrl, setNewItemStreamUrl] = useState('');

  useEffect(() => { if (id) loadTacticalData(id); }, [id]);

  const loadTacticalData = async (opId: string) => {
    try {
      const [op, sects, points, tDrones, allDrones, allPilots] = await Promise.all([
          base44.entities.Operation.filter({ id: opId }).then(res => res[0]), 
          tacticalService.getSectors(opId), 
          tacticalService.getPOIs(opId), 
          tacticalService.getTacticalDrones(opId), 
          base44.entities.Drone.list(), 
          base44.entities.Pilot.list()
      ]);
      if (!op) { navigate('/operations'); return; }
      
      // Explicitly typed td to resolve unknown property errors
      const enrichedDrones = tDrones.map((td: TacticalDrone) => ({
        ...td,
        drone: allDrones.find(d => d.id === td.drone_id),
        pilot: allPilots.find(p => p.id === td.pilot_id)
      }));

      // Auto-lançamento do Drone Principal (Se houver drone_id na operação e não estiver já no tático)
      // Explicitly typed td in some calls to resolve potential unknown errors
      if (op.drone_id && !enrichedDrones.some((td: any) => td.drone_id === op.drone_id)) {
          const mainDrone = allDrones.find(d => d.id === op.drone_id);
          const mainPilot = allPilots.find(p => p.id === op.pilot_id);
          enrichedDrones.unshift({
              id: `main-op-drone-${op.id}`,
              operation_id: opId,
              drone_id: op.drone_id,
              pilot_id: op.pilot_id,
              status: 'active',
              current_lat: op.latitude,
              current_lng: op.longitude,
              stream_url: op.stream_url,
              drone: mainDrone,
              pilot: mainPilot
          } as any);
      }

      setOperation(op); setSectors(sects); setPois(points); setTacticalDrones(enrichedDrones as any);
      setDrones(allDrones); setPilots(allPilots);
      setKmlLayers(tacticalService.getKmlLayers(opId));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const operationalSummary = useMemo(() => {
    const totalDrones = tacticalDrones.length;
    const totalAreaM2 = sectors.filter(s => s.geojson?.coordinates).reduce((acc, s) => acc + calculatePolygonArea(s.geojson.coordinates), 0);
    const k9Count = pois.filter(p => p.type === 'k9').length;
    const victimCount = pois.filter(p => p.type === 'victim').length;
    const teamCount = pois.filter(p => p.type === 'ground_team').length;
    return { totalAreaM2, drones: totalDrones, sectors: sectors.length, pois: pois.length, k9: k9Count, victims: victimCount, teams: teamCount };
  }, [sectors, pois, tacticalDrones]);

  const handleTogglePiP = (id: string, name: string, url?: string) => {
      setActivePiPs(prev => {
          const newPiPs = { ...prev };
          if (newPiPs[id]) delete newPiPs[id];
          else if (url) newPiPs[id] = { id, name, url };
          return newPiPs;
      });
  };

  const handleCaptureSnapshot = async () => {
    if (!mapRef.current || !id) return;
    try {
        const canvas = await html2canvas(mapRef.current, { 
            useCORS: true, allowTaint: true,
            ignoreElements: (el) => el.classList.contains('leaflet-control-container')
        });
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        await tacticalService.saveMapSnapshot(id, base64);
        alert("Panorama Tático Capturado com Sucesso!");
    } catch (e) { console.error(e); }
  };

  const handleKmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !id) return;
      const newLayer: TacticalKmlLayer = { id: crypto.randomUUID(), operation_id: id, name: file.name, geojson: null, visible: true, color: '#6366f1' };
      tacticalService.saveKmlLayer(id, newLayer);
      loadTacticalData(id);
      alert(`Camada "${file.name}" importada para o sistema.`);
  };

  const handleDrawCreated = (e: any) => {
    const geojson = e.layer.toGeoJSON(); 
    let type: 'poi' | 'sector' = e.layerType === 'marker' ? 'poi' : 'sector';
    setEntityType(type); setTempGeometry(geojson); setCurrentDrawMode(null);
    if (type === 'sector') setNewItemName(PHONETIC[sectors.length % PHONETIC.length]);
    setActivePanel('create');
  };

  if (loading || !operation) return <div className="h-screen bg-slate-950 flex items-center justify-center text-white font-black animate-pulse">ESTABELECENDO LINK CCO...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden text-slate-800 font-sans">
      
      {/* Sistema PiP Flutuante - Pode ter múltiplas janelas */}
      {/* Fix: Explicitly type 'pip' to avoid 'unknown' type errors when accessing 'id' and 'name' */}
      {Object.values(activePiPs).map((pip: { id: string, name: string, url: string }) => (
          <FloatingPiP key={pip.id} stream={pip} onClose={() => handleTogglePiP(pip.id, pip.name)} />
      ))}
      
      {/* Top Header */}
      <div className="h-14 bg-[#7f1d1d] border-b border-red-900/40 flex items-center justify-between px-4 shrink-0 z-[1000] shadow-2xl">
        <div className="flex items-center gap-3 text-white">
          <Button variant="outline" onClick={() => navigate('/operations')} className="h-9 w-9 p-0 border-white/20 bg-white/10 text-white rounded-full"><ArrowLeft className="w-4 h-4" /></Button>
          <div className="min-w-0">
            <h1 className="text-sm font-black uppercase tracking-tighter leading-none">{operation.name}</h1>
            <p className="text-[10px] text-red-200 opacity-60 font-bold uppercase mt-0.5 tracking-widest">CCO TÁTICO • #{operation.occurrence_number}</p>
          </div>
        </div>
        <div className="flex gap-2">
            <Button onClick={() => setSidebarOpen(!sidebarOpen)} className="h-9 px-4 text-[10px] font-black uppercase bg-white text-red-700 shadow-lg border-none hover:bg-slate-100 transition-all">{sidebarOpen ? 'OCULTAR CONTROLES' : 'EXIBIR CONTROLES'}</Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
          {/* Sidebar de Controle */}
          <div className={`${sidebarOpen ? 'w-80' : 'w-0'} bg-white border-r border-slate-200 flex flex-col shadow-[10px_0_30px_rgba(0,0,0,0.1)] z-[500] transition-all duration-300 overflow-hidden shrink-0`}>
              <div className="flex bg-slate-100 p-1.5 m-3 rounded-xl shrink-0 border border-slate-200 shadow-inner">
                  <button onClick={() => { setActiveTab('resources'); setActivePanel(null); }} className={`flex-1 py-2.5 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'resources' ? 'bg-white text-red-700 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Recursos</button>
                  <button onClick={() => { setActiveTab('kml'); setActivePanel(null); }} className={`flex-1 py-2.5 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'kml' ? 'bg-white text-red-700 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Camadas KML</button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
                  
                  {/* CONTEÚDO PRINCIPAL (TABS) */}
                  {!activePanel && (
                      <div className="animate-fade-in space-y-4">
                          {activeTab === 'resources' ? (
                            <>
                                {/* Resumo Operacional */}
                                <div className="bg-slate-900 p-4 rounded-2xl text-white space-y-3 shadow-xl ring-1 ring-white/10">
                                    <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-2"><LayoutDashboard className="w-3.5 h-3.5"/> Consciência Situacional</h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-white/5 p-2.5 rounded-xl border border-white/5"><p className="text-[8px] font-bold text-white/40 uppercase">Área Coberta</p><p className="text-sm font-black text-blue-400">{formatArea(operationalSummary.totalAreaM2)}</p></div>
                                        <div className="bg-white/5 p-2.5 rounded-xl border border-white/5"><p className="text-[8px] font-bold text-white/40 uppercase">Vetores RPA</p><p className="text-sm font-black text-red-500">{operationalSummary.drones}</p></div>
                                        <div className="bg-white/5 p-2.5 rounded-xl border border-white/5"><p className="text-[8px] font-bold text-white/40 uppercase">Equipes Solo</p><p className="text-sm font-black text-indigo-400">{operationalSummary.teams}</p></div>
                                        <div className="bg-white/5 p-2.5 rounded-xl border border-white/5"><p className="text-[8px] font-bold text-white/40 uppercase">Vítimas</p><p className="text-sm font-black text-green-400">{operationalSummary.victims}</p></div>
                                    </div>
                                </div>

                                {/* Despacho Rápido */}
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 shadow-sm">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Zap className="w-3.5 h-3.5"/> Ativar Recurso</h3>
                                    <Select className="h-9 text-[11px]" value={assignDroneId} onChange={e => setAssignDroneId(e.target.value)}>
                                        <option value="">Selecionar Drone...</option>
                                        {drones.map(d => <option key={d.id} value={d.id}>{d.prefix} - {d.model}</option>)}
                                    </Select>
                                    <Select className="h-9 text-[11px]" value={assignPilotId} onChange={e => setAssignPilotId(e.target.value)}>
                                        <option value="">Piloto em Comando...</option>
                                        {pilots.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                                    </Select>
                                    <Button onClick={async () => {
                                        await tacticalService.assignDrone({ operation_id: id!, drone_id: assignDroneId, pilot_id: assignPilotId, status: 'active', current_lat: operation.latitude, current_lng: operation.longitude, stream_url: assignStreamUrl });
                                        setAssignDroneId(""); setAssignPilotId(""); setAssignStreamUrl(""); loadTacticalData(id!);
                                    }} className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase h-9 text-[10px] shadow-md border-none">Lançar no Mapa</Button>
                                </div>

                                {/* Listagem de Recursos Ativos */}
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Elementos em Campo</h4>
                                    {/* Fix: Added explicit type to td in map callback to avoid 'unknown' type property access errors (line 321 in user's report) */}
                                    {tacticalDrones.map((td: TacticalDrone) => (
                                        <div key={td.id} onClick={() => { setSelectedEntity(td); setEntityType('drone'); setActivePanel('manage'); }} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-50 shadow-sm transition-all hover:translate-x-1">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg text-white ${td.id.includes('main') ? 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.3)]' : 'bg-blue-600'}`}><Plane className="w-4 h-4"/></div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black text-slate-800 leading-none truncate">{td.drone?.prefix}</p>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 truncate">{td.pilot?.full_name?.split(' ')[0]}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {td.stream_url && <Video className="w-4 h-4 text-red-500 animate-pulse" />}
                                                <ChevronRight className="w-4 h-4 text-slate-300"/>
                                            </div>
                                        </div>
                                    ))}
                                    {/* Fix: Added explicit type to p in map callback to avoid 'unknown' type property access errors */}
                                    {pois.map((p: TacticalPOI) => (
                                        <div key={p.id} onClick={() => { setSelectedEntity(p); setEntityType('poi'); setActivePanel('manage'); }} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-50 shadow-sm transition-all hover:translate-x-1">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><MapPin className="w-4 h-4"/></div>
                                                <span className="text-xs font-bold text-slate-700 uppercase truncate max-w-[120px]">{p.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {p.stream_url && <Video className="w-4 h-4 text-red-500 animate-pulse" />}
                                                <ChevronRight className="w-4 h-4 text-slate-300"/>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                          ) : (
                            <div className="space-y-4 animate-fade-in p-1">
                                <div className="p-10 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 flex flex-col items-center justify-center text-center hover:bg-slate-100 transition-colors cursor-pointer relative group shadow-inner">
                                    <input type="file" accept=".kml,.kmz,.geojson" onChange={handleKmlUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                    <Globe className="w-12 h-12 text-slate-300 mb-3 group-hover:text-red-500 transition-colors" />
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-tighter">Clique ou Arraste KML/KMZ</p>
                                    <p className="text-[10px] text-slate-400 mt-1 uppercase">Padrão Google Earth</p>
                                </div>
                                
                                {kmlLayers.length > 0 ? (
                                    <div className="space-y-2 pt-2">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Camadas Carregadas</h4>
                                        {/* Fix: Added explicit type to l in map callback to avoid 'unknown' type property access errors (line 321 in user's report) */}
                                        {kmlLayers.map((l: TacticalKmlLayer) => (
                                            <div key={l.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-sm">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <Files className="w-4 h-4 text-indigo-500 shrink-0" />
                                                    <span className="text-xs font-bold text-slate-700 truncate">{l.name}</span>
                                                </div>
                                                <button className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><Eye className="w-4 h-4" /></button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl border-dashed">
                                        <p className="text-xs text-slate-400 font-bold uppercase">Nenhum arquivo externo vinculado.</p>
                                    </div>
                                )}
                            </div>
                          )}
                      </div>
                  )}

                  {/* PAINEL DE CRIAÇÃO */}
                  {activePanel === 'create' && (
                      <div className="animate-fade-in space-y-5 px-1">
                          <div className="flex justify-between items-center border-b border-slate-100 pb-3"><h2 className="text-xs font-black uppercase text-red-700">Novo Elemento</h2><button onClick={() => setActivePanel(null)} className="p-1 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-400"/></button></div>
                          <Input label="Identificação" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Ex: Equipe Alfa..." className="h-10" />
                          {entityType === 'poi' ? (
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Simbologia de Campo</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        {id: 'ground_team', label: 'Equipe Solo', icon: Users},
                                        {id: 'victim', label: 'Vítima', icon: Heart},
                                        {id: 'vehicle', label: 'Viatura', icon: Truck},
                                        {id: 'k9', label: 'Equipe K9', icon: Dog},
                                        {id: 'hazard', label: 'Perigo', icon: AlertOctagon},
                                        {id: 'object', label: 'Vestígio', icon: Footprints},
                                        {id: 'interest', label: 'Ponto Zero', icon: MapPin}
                                    ].map(type => (
                                        <button key={type.id} onClick={() => setNewItemSubType(type.id)} className={`flex items-center gap-2 p-3 rounded-xl border text-[10px] font-bold uppercase transition-all ${newItemSubType === type.id ? 'bg-red-50 border-red-600 text-red-700 shadow-md ring-1 ring-red-600/20' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                            <type.icon className="w-3.5 h-3.5" /> {type.label}
                                        </button>
                                    ))}
                                </div>
                                <Input label="Link de Transmissão (Opcional)" value={newItemStreamUrl} onChange={e => setNewItemStreamUrl(e.target.value)} placeholder="Bodycam / Drone / IP..." className="h-10" />
                            </div>
                          ) : (
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Cor do Setor</label>
                                <div className="flex flex-wrap gap-2">
                                    {TACTICAL_COLORS.map(c => <button key={c} onClick={() => setNewItemColor(c)} className={`w-9 h-9 rounded-full border-4 transition-all ${newItemColor === c ? 'border-slate-900 scale-110 shadow-lg' : 'border-transparent opacity-60'}`} style={{ backgroundColor: c }} />)}
                                </div>
                            </div>
                          )}
                          <Button className="w-full bg-red-700 text-white font-black uppercase h-12 shadow-xl border-none mt-4" onClick={async () => {
                             if (entityType === 'poi') {
                               const [lng, lat] = tempGeometry.geometry.coordinates;
                               await tacticalService.createPOI({ operation_id: id!, name: newItemName || 'Recurso de Campo', type: newItemSubType as any, lat, lng, stream_url: newItemStreamUrl });
                             } else {
                               await tacticalService.createSector({ operation_id: id!, name: newItemName, type: 'sector', color: newItemColor, geojson: tempGeometry.geometry });
                             }
                             setActivePanel(null); setNewItemStreamUrl(''); loadTacticalData(id!);
                          }}>Salvar no Mapa</Button>
                      </div>
                  )}

                  {/* PAINEL DE GESTÃO */}
                  {activePanel === 'manage' && selectedEntity && (
                      <div className="animate-fade-in space-y-5 px-1">
                          <div className="flex justify-between items-center border-b border-slate-100 pb-3"><h2 className="text-xs font-black uppercase text-blue-700">Gerenciar Recurso</h2><button onClick={() => setActivePanel(null)} className="p-1 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-400"/></button></div>
                          <div className="p-4 bg-slate-900 rounded-2xl text-white shadow-xl ring-1 ring-white/10">
                              <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Identificador</p>
                              <h4 className="text-lg font-black uppercase truncate">{(selectedEntity as any).name || (selectedEntity as any).drone?.prefix}</h4>
                              <p className="text-[10px] text-white/60 font-bold uppercase mt-1 opacity-80">{entityType === 'drone' ? (selectedEntity as any).pilot?.full_name : 'Recurso Tático de Solo'}</p>
                          </div>
                          
                          <div className="space-y-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner">
                              <Input label="Link de Transmissão" value={(selectedEntity as any).stream_url || ''} onChange={e => setSelectedEntity({...(selectedEntity as any), stream_url: e.target.value})} className="bg-white h-10" />
                              <div className="flex flex-col gap-2">
                                  <Button className="w-full bg-blue-600 text-white text-[10px] font-black uppercase h-10 shadow-md border-none" onClick={async () => {
                                      if (entityType === 'drone') await tacticalService.updateDroneStatus((selectedEntity as any).id, { stream_url: (selectedEntity as any).stream_url });
                                      else await tacticalService.updatePOI((selectedEntity as any).id, { stream_url: (selectedEntity as any).stream_url });
                                      alert("Transmissão Sincronizada!"); loadTacticalData(id!);
                                  }}>Atualizar Live</Button>
                                  {(selectedEntity as any).stream_url && (
                                    <Button variant="outline" className="w-full h-10 text-[10px] font-black uppercase border-red-200 text-red-600 bg-white" onClick={() => handleTogglePiP((selectedEntity as any).id, (selectedEntity as any).name || (selectedEntity as any).drone?.prefix || 'RPA', (selectedEntity as any).stream_url)}>Alternar PiP</Button>
                                  )}
                              </div>
                          </div>

                          <Button variant="danger" className="w-full h-12 text-[10px] font-black uppercase shadow-lg border-none" onClick={async () => {
                             if (!confirm("Remover este recurso permanentemente?")) return;
                             if (entityType === 'drone') {
                                if ((selectedEntity as any).id.includes('main')) alert("O drone principal não pode ser removido aqui. Encerre a missão no painel de missões.");
                                else await tacticalService.removeDroneFromOp((selectedEntity as any).id);
                             }
                             else if (entityType === 'sector') await tacticalService.deleteSector((selectedEntity as any).id);
                             else if (entityType === 'poi') await tacticalService.deletePOI((selectedEntity as any).id);
                             setActivePanel(null); loadTacticalData(id!);
                          }}>Desmobilizar Recurso</Button>
                      </div>
                  )}
              </div>
          </div>

          {/* Área do Mapa */}
          <div className="flex-1 relative z-0 bg-slate-100" ref={mapRef}>
              <div className="absolute top-5 left-1/2 -translate-x-1/2 z-[2000] bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.15)] flex items-center p-2 gap-1 ring-4 ring-black/5">
                  <button onClick={() => setCurrentDrawMode(currentDrawMode === 'sector' ? null : 'sector')} className={`p-3 rounded-xl transition-all ${currentDrawMode === 'sector' ? 'bg-blue-600 text-white shadow-lg scale-105' : 'text-blue-600 hover:bg-blue-50'}`} title="Setorizar Área"><Hexagon className="w-6 h-6"/></button>
                  <button onClick={() => setCurrentDrawMode(currentDrawMode === 'route' ? null : 'route')} className={`p-3 rounded-xl transition-all ${currentDrawMode === 'route' ? 'bg-orange-600 text-white shadow-lg scale-105' : 'text-orange-600 hover:bg-orange-50'}`} title="Traçar Rota GPS"><Navigation className="w-6 h-6"/></button>
                  <button onClick={() => setCurrentDrawMode(currentDrawMode === 'poi' ? null : 'poi')} className={`p-3 rounded-xl transition-all ${currentDrawMode === 'poi' ? 'bg-red-600 text-white shadow-lg scale-105' : 'text-red-600 hover:bg-red-50'}`} title="Marcar Recurso/Vítima"><Flag className="w-6 h-6"/></button>
              </div>
              
              <div className="absolute top-1/2 right-4 -translate-y-1/2 z-[2000] flex flex-col gap-2">
                  <button onClick={() => setMapType(prev => prev === 'street' ? 'satellite' : 'street')} className="bg-white text-slate-700 w-12 h-12 flex items-center justify-center rounded-2xl shadow-xl border border-slate-200 hover:bg-slate-50 transition-all">{mapType === 'street' ? <Layers className="w-6 h-6" /> : <Satellite className="w-6 h-6" />}</button>
                  <button onClick={handleCaptureSnapshot} className="bg-white text-slate-700 w-12 h-12 flex items-center justify-center rounded-2xl shadow-xl border border-slate-200 hover:bg-slate-50 transition-all"><Camera className="w-6 h-6" /></button>
              </div>

              <MapContainer center={[operation.latitude, operation.longitude]} zoom={17} style={{ height: '100%', width: '100%', background: 'transparent' }} preferCanvas={true}>
                  <MapController center={[operation.latitude, operation.longitude]} isCreating={!!tempGeometry} onMapReady={(map) => { leafletMapRef.current = map; }} />
                  <MapDrawingBridge drawMode={currentDrawMode} setDrawMode={setCurrentDrawMode} />
                  <TileLayer url={mapType === 'street' ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"} crossOrigin="anonymous" />
                  <SectorsLayer onCreated={handleDrawCreated} />
                  
                  {/* Perímetros e Trilhas */}
                  {/* Fix: Added explicit type to s in map callback to avoid potential 'unknown' type errors */}
                  {sectors.map((s: TacticalSector) => (
                      s.type === 'route' ? 
                        <Polyline key={s.id} positions={L.GeoJSON.coordsToLatLngs(s.geojson.coordinates, 0) as any} pathOptions={{ color: s.color, weight: 6, dashArray: '8, 12' }} eventHandlers={{ click: () => { setSelectedEntity(s); setEntityType('sector'); setActivePanel('manage'); } }} />
                      : <Polygon key={s.id} positions={L.GeoJSON.coordsToLatLngs(s.geojson.coordinates, 1) as any} pathOptions={{ color: s.color, fillOpacity: 0.25, weight: 3 }} eventHandlers={{ click: () => { setSelectedEntity(s); setEntityType('sector'); setActivePanel('manage'); } }} />
                  ))}

                  {/* Recursos de Solo e Pontos Críticos */}
                  {/* Fix: Added explicit type to p in map callback to avoid potential 'unknown' type errors */}
                  {pois.map((p: TacticalPOI) => (
                      <Marker key={p.id} position={[p.lat, p.lng]} icon={getPoiIcon(p.type, !!p.stream_url)} eventHandlers={{ 
                          click: () => { 
                              setSelectedEntity(p); setEntityType('poi'); setActivePanel('manage'); 
                              if(p.stream_url) handleTogglePiP(p.id, p.name, p.stream_url);
                          } 
                      }} />
                  ))}
                  
                  {/* Vetores RPA */}
                  {/* Fix: Added explicit type to td in map callback to avoid potential 'unknown' type errors */}
                  {tacticalDrones.map((td: TacticalDrone) => td.current_lat && (
                      /* 
                         Fix for TypeScript error on line 578: DragEndEvent does not contain mouse event properties 
                         Changing event type from L.LeafletMouseEvent to any to satisfy the DragEndEventHandlerFn signature
                      */
                      <Marker key={td.id} position={[td.current_lat, td.current_lng]} icon={createTacticalDroneIcon(td)} draggable={true} eventHandlers={{ 
                          click: () => { setSelectedEntity(td); setEntityType('drone'); setActivePanel('manage'); }, 
                          dragend: async (e: any) => { 
                              const pos = e.target.getLatLng(); 
                              await tacticalService.updateDroneStatus(td.id, { current_lat: pos.lat, current_lng: pos.lng }); 
                          } 
                      }} />
                  ))}
              </MapContainer>
          </div>
      </div>
    </div>
  );
}
