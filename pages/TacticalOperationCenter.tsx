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
  Footprints, Package, GripHorizontal, Activity, Wifi, Gauge, Thermometer, Wind, Battery, Zap as Bolt,
  // Added missing icon import
  Plane
} from 'lucide-react';
import SectorsLayer from '../components/maps/tactical/SectorsLayer';

const PHONETIC = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL', 'INDIA', 'JULIETT', 'KILO', 'LIMA', 'MIKE', 'NOVEMBER', 'OSCAR', 'PAPA', 'QUEBEC', 'ROMEO', 'SIERRA', 'TANGO', 'UNIFORM', 'VICTOR', 'WHISKEY', 'X-RAY', 'YANKEE', 'ZULU'];
const TACTICAL_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#6366f1'];

const poiIconCache: Record<string, L.DivIcon> = {};
const droneIconCache: Record<string, L.DivIcon> = {};

const extractVideoId = (url: string) => {
  if (!url) return null;
  const youtubeMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  if (youtubeMatch) return { type: 'youtube', id: youtubeMatch[1] };
  return { type: 'iframe', url };
};

const getPoiIcon = (type: string, hasStream?: boolean) => {
    const cacheKey = `${type}-${hasStream}`;
    if (poiIconCache[cacheKey]) return poiIconCache[cacheKey];
    let iconHtml = ''; let color = '';
    switch(type) {
        case 'base': iconHtml = `<svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 text-white"><path d="M12.75 3.066a2.25 2.25 0 00-1.5 0l-9.75 3.9A2.25 2.25 0 000 9.066v9.457c0 1.05.738 1.956 1.767 2.169l9.75 2.025a2.25 2.25 0 00.966 0l9.75-2.025A2.25 2.25 0 0024 18.523V9.066a2.25 2.25 0 00-1.5-2.1l-9.75-3.9z" /></svg>`; color = '#b91c1c'; break;
        case 'victim': iconHtml = `<svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 text-white"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`; color = '#ef4444'; break;
        case 'hazard': iconHtml = `<svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 text-white"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`; color = '#f59e0b'; break;
        case 'ground_team': iconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4 text-white"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`; color = '#2563eb'; break;
        case 'k9': iconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4 text-white"><path d="M10 5.172l.596.596a2 2 0 0 0 2.828 0L14 5.172M20 21l-2-6M6 21l2-6M12 21v-6M4 4l3 3M20 4l-3 3M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z"/></svg>`; color = '#78350f'; break;
        default: iconHtml = `<svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 text-white"><circle cx="12" cy="12" r="10"/></svg>`; color = '#64748b';
    }
    const icon = L.divIcon({ 
        className: 'custom-poi-marker', 
        html: `<div style="position: relative; background-color: ${color}; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border: 2.5px solid white;">
            ${hasStream ? `<div style="position: absolute; top: -10px; background: #ef4444; border-radius: 50%; width: 8px; height: 8px; border: 1.5px solid white;" class="animate-pulse"></div>` : ''}
            ${iconHtml}
        </div>`, 
        iconSize: [34, 34], 
        iconAnchor: [17, 17] 
    });
    poiIconCache[cacheKey] = icon;
    return icon;
};

const createTacticalDroneIcon = (td: any) => {
    const pilotName = td.pilot?.full_name?.split(' ')[0] || td.pilot_id || 'PIC';
    const alt = Math.round(td.altitude || td.flight_altitude || 60);
    const bat = td.battery_percent || td.battery || td.battery_level || 100;
    const isMain = td.id === 'main-drone-virtual';
    const hasStream = !!td.stream_url;
    const isLive = !!td.drone_sn;
    const color = isLive ? '#2563eb' : (isMain ? '#ef4444' : '#22c55e');
    const cacheKey = `${isMain}-${pilotName}-${alt}-${bat}-${isLive}-${hasStream}`;
    if (droneIconCache[cacheKey]) return droneIconCache[cacheKey];
    const icon = L.divIcon({ 
        className: 'drone-tactical-marker', 
        html: `<div style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 6px 12px rgba(0,0,0,0.4)); position: relative;">
            ${hasStream ? `<div style="position: absolute; top: -15px; background: #ef4444; border-radius: 50%; width: 10px; height: 10px; border: 1.5px solid white; z-index: 10;" class="animate-pulse"></div>` : ''}
            <div style="background: ${isMain ? '#b91c1c' : '#0f172a'}; color: white; font-size: 9px; font-weight: 900; padding: 2px 8px; border-radius: 4px; margin-bottom: 4px; border: 1.5px solid rgba(255,255,255,0.4); white-space: nowrap; text-transform: uppercase; letter-spacing: -0.2px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                ${pilotName}${isLive ? ' (LIVE)' : (isMain ? ' (PRINCIPAL)' : '')}
            </div>
            <div style="background-color: ${color}; width: 40px; height: 40px; border: 3px solid white; border-radius: 10px; transform: rotate(45deg); display: flex; align-items: center; justify-content: center; transition: all 0.3s ease;">
                <div style="transform: rotate(-45deg);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="width: 22px; height: 22px;">
                        <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
                        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
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

// Componente de Janela Flutuante para Transmissão (PiP)
const FloatingPiP: React.FC<{ stream: { id: string, name: string, url: string }, onClose: () => void }> = ({ stream, onClose }) => {
    const [pos, setPos] = useState({ x: window.innerWidth - 350, y: 100 });
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
        <div className="fixed z-[9000] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col group animate-fade-in" style={{ left: pos.x, top: pos.y, width: 320, height: 180 + 32 }}>
            <div className="h-8 bg-slate-800 flex items-center justify-between px-3 cursor-move shrink-0 border-b border-slate-700" onMouseDown={handleMouseDown}>
                <div className="flex items-center gap-2">
                    <Video className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-[10px] font-black text-slate-300 uppercase truncate max-w-[200px]">{stream.name}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-1 hover:bg-red-600 rounded text-slate-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 bg-black relative">
                {videoData?.type === 'youtube' ? (
                    <iframe src={`https://www.youtube.com/embed/${videoData.id}?rel=0&modestbranding=1&autoplay=1`} className="w-full h-full pointer-events-auto" frameBorder="0" allowFullScreen />
                ) : ( <iframe src={stream.url} className="w-full h-full pointer-events-auto" frameBorder="0" allowFullScreen /> )}
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
        } catch (error) { map.pm.disableDraw(); setDrawMode(null); }
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
    useEffect(() => { if (!map || isCreating) return; if (map.getContainer()) map.flyTo(center, map.getZoom(), { duration: 1 }); }, [center, map, isCreating]);
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
  const [liveDrones, setLiveDrones] = useState<any[]>([]); 
  const [drones, setDrones] = useState<Drone[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [timeline, setTimeline] = useState<{id: string, text: string, time: string, icon: any}[]>([]);
  const [pcPosition, setPcPosition] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'plan' | 'timeline'>('plan');
  const [activePanel, setActivePanel] = useState<'create' | 'manage' | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<any>(null); 
  const [entityType, setEntityType] = useState<'sector' | 'poi' | 'drone' | null>(null);
  const [mapType, setMapType] = useState<'street' | 'satellite'>('street');
  const [currentDrawMode, setCurrentDrawMode] = useState<string | null>(null);
  const [tempGeometry, setTempGeometry] = useState<any>(null); 
  const [activePiPs, setActivePiPs] = useState<Record<string, { id: string, name: string, url: string }>>({});
  
  // Form para despacho
  const [assignDroneId, setAssignDroneId] = useState("");
  const [assignPilotId, setAssignPilotId] = useState("");
  const [assignStreamUrl, setAssignStreamUrl] = useState("");
  const [newItemName, setNewItemName] = useState('');
  const [newItemColor, setNewItemColor] = useState('#3b82f6');
  const [newItemSubType, setNewItemSubType] = useState('victim');

  useEffect(() => { if (id) loadTacticalData(id); }, [id]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel('live_telemetry').on('postgres_changes', { event: '*', schema: 'public', table: 'drone_live_status' }, (payload) => {
          setLiveDrones(current => {
              const newData = [...current];
              const idx = newData.findIndex(d => d.drone_sn === (payload.new as any).drone_sn);
              if (idx > -1) newData[idx] = payload.new;
              else newData.push(payload.new);
              return newData;
          });
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

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
      
      const enrichedDrones = tDrones.map(td => ({
        ...td,
        drone: allDrones.find(d => d.id === td.drone_id),
        pilot: allPilots.find(p => p.id === td.pilot_id)
      }));

      setOperation(op); setPcPosition([op.latitude, op.longitude]);
      setSectors(sects); setPois(points); setTacticalDrones(enrichedDrones);
      setDrones(allDrones); setPilots(allPilots);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleTogglePiP = (id: string, name: string, url?: string) => {
      setActivePiPs(prev => {
          const newPiPs = { ...prev };
          if (newPiPs[id]) delete newPiPs[id];
          else if (url) newPiPs[id] = { id, name, url };
          return newPiPs;
      });
  };

  const addLog = (text: string, icon: any) => {
      setTimeline(prev => [{ id: crypto.randomUUID(), text, time: new Date().toLocaleTimeString('pt-BR'), icon }, ...prev]);
  };

  const handleDrawCreated = (e: any) => {
    const geojson = e.layer.toGeoJSON(); 
    let type: 'poi' | 'sector' = e.layerType === 'marker' ? 'poi' : 'sector';
    setEntityType(type); setTempGeometry(geojson); setCurrentDrawMode(null);
    if (type === 'sector') { setNewItemName(PHONETIC[sectors.length % PHONETIC.length]); }
    setSidebarOpen(true); setActivePanel('create');
  };

  const handleAssignDrone = async () => {
    if (!id || !assignDroneId || !assignPilotId) return;
    try {
        await tacticalService.assignDrone({
            operation_id: id,
            drone_id: assignDroneId,
            pilot_id: assignPilotId,
            status: 'active',
            current_lat: operation?.latitude,
            current_lng: operation?.longitude,
            stream_url: assignStreamUrl
        });
        setAssignDroneId(""); setAssignPilotId(""); setAssignStreamUrl("");
        loadTacticalData(id);
        addLog("NOVO VETOR LANÇADO", Plane);
    } catch (e) { alert("Falha ao despachar drone."); }
  };

  const handleUpdateStream = async () => {
      if (!selectedEntity || !id) return;
      try {
          await tacticalService.updateDroneStatus(selectedEntity.id, { stream_url: selectedEntity.stream_url });
          alert("Link de transmissão atualizado!");
          loadTacticalData(id);
      } catch (e) { alert("Erro ao atualizar link."); }
  };

  /**
   * Captures a high-resolution snapshot of the tactical map and saves it to the operation.
   */
  const handleCaptureSnapshot = async () => {
    if (!id || !leafletMapRef.current || !mapRef.current) return;
    setIsCapturing(true);
    try {
      // Small delay to allow Leaflet rendering to stabilize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const canvas = await html2canvas(mapRef.current, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#0f172a', // Matching tactical dark background
        ignoreElements: (element) => {
            // Exclude Leaflet interactive controls from the final capture
            return element.classList.contains('leaflet-control-container');
        }
      });
      
      const base64 = canvas.toDataURL('image/jpeg', 0.8);
      await tacticalService.saveMapSnapshot(id, base64);
      addLog("MAPA TÁTICO CAPTURADO", Camera);
      alert("Snapshot capturado e salvo na missão!");
    } catch (e) {
      console.error("Erro ao capturar mapa:", e);
      alert("Falha ao capturar imagem do mapa.");
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden text-slate-800 font-sans">
      {(Object.values(activePiPs) as any[]).map((pip) => (<FloatingPiP key={pip.id} stream={pip} onClose={() => handleTogglePiP(pip.id, pip.name)} />))}
      
      <div className="h-14 bg-[#7f1d1d] border-b border-red-900/40 flex items-center justify-between px-4 z-[1000] shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/operations')} className="h-9 w-9 p-0 border-white/20 bg-white/10 text-white rounded-full"><ArrowLeft className="w-4 h-4" /></Button>
          <div className="min-w-0">
            <h1 className="text-sm font-black text-white uppercase tracking-tighter leading-none">{operation?.name}</h1>
            <p className="text-[10px] text-red-200 opacity-60 font-bold uppercase mt-0.5">#{operation?.occurrence_number}</p>
          </div>
        </div>
        <div className="flex gap-2">
            <Button onClick={() => setSidebarOpen(!sidebarOpen)} className="h-9 px-4 text-[10px] font-black uppercase bg-white text-red-700">{sidebarOpen ? 'FECHAR PAINEL' : 'ABRIR PAINEL'}</Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
          <div className={`${sidebarOpen ? 'w-80' : 'w-0'} bg-white border-r border-slate-200 flex flex-col shadow-2xl z-[500] transition-all duration-300 overflow-hidden shrink-0`}>
              <div className="flex bg-slate-100 p-1.5 m-3 rounded-xl shrink-0">
                  <button onClick={() => { setActiveTab('plan'); setActivePanel(null); }} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${activeTab === 'plan' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500'}`}>Teatro</button>
                  <button onClick={() => { setActiveTab('timeline'); setActivePanel(null); }} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${activeTab === 'timeline' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500'}`}>Logs</button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
                  {activeTab === 'plan' && !activePanel && (
                      <>
                        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3 shadow-xl">
                            <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2"><Zap className="w-3.5 h-3.5"/> Ativar Vetor RPA</h3>
                            <Select className="h-9 text-[11px]" value={assignDroneId} onChange={e => setAssignDroneId(e.target.value)}>
                                <option value="">Selecionar RPA...</option>
                                {drones.map(d => <option key={d.id} value={d.id}>{d.prefix} - {d.model}</option>)}
                            </Select>
                            <Select className="h-9 text-[11px]" value={assignPilotId} onChange={e => setAssignPilotId(e.target.value)}>
                                <option value="">Selecionar PIC...</option>
                                {pilots.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                            </Select>
                            <Input placeholder="Link de Transmissão (Youtube/RTSP)" className="h-9 text-[11px]" value={assignStreamUrl} onChange={e => setAssignStreamUrl(e.target.value)} />
                            <Button onClick={handleAssignDrone} className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase h-9 text-[10px]">Lançar no Mapa</Button>
                        </div>

                        <div className="space-y-2">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2">Recursos no Terreno</h4>
                            {tacticalDrones.map(td => (
                                <div key={td.id} onClick={() => { setSelectedEntity(td); setEntityType('drone'); setActivePanel('manage'); }} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-600 text-white rounded-lg"><Plane className="w-4 h-4"/></div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-800">{td.drone?.prefix}</p>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase">{td.pilot?.full_name?.split(' ')[0]}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        {td.stream_url && <Video className="w-3 h-3 text-red-500 animate-pulse"/>}
                                        <ChevronRight className="w-4 h-4 text-slate-300"/>
                                    </div>
                                </div>
                            ))}
                            {sectors.map(s => (<div key={s.id} onClick={() => { setSelectedEntity(s); setEntityType('sector'); setActivePanel('manage'); }} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer"><div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full" style={{ backgroundColor: s.color }}></div><span className="text-xs font-bold text-slate-700 uppercase">{s.name}</span></div><ChevronRight className="w-4 h-4 text-slate-300"/></div>))}
                        </div>
                      </>
                  )}

                  {activePanel === 'create' && (
                      <div className="animate-fade-in space-y-4">
                          <div className="flex justify-between items-center"><h2 className="text-xs font-black uppercase">Novo Elemento</h2><button onClick={() => setActivePanel(null)}><X className="w-5 h-5 text-slate-400"/></button></div>
                          <Input label="Identificação" value={newItemName} onChange={e => setNewItemName(e.target.value)} />
                          {entityType === 'poi' ? (
                            <Select label="Tipo" value={newItemSubType} onChange={e => setNewItemSubType(e.target.value)}>
                                <option value="victim">Vítima</option><option value="hazard">Perigo</option><option value="base">Base/PC</option><option value="ground_team">Equipe Solo</option>
                            </Select>
                          ) : (
                            <div className="space-y-2"><label className="text-[10px] font-bold uppercase text-slate-400">Cor do Setor</label><div className="flex flex-wrap gap-2">{TACTICAL_COLORS.map(c => <button key={c} onClick={() => setNewItemColor(c)} className={`w-8 h-8 rounded-full border-2 ${newItemColor === c ? 'border-slate-900' : 'border-transparent'}`} style={{ backgroundColor: c }} />)}</div></div>
                          )}
                          <Button className="w-full bg-red-700 text-white font-black uppercase h-11" onClick={async () => {
                             if (entityType === 'poi') {
                               const [lng, lat] = tempGeometry.geometry.coordinates;
                               await tacticalService.createPOI({ operation_id: id!, name: newItemName, type: newItemSubType as any, lat, lng });
                             } else {
                               await tacticalService.createSector({ operation_id: id!, name: newItemName, type: 'sector', color: newItemColor, geojson: tempGeometry.geometry });
                             }
                             setActivePanel(null); loadTacticalData(id!);
                          }}>Salvar no Servidor</Button>
                      </div>
                  )}

                  {activePanel === 'manage' && selectedEntity && (
                      <div className="animate-fade-in space-y-5">
                          <div className="flex justify-between items-center border-b pb-2"><h2 className="text-xs font-black uppercase">Gerenciar Elemento</h2><button onClick={() => setActivePanel(null)}><X className="w-5 h-5 text-slate-400"/></button></div>
                          <div className="p-4 bg-slate-900 rounded-2xl text-white">
                              <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Identificador</p>
                              <h4 className="text-lg font-black uppercase">{selectedEntity.name || selectedEntity.drone?.prefix}</h4>
                              <p className="text-[10px] text-white/60 font-bold uppercase mt-1">{entityType === 'drone' ? (selectedEntity.pilot?.full_name) : 'Setorização Tática'}</p>
                          </div>
                          
                          {entityType === 'drone' && (
                              <div className="space-y-3 p-4 bg-slate-50 border rounded-2xl">
                                  <Input label="Link de Transmissão" value={selectedEntity.stream_url || ''} onChange={e => setSelectedEntity({...selectedEntity, stream_url: e.target.value})} />
                                  <Button className="w-full bg-blue-600 text-white text-[10px] font-black uppercase h-9" onClick={handleUpdateStream}>Atualizar Live</Button>
                                  {selectedEntity.stream_url && (
                                    <Button variant="outline" className="w-full h-9 text-[10px] font-black uppercase border-red-200 text-red-600" onClick={() => handleTogglePiP(selectedEntity.id, selectedEntity.drone?.prefix, selectedEntity.stream_url)}>Alternar Janela PiP</Button>
                                  )}
                              </div>
                          )}

                          <Button variant="danger" className="w-full h-11 text-[10px] font-black uppercase shadow-lg" onClick={async () => {
                             if (!confirm("Remover permanentemente?")) return;
                             if (entityType === 'drone') await tacticalService.removeDroneFromOp(selectedEntity.id);
                             else if (entityType === 'sector') await tacticalService.deleteSector(selectedEntity.id);
                             else await tacticalService.deletePOI(selectedEntity.id);
                             setActivePanel(null); loadTacticalData(id!);
                          }}>Remover do Terreno</Button>
                      </div>
                  )}
              </div>
          </div>

          <div className="flex-1 relative z-0 bg-slate-100" ref={mapRef}>
              <div className="absolute top-5 left-1/2 -translate-x-1/2 z-[2000] bg-white/95 border border-slate-200 rounded-2xl shadow-2xl flex items-center p-2 gap-1 ring-4 ring-black/5">
                  <button onClick={() => setCurrentDrawMode(currentDrawMode === 'sector' ? null : 'sector')} className={`p-3 rounded-xl transition-all ${currentDrawMode === 'sector' ? 'bg-blue-600 text-white' : 'text-blue-600 hover:bg-blue-50'}`}><Hexagon className="w-6 h-6"/></button>
                  <button onClick={() => setCurrentDrawMode(currentDrawMode === 'poi' ? null : 'poi')} className={`p-3 rounded-xl transition-all ${currentDrawMode === 'poi' ? 'bg-red-600 text-white' : 'text-red-600 hover:bg-red-50'}`}><Flag className="w-6 h-6"/></button>
              </div>
              
              <div className="absolute top-1/2 right-4 -translate-y-1/2 z-[2000] flex flex-col gap-2">
                  <button onClick={() => setMapType(prev => prev === 'street' ? 'satellite' : 'street')} className="bg-white text-slate-700 w-12 h-12 flex items-center justify-center rounded-2xl shadow-xl border border-slate-200">{mapType === 'street' ? <Layers className="w-6 h-6" /> : <Satellite className="w-6 h-6" />}</button>
                  <button onClick={handleCaptureSnapshot} disabled={isCapturing} className="bg-white text-slate-700 w-12 h-12 flex items-center justify-center rounded-2xl shadow-xl border border-slate-200">{isCapturing ? <Loader2 className="w-6 h-6 animate-spin"/> : <Camera className="w-6 h-6" />}</button>
              </div>

              <MapContainer center={[operation?.latitude || -25, operation?.longitude || -49]} zoom={17} style={{ height: '100%', width: '100%', background: 'transparent' }} preferCanvas={true}>
                  <MapController center={[operation?.latitude || -25, operation?.longitude || -49]} isCreating={!!tempGeometry} onMapReady={(map) => { leafletMapRef.current = map; }} />
                  <MapDrawingBridge drawMode={currentDrawMode} setDrawMode={setCurrentDrawMode} />
                  <TileLayer url={mapType === 'street' ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"} crossOrigin="anonymous" />
                  <SectorsLayer onCreated={handleDrawCreated} />
                  
                  {pcPosition && (<Marker position={pcPosition} icon={getPoiIcon('base')} />)}
                  
                  {sectors.map(s => (<Polygon key={s.id} positions={L.GeoJSON.coordsToLatLngs(s.geojson.coordinates, 1) as any} pathOptions={{ color: s.color, fillOpacity: 0.25, weight: 3 }} eventHandlers={{ click: () => { setSelectedEntity(s); setEntityType('sector'); setActivePanel('manage'); } }} />))}
                  {pois.map(p => (<Marker key={p.id} position={[p.lat, p.lng]} icon={getPoiIcon(p.type, !!p.stream_url)} eventHandlers={{ click: () => { setSelectedEntity(p); setEntityType('poi'); setActivePanel('manage'); if(p.stream_url) handleTogglePiP(p.id, p.name, p.stream_url); } }} />))}
                  
                  {tacticalDrones.map(td => td.current_lat && (<Marker key={td.id} position={[td.current_lat, td.current_lng]} icon={createTacticalDroneIcon(td)} draggable={true} eventHandlers={{ click: () => { setSelectedEntity(td); setEntityType('drone'); setActivePanel('manage'); }, dragend: async (e) => { const pos = e.target.getLatLng(); await tacticalService.updateDroneStatus(td.id, { current_lat: pos.lat, current_lng: pos.lng }); } }} />))}
                  
                  {liveDrones.map((ld, idx) => (<Marker key={`live-${idx}`} position={[ld.latitude, ld.longitude]} icon={createTacticalDroneIcon(ld)} eventHandlers={{ click: () => { handleTogglePiP(ld.drone_sn, `LIVE: ${ld.drone_sn.slice(-4)}`, ld.stream_url); } }} />))}
              </MapContainer>
          </div>
      </div>
    </div>
  );
}
