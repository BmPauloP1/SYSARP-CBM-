
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import "@geoman-io/leaflet-geoman-free";
import html2canvas from 'html2canvas'; 
import { base44 } from '../services/base44Client';
import { tacticalService, TacticalSector, TacticalDrone, TacticalPOI } from '../services/tacticalService';
import { Operation, Drone, Pilot, MISSION_COLORS, MISSION_HIERARCHY } from '../types';
import { Card, Button, Input, Select, Badge } from '../components/ui_components';
import { 
  ArrowLeft, Radio, Plus, Trash2, Crosshair, Hexagon, Flag, 
  MapPin, Settings, X, Save, Eye, EyeOff, Move, Navigation,
  ShieldAlert, Target, Video, ListFilter, History, Zap, 
  Map as MapIcon, Globe, ChevronRight, ChevronLeft, Maximize, Minimize, MousePointer2,
  Users, Truck, Dog, UserCheck, Ruler, LayoutDashboard, Camera, CheckCircle, Loader2, Layers
} from 'lucide-react';
import SectorsLayer from '../components/maps/tactical/SectorsLayer';

const PHONETIC = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL', 'INDIA', 'JULIETT', 'KILO', 'LIMA', 'MIKE', 'NOVEMBER', 'OSCAR', 'PAPA', 'QUEBEC', 'ROMEO', 'SIERRA', 'TANGO', 'UNIFORM', 'VICTOR', 'WHISKEY', 'X-RAY', 'YANKEE', 'ZULU'];
const TACTICAL_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#6366f1'];

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
    let iconHtml = ''; let color = '';
    switch(type) {
        case 'base': iconHtml = `<svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 text-white"><path d="M12.75 3.066a2.25 2.25 0 00-1.5 0l-9.75 3.9A2.25 2.25 0 000 9.066v9.457c0 1.05.738 1.956 1.767 2.169l9.75 2.025a2.25 2.25 0 00.966 0l9.75-2.025A2.25 2.25 0 0024 18.523V9.066a2.25 2.25 0 00-1.5-2.1l-9.75-3.9z" /></svg>`; color = '#b91c1c'; break;
        case 'victim': iconHtml = `<svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 text-white"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`; color = '#ef4444'; break;
        case 'hazard': iconHtml = `<svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 text-white"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`; color = '#f59e0b'; break;
        case 'ground_team': iconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4 text-white"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`; color = '#2563eb'; break;
        case 'vehicle': iconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4 text-white"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M9 18h6"/><path d="M19 18h2a1 1 0 0 0 1-1v-5l-3-4h-5"/></svg>`; color = '#dc2626'; break;
        case 'k9': iconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4 text-white"><path d="M10 5.172l.596.596a2 2 0 0 0 2.828 0L14 5.172M20 21l-2-6M6 21l2-6M12 21v-6M4 4l3 3M20 4l-3 3M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z"/></svg>`; color = '#78350f'; break;
        default: iconHtml = `<svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 text-white"><circle cx="12" cy="12" r="10"/></svg>`; color = '#64748b';
    }
    return L.divIcon({ className: 'custom-poi-marker', html: `<div style="background-color: ${color}; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border: 2.5px solid white;">${iconHtml}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
};

const createTacticalDroneIcon = (td: TacticalDrone) => {
    const pilotName = td.pilot?.full_name?.split(' ')[0] || 'PIC';
    const alt = td.flight_altitude || 60; const rad = td.radius || 200;
    const color = td.status === 'active' ? '#22c55e' : '#f59e0b';
    return L.divIcon({ className: 'drone-tactical-marker', html: `<div style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 6px 12px rgba(0,0,0,0.4));"><div style="background: #0f172a; color: white; font-size: 9px; font-weight: 900; padding: 2px 8px; border-radius: 4px; margin-bottom: 4px; border: 1.5px solid rgba(255,255,255,0.4); white-space: nowrap; text-transform: uppercase; letter-spacing: -0.2px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">${pilotName}</div><div style="background-color: ${color}; width: 40px; height: 40px; border: 3px solid white; border-radius: 10px; transform: rotate(45deg); display: flex; align-items: center; justify-content: center;"><div style="transform: rotate(-45deg);"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="width: 22px; height: 22px;"><path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg></div></div><div style="background: white; color: #1e293b; font-size: 9px; font-weight: 900; padding: 3px 6px; border-radius: 4px; margin-top: 5px; border: 1px solid #cbd5e1; white-space: nowrap; display: flex; gap: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.15);"><span style="color: #2563eb;">${alt}M</span><span style="color: #dc2626;">R:${rad}M</span></div></div>`, iconSize: [110, 110], iconAnchor: [55, 55] });
};

const MapDrawingBridge = ({ drawMode, setDrawMode }: { drawMode: string | null, setDrawMode: (mode: string | null) => void }) => {
    const map = useMap();
    useEffect(() => {
        if (!map || !map.pm) return;
        if (!drawMode) { map.pm.disableDraw(); return; }
        const options = { snappable: true, cursorMarker: true };
        switch(drawMode) {
            case 'sector': map.pm.enableDraw('Polygon', options); break;
            case 'route': map.pm.enableDraw('Polyline', options); break;
            case 'poi': map.pm.enableDraw('Marker', options); break;
        }
        const handleStart = () => setDrawMode(null);
        map.on('pm:drawstart', handleStart);
        return () => { if (map.pm) map.pm.disableDraw(); map.off('pm:drawstart', handleStart); };
    }, [drawMode, map, setDrawMode]);
    return null;
};

const MapController = ({ center, isCreating }: { center: [number, number], isCreating: boolean }) => {
    const map = useMap();
    useEffect(() => {
        const timer = setTimeout(() => { if (map && map.getContainer()) map.invalidateSize(); }, 400);
        return () => clearTimeout(timer);
    }, [map]);
    useEffect(() => { if (!map || isCreating) return; map.flyTo(center, map.getZoom(), { duration: 1 }); }, [center, map, isCreating]);
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
  const [availableDrones, setAvailableDrones] = useState<Drone[]>([]);
  const [availablePilots, setAvailablePilots] = useState<Pilot[]>([]);
  const [timeline, setTimeline] = useState<{id: string, text: string, time: string, icon: any}[]>([]);
  const [pcPosition, setPcPosition] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'plan' | 'timeline' | 'weather'>('plan');
  const [activePanel, setActivePanel] = useState<'create' | 'manage' | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<any>(null); 
  const [entityType, setEntityType] = useState<'sector' | 'poi' | 'drone' | null>(null);
  const [showFloatingVideo, setShowFloatingVideo] = useState(false);
  const [mapType, setMapType] = useState<'street' | 'satellite'>('street');
  const [currentDrawMode, setCurrentDrawMode] = useState<string | null>(null);
  const [visibleLayers, setVisibleLayers] = useState({ sectors: true, routes: true, pois: true, drones: true, base: true });
  const [newItemType, setNewItemType] = useState<'sector' | 'poi' | 'line'>('sector');
  const [newItemName, setNewItemName] = useState('');
  const [newItemColor, setNewItemColor] = useState('#ef4444');
  const [newItemSubType, setNewItemSubType] = useState('victim'); 
  const [tempGeometry, setTempGeometry] = useState<any>(null); 
  
  // State to hold the main resources (Principal Pilot/Drone) for the "PC" marker
  const [mainResources, setMainResources] = useState<{ pilot?: Pilot, drone?: Drone }>({});

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
      
      // Enrich additional tactical drones
      const enriched = tDrones.map(td => ({ ...td, drone: allDrones.find(d => d.id === td.drone_id), pilot: allPilots.find(p => p.id === td.pilot_id) }));
      
      // Load main resources for the operation (Pilot and Drone)
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
    } catch (e) {} finally { setLoading(false); }
  };

  const operationalSummary = useMemo(() => {
      // Calculate total drones including the main one (if exists) + additional ones
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
      if (!id || isCapturing) return;
      setIsCapturing(true); addLog("SINCRONIZANDO RECURSOS E CAPTURANDO TEATRO...", Camera);
      try {
          await syncTacticalSummary();
          const mapEl = mapRef.current?.querySelector('.leaflet-container') as HTMLElement;
          if (!mapEl) throw new Error("Mapa não encontrado");
          if (leafletMapRef.current) { leafletMapRef.current.invalidateSize(); await new Promise(r => setTimeout(r, 600)); }
          const canvas = await html2canvas(mapEl, {
              useCORS: true, allowTaint: true, logging: false, scale: 2, backgroundColor: '#0f172a',
              ignoreElements: (element) => {
                 const cls = element.classList;
                 // Ignorar elementos problemáticos que causam erro '_leaflet_pos'
                 return (
                     cls.contains('leaflet-control-container') || 
                     cls.contains('leaflet-shadow-pane') ||
                     cls.contains('leaflet-marker-shadow') ||
                     (cls.contains('leaflet-pane') && !cls.contains('leaflet-map-pane')) ||
                     (element.tagName === 'svg' && cls.contains('leaflet-zoom-animated'))
                 );
              }
          });
          const base64 = canvas.toDataURL('image/jpeg', 0.8);
          tacticalService.saveMapSnapshot(id, base64);
          addLog("SNAPSHOT E CONTADORES SALVOS PARA RELATÓRIO.", CheckCircle);
          alert("Teatro operacional capturado! Dados atualizados no Boletim.");
      } catch (e) { alert("Falha ao capturar mapa. Tente novamente."); } finally { setIsCapturing(false); }
  };

  const handleDrawCreated = (e: any) => {
    const geojson = e.layer.toGeoJSON(); const type = e.layerType === 'marker' ? 'poi' : (e.layerType === 'polyline' ? 'line' : 'sector');
    setNewItemType(type); setTempGeometry(geojson);
    if (type !== 'poi') { setNewItemName(PHONETIC[sectors.length % PHONETIC.length]); setNewItemColor(TACTICAL_COLORS[sectors.length % TACTICAL_COLORS.length]); } else setNewItemName(""); 
    setSidebarOpen(true); setActivePanel('create');
  };

  const saveNewItem = async () => {
      if (!tempGeometry || !id || !newItemName) { alert("Identificação obrigatória."); return; }
      try {
          if (newItemType === 'poi') { const [lng, lat] = tempGeometry.geometry.coordinates; await tacticalService.createPOI({ operation_id: id, name: newItemName, type: newItemSubType as any, lat, lng }); }
          else { await tacticalService.createSector({ operation_id: id, name: newItemName, type: newItemType === 'line' ? 'route' : 'sector', color: newItemColor, geojson: tempGeometry.geometry, responsible: "N/A" }); }
          setActivePanel(null); setTempGeometry(null); await loadTacticalData(id); syncTacticalSummary();
      } catch (e) { alert("Falha ao persistir."); }
  };

  const handleDroneDragEnd = async (e: any, drone: TacticalDrone) => {
      const pos = e.target.getLatLng(); let detectedSectorId = "";
      for (const sector of sectors) { if (sector.type === 'sector' && isPointInPolygon(pos.lat, pos.lng, sector.geojson.coordinates)) { detectedSectorId = sector.id; break; } }
      await tacticalService.updateDroneStatus(drone.id, { current_lat: pos.lat, current_lng: pos.lng, sector_id: detectedSectorId || undefined });
      loadTacticalData(id!);
  };

  const handleAssignDrone = async (droneId: string, pilotId: string) => {
      if (!droneId || !id) return;
      await tacticalService.assignDrone({ operation_id: id, drone_id: droneId, pilot_id: pilotId, status: 'active', current_lat: operation?.latitude, current_lng: operation?.longitude, flight_altitude: 60, radius: 200 });
      await loadTacticalData(id); syncTacticalSummary();
  };

  // Helper to update Main Operation Position (dragging the main drone)
  const handleMainDroneDragEnd = async (e: any) => {
      const pos = e.target.getLatLng();
      setPcPosition([pos.lat, pos.lng]);
      // Optionally update the operation coordinates in DB if needed:
      if (operation) {
          try {
              await base44.entities.Operation.update(operation.id, { latitude: pos.lat, longitude: pos.lng });
          } catch(e) { console.error("Failed to update op coords", e); }
      }
  };

  if (loading || !operation) return <div className="h-screen bg-slate-950 flex items-center justify-center text-white font-black"><Crosshair className="w-8 h-8 animate-spin mr-3 text-red-600"/> SINCRONIZANDO TEATRO OPERACIONAL...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden text-slate-800 font-sans">
      <div className="h-14 bg-[#7f1d1d] border-b border-red-900/40 flex items-center justify-between px-4 shadow-2xl z-[1000] shrink-0"><div className="flex items-center gap-3"><Button variant="outline" onClick={() => navigate('/operations')} className="h-9 w-9 p-0 border-white/20 bg-white/10 text-white rounded-full"><ArrowLeft className="w-4 h-4" /></Button><div className="min-w-0"><h1 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-tighter leading-none"><Crosshair className="w-4 h-4 text-red-400" /> CCO TÁTICO</h1><p className="text-[9px] text-red-100 font-bold uppercase opacity-60 mt-1 truncate max-w-[200px]">{operation.name}</p></div></div><div className="flex items-center gap-3"><Button onClick={handleCaptureSnapshot} disabled={isCapturing} className={`h-9 px-4 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 border shadow-lg ${isCapturing ? 'bg-slate-700 text-slate-400' : 'bg-blue-600 text-white border-blue-400 hover:bg-blue-700'}`}>{isCapturing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Camera className="w-4 h-4" />} {isCapturing ? 'CAPTURANDO...' : 'CAPTURAR SNAPSHOT'}</Button>{operation.stream_url && (<button onClick={() => setShowFloatingVideo(!showFloatingVideo)} className={`h-9 px-4 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 border shadow-lg ${showFloatingVideo ? 'bg-orange-50 text-white border-orange-400' : 'bg-orange-600/20 text-orange-400 border-orange-500/40 animate-pulse'}`}><Video className="w-4 h-4" /> {showFloatingVideo ? 'OCULTAR VÍDEO' : 'VÍDEO DISPONÍVEL'}</button>)}<button onClick={() => setSidebarOpen(!sidebarOpen)} className={`h-9 px-5 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 transition-all shadow-xl border border-white/10 ${sidebarOpen ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-white text-red-700'}`}>{sidebarOpen ? <><X className="w-4 h-4 text-white"/> FECHAR PAINEL</> : <><Maximize className="w-4 h-4"/> ABRIR PAINEL</>}</button></div></div>
      <div className="flex-1 flex overflow-hidden relative">
          <div className={`${sidebarOpen ? 'w-80' : 'w-0'} bg-white border-r border-slate-200 flex flex-col shadow-2xl z-[500] transition-all duration-300 overflow-hidden shrink-0`}>
              <div className="flex bg-slate-100 p-1.5 m-3 rounded-xl shrink-0"><button onClick={() => { setActiveTab('plan'); setActivePanel(null); }} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'plan' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500'}`}>Teatro</button><button onClick={() => { setActiveTab('timeline'); setActivePanel(null); }} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'timeline' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500'}`}>Logs</button><button onClick={() => { setActiveTab('weather'); setActivePanel(null); }} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'weather' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500'}`}>MET</button></div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 relative bg-white">
                  {activeTab === 'plan' && !activePanel && (<div className="space-y-5 animate-fade-in"><div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4 shadow-sm"><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b pb-2"><LayoutDashboard className="w-3.5 h-3.5"/> Resumo de Cena</h3><div className="grid grid-cols-2 gap-3"><div className="bg-white p-3 rounded-xl border border-slate-100 shadow-inner"><p className="text-[8px] font-black text-slate-400 uppercase">Área Total</p><p className="text-sm font-black text-blue-600">{formatArea(operationalSummary.totalAreaM2)}</p></div><div className="bg-white p-3 rounded-xl border border-slate-100 shadow-inner"><p className="text-[8px] font-black text-slate-400 uppercase">Drones no Ar</p><p className="text-sm font-black text-red-600">{operationalSummary.resources.drones} Unid.</p></div></div><div className="bg-white p-3 rounded-xl border border-slate-100 shadow-inner flex justify-between gap-2"><div className="flex flex-col items-center flex-1"><Users className="w-4 h-4 text-blue-600 mb-1" /><span className="text-xs font-black text-slate-700">{operationalSummary.resources.teams}</span></div><div className="w-px bg-slate-100"></div><div className="flex flex-col items-center flex-1"><Dog className="w-4 h-4 text-amber-600 mb-1" /><span className="text-xs font-black text-slate-700">{operationalSummary.resources.k9}</span></div><div className="w-px bg-slate-100"></div><div className="flex flex-col items-center flex-1"><Truck className="w-4 h-4 text-red-600 mb-1" /><span className="text-xs font-black text-slate-700">{operationalSummary.resources.vehicles}</span></div></div></div>
                          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3 shadow-2xl"><h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2"><Plus className="w-3.5 h-3.5"/> Ativar Vetor RPA</h3><div className="space-y-2"><Select className="h-9 text-[11px] bg-slate-800 border-slate-700 text-white" id="drone-select"><option value="">Aeronave...</option>{availableDrones.filter(d => d.status === 'available').map(d => <option key={d.id} value={d.id}>{d.prefix} - {d.model}</option>)}</Select><Select className="h-9 text-[11px] bg-slate-800 border-slate-700 text-white" id="pilot-select"><option value="">Comandante...</option>{availablePilots.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</Select><Button className="w-full h-10 bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest shadow-lg" onClick={() => handleAssignDrone((document.getElementById('drone-select') as HTMLSelectElement).value, (document.getElementById('pilot-select') as HTMLSelectElement).value)}>Lançar no Mapa</Button></div></div>
                          <div className="space-y-3"><h3 className="text-[10px] font-black text-slate-400 uppercase border-b pb-1">Unidades Ativas</h3>
                            {/* Main Drone Listing */}
                            {mainResources.drone && (
                                <div onClick={() => { mapRef.current?.querySelector('.leaflet-container')?.scrollIntoView(); }} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-2xl cursor-pointer hover:border-red-400 transition-all shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-red-600 text-white shadow-md"><Zap className="w-5 h-5" /></div>
                                        <div><div className="font-black text-xs text-red-900 uppercase leading-none">{mainResources.drone.prefix} (PRINCIPAL)</div><div className="text-[9px] text-red-700 font-bold uppercase mt-1.5">{mainResources.pilot?.full_name?.split(' ')[0]}</div></div>
                                    </div>
                                    <div className="text-right"><div className="text-[11px] font-black text-red-800">{operation.flight_altitude || 60}m</div></div>
                                </div>
                            )}
                            {/* Additional Drones */}
                            {tacticalDrones.map(td => (<div key={td.id} onClick={() => { setSelectedEntity({...td}); setEntityType('drone'); setActivePanel('manage'); }} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-2xl hover:border-red-500 cursor-pointer transition-all shadow-sm group"><div className="flex items-center gap-3"><div className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-colors ${td.status === 'active' ? 'bg-green-50 border-green-100 group-hover:bg-green-500 group-hover:text-white' : 'bg-orange-50 border-orange-100'}`}><Zap className="w-5 h-5" /></div><div><div className="font-black text-xs text-slate-800 uppercase leading-none">{td.drone?.prefix}</div><div className="text-[9px] text-slate-400 font-bold uppercase mt-1.5">{td.pilot?.full_name?.split(' ')[0]}</div></div></div><div className="text-right"><div className="text-[11px] font-black text-slate-700">{td.flight_altitude || 60}m</div>{td.stream_url && <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse ml-auto mt-1" title="Live Ativa"></div>}</div></div>))}</div></div>)}
                  {activeTab === 'timeline' && (<div className="p-2 space-y-4 animate-fade-in bg-white">{timeline.map(e => (<div key={e.id} className="flex gap-3 bg-white p-3 rounded-xl border border-slate-100 items-start shadow-sm"><div className="p-2 bg-slate-50 rounded-lg shadow-sm"><e.icon className="w-4 h-4 text-red-500" /></div><div className="min-w-0"><p className="font-bold text-[11px] text-slate-800 leading-tight">{e.text}</p><p className="text-[9px] text-slate-400 font-black mt-1.5 uppercase">{e.time}</p></div></div>))}</div>)}
                  {(activePanel === 'create' || activePanel === 'manage') && (<div className="absolute inset-0 bg-white z-[600] animate-fade-in flex flex-col p-5 space-y-5 border-l-4 border-red-600"><div className="flex justify-between items-center border-b pb-3"><h2 className="text-[11px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">{activePanel === 'create' ? <><Plus className="w-4 h-4 text-blue-600"/> Identificar Elemento</> : <><Settings className="w-4 h-4 text-slate-600"/> Gerenciar Ativo</>}</h2><button onClick={() => { setActivePanel(null); setTempGeometry(null); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400"/></button></div><div className="space-y-5 overflow-y-auto pr-1">
                              {activePanel === 'create' && (<><Input label="Identificação Tática" autoFocus value={newItemName} onChange={e => setNewItemName(e.target.value)} className="font-black text-xs uppercase h-10 bg-slate-50 border-slate-200" labelClassName="text-[10px] font-black uppercase text-slate-500" />{newItemType === 'poi' && (<div className="grid grid-cols-2 gap-2">{[{ id: 'base', label: 'Base / PC', icon: MapPin }, { id: 'victim', label: 'Vítima', icon: UserCheck }, { id: 'hazard', label: 'Zona Perigo', icon: ShieldAlert }, { id: 'ground_team', label: 'Equipe Solo', icon: Users }, { id: 'vehicle', label: 'Viatura BM', icon: Truck }, { id: 'k9', label: 'Cão Busca', icon: Dog }].map(t => (<button key={t.id} onClick={() => setNewItemSubType(t.id)} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${newItemSubType === t.id ? 'bg-red-600 text-white shadow-xl' : 'bg-slate-50 text-slate-500'}`}><t.icon className="w-5 h-5" /><span className="text-[9px] font-black uppercase">{t.label}</span></button>))}</div>)}<Button onClick={saveNewItem} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[11px] tracking-widest shadow-xl">Salvar Elemento</Button></>)}
                              {activePanel === 'manage' && entityType === 'drone' && selectedEntity && (<div className="space-y-5"><div className="p-4 bg-slate-900 rounded-3xl flex items-center justify-between text-white border border-slate-800 shadow-2xl"><div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Aeronave Ativa</p><h4 className="text-lg font-black">{selectedEntity.drone?.prefix}</h4></div></div><div className="space-y-1.5 p-4 bg-orange-50 border border-orange-200 rounded-2xl"><label className="text-[10px] font-black uppercase text-orange-700 flex items-center gap-1.5"><Video className="w-3 h-3"/> URL de Live do Vetor</label><Input placeholder="Link YouTube/RTSP..." value={selectedEntity.stream_url || ''} onChange={e => { const val = e.target.value; tacticalService.updateDroneStatus(selectedEntity.id, { stream_url: val }); setSelectedEntity({...selectedEntity, stream_url: val}); }} className="text-[10px] h-9 bg-white border-orange-200" /></div><div className="grid grid-cols-2 gap-3"><Input label="Altitude (m)" type="number" value={selectedEntity.flight_altitude} onChange={e => { const val = Number(e.target.value); tacticalService.updateDroneStatus(selectedEntity.id, { flight_altitude: val }); setSelectedEntity({...selectedEntity, flight_altitude: val}); loadTacticalData(id!); }} className="text-xs h-10 font-black" /><Input label="Raio (m)" type="number" value={selectedEntity.radius} onChange={e => { const val = Number(e.target.value); tacticalService.updateDroneStatus(selectedEntity.id, { radius: val }); setSelectedEntity({...selectedEntity, radius: val}); loadTacticalData(id!); }} className="text-xs h-10 font-black" /></div><Button variant="danger" onClick={async () => { if(confirm("Desmobilizar?")) { await tacticalService.removeDroneFromOp(selectedEntity.id); setActivePanel(null); loadTacticalData(id!); syncTacticalSummary(); } }} className="w-full h-11 text-[10px] font-black uppercase">Desmobilizar Unidade</Button></div>)}
                          </div></div>)}
              </div>
          </div>
          <div className="flex-1 relative z-0 bg-slate-100" ref={mapRef}>
              <div className="absolute top-5 left-1/2 -translate-x-1/2 z-[2000] flex pointer-events-none"><div className="bg-white/95 backdrop-blur-2xl border border-slate-200 rounded-2xl shadow-2xl flex items-center p-2 gap-1 pointer-events-auto ring-4 ring-black/5"><div className="px-5 border-r border-slate-200 flex items-center gap-3"><MousePointer2 className="w-5 h-5 text-sysarp-primary" /><span className="text-[11px] font-black text-slate-900 uppercase tracking-tighter">CCO Tático</span></div><div className="flex items-center gap-1"><button onClick={() => setCurrentDrawMode('sector')} className="p-3 hover:bg-blue-600 hover:text-white rounded-xl text-blue-600 transition-all group relative"><Hexagon className="w-6 h-6"/><span className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-2 py-1 rounded font-black opacity-0 group-hover:opacity-100 z-50 uppercase">ÁREA</span></button><button onClick={() => setCurrentDrawMode('route')} className="p-3 hover:bg-orange-600 hover:text-white rounded-xl text-orange-600 transition-all group relative"><Navigation className="w-6 h-6"/><span className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-2 py-1 rounded font-black opacity-0 group-hover:opacity-100 z-50 uppercase">ROTA</span></button><button onClick={() => setCurrentDrawMode('poi')} className="p-3 hover:bg-red-600 hover:text-white rounded-xl text-red-600 transition-all group relative"><Flag className="w-6 h-6"/><span className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-2 py-1 rounded font-black opacity-0 group-hover:opacity-100 z-50 uppercase">PONTO</span></button></div></div></div>
              
              {/* Map Type Toggle */}
              <div className="absolute top-5 right-5 z-[2000] pointer-events-auto">
                  <button 
                      onClick={() => setMapType(prev => prev === 'street' ? 'satellite' : 'street')}
                      className="bg-white hover:bg-slate-50 text-slate-700 p-3 rounded-xl shadow-xl border border-slate-200 transition-all"
                      title="Alternar Satélite/Rua"
                  >
                      <Layers className="w-6 h-6" />
                  </button>
              </div>

              <MapContainer center={[operation.latitude, operation.longitude]} zoom={17} style={{ height: '100%', width: '100%', background: '#0f172a' }} preferCanvas={true} whenReady={(mapInstance: any) => { leafletMapRef.current = mapInstance.target; }}><MapController center={[operation.latitude, operation.longitude]} isCreating={!!tempGeometry} /><MapDrawingBridge drawMode={currentDrawMode} setDrawMode={setCurrentDrawMode} /><TileLayer url={mapType === 'street' ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"} /><SectorsLayer onCreated={handleDrawCreated} />
                  {/* MAIN DRONE MARKER (REPLACES OLD BASE MARKER) */}
                  {visibleLayers.base && pcPosition && (
                      <Marker 
                          position={pcPosition} 
                          icon={createTacticalDroneIcon({
                              id: 'main-drone-virtual',
                              operation_id: operation.id,
                              drone_id: operation.drone_id,
                              pilot_id: operation.pilot_id,
                              status: 'active',
                              flight_altitude: operation.flight_altitude,
                              radius: operation.radius,
                              drone: mainResources.drone,
                              pilot: mainResources.pilot
                          })} 
                          draggable={true} 
                          eventHandlers={{ dragend: handleMainDroneDragEnd }} 
                      />
                  )}
                  {visibleLayers.sectors && sectors.filter(s => s.type !== 'route').map(s => (<Polygon key={s.id} positions={L.GeoJSON.coordsToLatLngs(s.geojson.coordinates, 1) as any} pathOptions={{ color: s.color, fillOpacity: 0.25, weight: 3 }} eventHandlers={{ click: () => { setSelectedEntity({...s}); setEntityType('sector'); setActivePanel('manage'); } }} />))}
                  {visibleLayers.routes && sectors.filter(s => s.type === 'route').map(s => (<Polyline key={s.id} positions={L.GeoJSON.coordsToLatLngs(s.geojson.coordinates, 0) as any} pathOptions={{ color: s.color, weight: 6, dashArray: '8, 12' }} eventHandlers={{ click: () => { setSelectedEntity({...s}); setEntityType('sector'); setActivePanel('manage'); } }} />))}
                  {visibleLayers.pois && pois.map(p => (<Marker key={p.id} position={[p.lat, p.lng]} icon={getPoiIcon(p.type)} eventHandlers={{ click: () => { setSelectedEntity({...p}); setEntityType('poi'); setActivePanel('manage'); } }} />))}
                  {visibleLayers.drones && tacticalDrones.map(td => td.current_lat && (<Marker key={td.id} position={[td.current_lat, td.current_lng]} icon={createTacticalDroneIcon(td)} draggable={true} eventHandlers={{ click: () => { setSelectedEntity({...td}); setEntityType('drone'); setActivePanel('manage'); }, dragend: (e) => handleDroneDragEnd(e, td) }} />))}
              </MapContainer>
          </div>
      </div>
    </div>
  );
}
