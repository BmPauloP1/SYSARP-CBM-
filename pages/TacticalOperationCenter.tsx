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
  Footprints, Package, GripHorizontal, Activity, Wifi, Gauge, Thermometer, Wind, Battery, Zap as Bolt
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

const getPoiIcon = (type: string, hasStream?: boolean) => {
    const cacheKey = `${type}-${hasStream}`;
    if (poiIconCache[cacheKey]) return poiIconCache[cacheKey];
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
        <div className="fixed z-[9000] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col group animate-fade-in" style={{ left: pos.x, top: pos.y, width: 320, height: 180 + 30 }}>
            <div className="h-8 bg-slate-800 flex items-center justify-between px-3 cursor-move shrink-0 border-b border-slate-700" onMouseDown={handleMouseDown}>
                <div className="flex items-center gap-2">
                    <Video className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-[10px] font-black text-slate-300 uppercase truncate max-w-[200px]">{stream.name}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-1 hover:bg-red-600 rounded text-slate-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 bg-black relative">
                {videoData?.type === 'youtube' ? (
                    <iframe src={`https://www.youtube.com/embed/${videoData.id}?rel=0&modestbranding=1&autoplay=1`} className="w-full h-full pointer-events-auto" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
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
        } catch (error) {
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
  const [kmlLayers, setKmlLayers] = useState<TacticalKmlLayer[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
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
  const [activePiPs, setActivePiPs] = useState<Record<string, { id: string, name: string, url: string }>>({});
  const [assignDroneId, setAssignDroneId] = useState("");
  const [assignPilotId, setAssignPilotId] = useState("");
  const [assignStreamUrl, setAssignStreamUrl] = useState("");

  useEffect(() => { if (id) loadTacticalData(id); }, [id]);

  useEffect(() => {
    if (!id) return;
    const fetchInitialLive = async () => {
        try {
            const { data, error } = await supabase.from('drone_live_status').select('*');
            if (!error && data) setLiveDrones(data);
        } catch (e) {}
    };
    fetchInitialLive();
    const channel = supabase.channel('live_telemetry').on('postgres_changes', { event: '*', schema: 'public', table: 'drone_live_status' }, (payload) => {
          setLiveDrones(current => {
              const newData = [...current];
              const idx = newData.findIndex(d => d.drone_sn === (payload.new as any).drone_sn);
              if (idx > -1) newData[idx] = payload.new;
              else newData.push(payload.new);
              if (selectedEntity?.drone_sn === (payload.new as any).drone_sn) setSelectedEntity(payload.new);
              return newData;
          });
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, selectedEntity]);

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
      setMainResources({ pilot: allPilots.find(p => p.id === op.pilot_id), drone: allDrones.find(d => d.id === op.drone_id) });
      setOperation(op); if (!pcPosition) setPcPosition([op.latitude, op.longitude]);
      setSectors(sects); setPois(points); setTacticalDrones(enriched); setDrones(allDrones); setPilots(allPilots); setKmlLayers(layers);
    } catch (e) {} finally { setLoading(false); }
  };

  const handleTogglePiP = (id: string, name: string, url?: string) => {
      setActivePiPs(prev => {
          const newPiPs = { ...prev };
          if (newPiPs[id]) delete newPiPs[id];
          else if (url) newPiPs[id] = { id, name, url };
          return newPiPs;
      });
  };

  const operationalSummary = useMemo(() => {
      const totalDrones = tacticalDrones.length + (operation?.drone_id ? 1 : 0) + liveDrones.length;
      const totalAreaM2 = sectors.filter(s => s.type === 'sector' && s.geojson?.coordinates).reduce((acc, s) => acc + calculatePolygonArea(s.geojson.coordinates), 0);
      return { totalAreaM2, resources: { drones: totalDrones, sectors: sectors.filter(s => s.type === 'sector').length, pois: pois.length } };
  }, [sectors, pois, tacticalDrones, liveDrones, operation]);

  const addLog = (text: string, icon: any) => {
      setTimeline(prev => [{ id: crypto.randomUUID(), text, time: new Date().toLocaleTimeString('pt-BR'), icon }, ...prev]);
  };

  const handleCaptureSnapshot = async () => {
      if (!id || isCapturing || !leafletMapRef.current) return;
      setIsCapturing(true); addLog("PROCESSANDO SNAPSHOT EM NUVEM...", Target);
      try {
          const mapEl = mapRef.current?.querySelector('.leaflet-container') as HTMLElement;
          const canvas = await html2canvas(mapEl, { useCORS: true, allowTaint: true, scale: 2, ignoreElements: (element) => element.classList.contains('leaflet-control-container') });
          const base64 = canvas.toDataURL('image/jpeg', 0.8);
          await tacticalService.saveMapSnapshot(id, base64);
          addLog("SNAPSHOT INTEGRAL SALVO.", CheckCircle);
          alert("Snapshot salvo na nuvem com sucesso!");
      } catch (e) { alert("Falha ao capturar mapa."); } finally { setIsCapturing(false); }
  };

  const handleDrawCreated = (e: any) => {
    const geojson = e.layer.toGeoJSON(); 
    let type: 'poi' | 'line' | 'sector' = 'sector';
    if (e.layerType === 'marker' || e.shape === 'Marker') type = 'poi';
    else if (e.layerType === 'line' || e.shape === 'Line') type = 'line';
    setNewItemType(type); setTempGeometry(geojson); setCurrentDrawMode(null);
    if (type !== 'poi') { setNewItemName(PHONETIC[sectors.length % PHONETIC.length]); setNewItemColor(TACTICAL_COLORS[sectors.length % TACTICAL_COLORS.length]); }
    setSidebarOpen(true); setActivePanel('create');
  };

  const saveNewItem = async () => {
      if (!tempGeometry || !id || !newItemName) return;
      try {
          if (newItemType === 'poi') { 
            const [lng, lat] = tempGeometry.geometry.coordinates; 
            await tacticalService.createPOI({ operation_id: id, name: newItemName, type: newItemSubType as any, lat, lng, stream_url: assignStreamUrl }); 
          } else { 
            await tacticalService.createSector({ operation_id: id, name: newItemName, type: newItemType === 'line' ? 'route' : 'sector', color: newItemColor, geojson: tempGeometry.geometry }); 
          }
          setActivePanel(null); setTempGeometry(null); setAssignStreamUrl(""); await loadTacticalData(id);
      } catch (e) { alert("Falha ao persistir."); }
  };

  const handleDeleteEntity = async () => {
      if (!selectedEntity || !id) return;
      if (!confirm("Remover este elemento permanentemente?")) return;
      try {
          if (entityType === 'sector') await tacticalService.deleteSector(selectedEntity.id);
          else if (entityType === 'poi') await tacticalService.deletePOI(selectedEntity.id);
          setActivePanel(null); setSelectedEntity(null); loadTacticalData(id);
      } catch (e) { alert("Erro ao excluir."); }
  };

  if (loading || !operation) return <div className="h-screen bg-slate-950 flex items-center justify-center text-white font-black">SINCRONIZANDO CCO...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden text-slate-800 font-sans">
      {(Object.values(activePiPs) as any[]).map((pip) => (<FloatingPiP key={pip.id} stream={pip} onClose={() => handleTogglePiP(pip.id, pip.name)} />))}
      <div className="h-14 bg-[#7f1d1d] border-b border-red-900/40 flex items-center justify-between px-4 z-[1000] shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/operations')} className="h-9 w-9 p-0 border-white/20 bg-white/10 text-white rounded-full"><ArrowLeft className="w-4 h-4" /></Button>
          <h1 className="text-sm font-black text-white uppercase tracking-tighter leading-none">{operation.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleCaptureSnapshot} disabled={isCapturing} className="h-9 px-4 rounded-lg text-[10px] font-black uppercase bg-blue-600 text-white">{isCapturing ? 'PROCESSANDO...' : 'SNAPSHOT NUVEM'}</Button>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="h-9 px-5 rounded-lg text-[10px] font-black uppercase bg-white text-red-700">{sidebarOpen ? 'FECHAR PAINEL' : 'ABRIR PAINEL'}</button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden relative">
          <div className={`${sidebarOpen ? 'w-80' : 'w-0'} bg-white border-r border-slate-200 flex flex-col shadow-2xl z-[500] transition-all duration-300 overflow-hidden shrink-0`}>
              <div className="flex bg-slate-100 p-1.5 m-3 rounded-xl shrink-0"><button onClick={() => setActiveTab('plan')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${activeTab === 'plan' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500'}`}>Teatro</button><button onClick={() => setActiveTab('timeline')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${activeTab === 'timeline' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500'}`}>Logs</button></div>
              <div className="flex-1 overflow-y-auto p-3 relative bg-white space-y-5">
                  {activeTab === 'plan' && !activePanel && (
                      <div className="space-y-5">
                          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm">
                              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b pb-2">Resumo de Cena</h3>
                              <div className="grid grid-cols-2 gap-3 mt-3">
                                  <div className="bg-white p-3 rounded-xl border border-slate-100"><p className="text-[8px] font-black text-slate-400 uppercase">Área Total</p><p className="text-sm font-black text-blue-600">{formatArea(operationalSummary.totalAreaM2)}</p></div>
                                  <div className="bg-white p-3 rounded-xl border border-slate-100"><p className="text-[8px] font-black text-slate-400 uppercase">Drones</p><p className="text-sm font-black text-red-600">{operationalSummary.resources.drones}</p></div>
                              </div>
                          </div>
                          <div className="space-y-2">
                              {sectors.map(s => (<div key={s.id} onClick={() => { setSelectedEntity(s); setEntityType('sector'); setActivePanel('manage'); }} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center cursor-pointer hover:bg-slate-100"><div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }}></div><span className="text-xs font-bold text-slate-700 uppercase">{s.name}</span></div><ChevronRight className="w-4 h-4 text-slate-300"/></div>))}
                              {pois.map(p => (<div key={p.id} onClick={() => { setSelectedEntity(p); setEntityType('poi'); setActivePanel('manage'); }} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center cursor-pointer hover:bg-slate-100"><div className="flex items-center gap-3"><MapPin className="w-4 h-4 text-slate-400"/><span className="text-xs font-bold text-slate-700 uppercase">{p.name}</span></div><ChevronRight className="w-4 h-4 text-slate-300"/></div>))}
                          </div>
                      </div>
                  )}
                  {activePanel === 'create' && (
                      <div className="absolute inset-0 bg-white z-[600] p-5 space-y-5 animate-fade-in flex flex-col">
                          <div className="flex justify-between items-center border-b pb-3"><h2 className="text-[11px] font-black uppercase">Novo Elemento</h2><button onClick={() => { setActivePanel(null); setTempGeometry(null); }} className="p-1"><X className="w-5 h-5"/></button></div>
                          <div className="space-y-4">
                             <Input label="Identificação" value={newItemName} onChange={e => setNewItemName(e.target.value)} />
                             {newItemType === 'poi' && (
                                <Select label="Tipo de Ponto" value={newItemSubType} onChange={e => setNewItemSubType(e.target.value)}>
                                   <option value="victim">Vítima</option><option value="base">Base/PC</option><option value="hazard">Perigo</option><option value="interest">Interesse</option>
                                </Select>
                             )}
                             {newItemType !== 'poi' && (<div className="space-y-2"><label className="text-xs font-bold">Cor do Setor</label><div className="flex gap-2">{TACTICAL_COLORS.map(c => <button key={c} onClick={() => setNewItemColor(c)} className={`w-8 h-8 rounded-full border-2 ${newItemColor === c ? 'border-slate-900 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />)}</div></div>)}
                             <Button onClick={saveNewItem} className="w-full h-12 bg-red-700 text-white font-black uppercase">Salvar no Servidor</Button>
                          </div>
                      </div>
                  )}
                  {activePanel === 'manage' && selectedEntity && (
                      <div className="absolute inset-0 bg-white z-[600] p-5 space-y-6 animate-fade-in flex flex-col">
                          <div className="flex justify-between items-center border-b pb-3"><h2 className="text-[11px] font-black uppercase">Gerenciar: {selectedEntity.name}</h2><button onClick={() => { setActivePanel(null); setSelectedEntity(null); }} className="p-1"><X className="w-5 h-5"/></button></div>
                          <div className="p-5 bg-slate-900 rounded-3xl text-white">
                              <p className="text-[10px] font-black text-white/40 uppercase">Identificador</p>
                              <h4 className="text-lg font-black uppercase">{selectedEntity.name}</h4>
                              <p className="text-[10px] text-white/60 uppercase mt-1">{entityType === 'sector' ? (selectedEntity.type === 'route' ? 'Trilha/Percurso' : 'Área Tática') : 'Ponto de Interesse'}</p>
                          </div>
                          <div className="space-y-3">
                              <Button variant="danger" onClick={handleDeleteEntity} className="w-full h-11 text-[10px] font-black uppercase tracking-widest shadow-lg">Remover Elemento</Button>
                          </div>
                      </div>
                  )}
              </div>
          </div>
          <div className="flex-1 relative z-0 bg-slate-100" ref={mapRef}>
              <div className="absolute top-5 left-1/2 -translate-x-1/2 z-[2000] bg-white/95 border border-slate-200 rounded-2xl shadow-2xl flex items-center p-2 gap-1 ring-4 ring-black/5">
                  <button onClick={() => setCurrentDrawMode(currentDrawMode === 'sector' ? null : 'sector')} className={`p-3 rounded-xl transition-all ${currentDrawMode === 'sector' ? 'bg-blue-600 text-white' : 'text-blue-600'}`}><Hexagon className="w-6 h-6"/></button>
                  <button onClick={() => setCurrentDrawMode(currentDrawMode === 'route' ? null : 'route')} className={`p-3 rounded-xl transition-all ${currentDrawMode === 'route' ? 'bg-orange-600 text-white' : 'text-orange-600'}`}><Navigation className="w-6 h-6"/></button>
                  <button onClick={() => setCurrentDrawMode(currentDrawMode === 'poi' ? null : 'poi')} className={`p-3 rounded-xl transition-all ${currentDrawMode === 'poi' ? 'bg-red-600 text-white' : 'text-red-600'}`}><Flag className="w-6 h-6"/></button>
              </div>
              <div className="absolute top-1/2 right-4 -translate-y-1/2 z-[2000] flex flex-col gap-2">
                  <button onClick={() => setMapType(prev => prev === 'street' ? 'satellite' : 'street')} className="bg-white text-slate-700 w-12 h-12 flex items-center justify-center rounded-2xl shadow-xl">{mapType === 'street' ? <Layers className="w-6 h-6" /> : <Satellite className="w-6 h-6" />}</button>
              </div>
              <MapContainer center={[operation.latitude, operation.longitude]} zoom={17} style={{ height: '100%', width: '100%', background: 'transparent' }} preferCanvas={true}>
                  <MapController center={[operation.latitude, operation.longitude]} isCreating={!!tempGeometry} onMapReady={(map) => { leafletMapRef.current = map; }} />
                  <MapDrawingBridge drawMode={currentDrawMode} setDrawMode={setCurrentDrawMode} />
                  <TileLayer url={mapType === 'street' ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"} crossOrigin="anonymous" />
                  <SectorsLayer onCreated={handleDrawCreated} />
                  {pcPosition && (<Marker position={pcPosition} icon={createTacticalDroneIcon({ id: 'main-drone-virtual', pilot: mainResources.pilot, drone: mainResources.drone })} draggable={true} eventHandlers={{ click: () => { setSelectedEntity({...operation}); setEntityType('drone'); setActivePanel('manage'); } }} />)}
                  {sectors.map(s => (s.type === 'route' ? <Polyline key={s.id} positions={L.GeoJSON.coordsToLatLngs(s.geojson.coordinates, 0) as any} pathOptions={{ color: s.color, weight: 6, dashArray: '8, 12' }} eventHandlers={{ click: () => { setSelectedEntity(s); setEntityType('sector'); setActivePanel('manage'); } }} /> : <Polygon key={s.id} positions={L.GeoJSON.coordsToLatLngs(s.geojson.coordinates, 1) as any} pathOptions={{ color: s.color, fillOpacity: 0.25, weight: 3 }} eventHandlers={{ click: () => { setSelectedEntity(s); setEntityType('sector'); setActivePanel('manage'); } }} />))}
                  {pois.map(p => (<Marker key={p.id} position={[p.lat, p.lng]} icon={getPoiIcon(p.type, !!p.stream_url)} eventHandlers={{ click: () => { setSelectedEntity(p); setEntityType('poi'); setActivePanel('manage'); if(p.stream_url) handleTogglePiP(p.id, p.name, p.stream_url); } }} />))}
                  {liveDrones.map((ld, idx) => (<Marker key={`live-${idx}`} position={[ld.latitude, ld.longitude]} icon={createTacticalDroneIcon(ld)} eventHandlers={{ click: () => { setSelectedEntity(ld); setEntityType('drone'); setActivePanel('manage'); } }} />))}
              </MapContainer>
          </div>
      </div>
    </div>
  );
}