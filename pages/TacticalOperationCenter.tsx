
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import "@geoman-io/leaflet-geoman-free";
import html2canvas from 'html2canvas'; 
import { base44 } from '../services/base44Client';
import { tacticalService, TacticalSector, TacticalDrone, TacticalPOI } from '../services/tacticalService';
import { Operation, Drone, Pilot, MISSION_COLORS } from '../types';
import { Card, Button, Input, Select, Badge } from '../components/ui_components';
import { 
  ArrowLeft, Plus, Trash2, Hexagon, Flag, 
  MapPin, Settings, X, Navigation,
  Video, ChevronRight, Globe, Camera, 
  Users, Truck, Dog, Heart, AlertTriangle, 
  Layers, Satellite, Activity, LocateFixed, Loader2,
  FileUp, Ruler, Maximize2, Move
} from 'lucide-react';
import SectorsLayer from '../components/maps/tactical/SectorsLayer';

const PHONETIC = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL', 'INDIA', 'JULIETT', 'KILO', 'LIMA', 'MIKE', 'NOVEMBER', 'OSCAR', 'PAPA', 'QUEBEC', 'ROMEO', 'SIERRA', 'TANGO', 'UNIFORM', 'VICTOR', 'WHISKEY', 'X-RAY', 'YANKEE', 'ZULU'];

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

// Ícone de Drone Tático com Indicador de Live
const getDroneIcon = (prefix: string, hasStream?: boolean) => {
    return L.divIcon({
        className: 'drone-marker-custom',
        html: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px;">
                ${hasStream ? `
                <div style="position: absolute; inset: 0; background: rgba(239, 68, 68, 0.4); border-radius: 50%; animate: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;" class="animate-pulse"></div>
                <div style="position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; font-size: 7px; font-weight: 900; padding: 1px 4px; border-radius: 4px; border: 1.5px solid white; z-index: 50;">LIVE</div>
                ` : ''}
                <div style="background-color: #1e3a8a; width: 30px; height: 30px; border: 3px solid white; border-radius: 8px; transform: rotate(45deg); box-shadow: 0 4px 10px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="width: 18px; height: 18px; transform: rotate(-45deg);">
                        <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
                        <circle cx="4.5" cy="9" r="2" /><circle cx="19.5" cy="9" r="2" />
                        <circle cx="4.5" cy="15" r="2" /><circle cx="19.5" cy="15" r="2" />
                    </svg>
                </div>
            </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
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
        default: iconSvg = '<circle cx="12" cy="12" r="10"/>';
    }
    return L.divIcon({ 
        className: 'custom-poi-marker', 
        html: `<div style="position: relative; background-color: ${color}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.4); border: 2px solid white;">${hasStream ? `<div style="position: absolute; top: -8px; background: #ef4444; border-radius: 50%; width: 10px; height: 10px; border: 1.5px solid white;" class="animate-pulse"></div>` : ''}<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="width: 16px; height: 16px;">${iconSvg}</svg></div>`, 
        iconSize: [32, 32], 
        iconAnchor: [16, 16] 
    });
};

const MapDrawingBridge = ({ drawMode }: { drawMode: string | null }) => {
    const map = useMap();
    useEffect(() => {
        if (!map || !(map as any).pm) return;
        const pm = (map as any).pm;
        pm.disableDraw();
        if (drawMode === 'sector') pm.enableDraw('Polygon', { snappable: true, cursorMarker: true });
        else if (drawMode === 'route') pm.enableDraw('Line', { snappable: true, cursorMarker: true });
        else if (drawMode === 'poi') pm.enableDraw('Marker', { snappable: true, cursorMarker: true });
    }, [drawMode, map]);
    return null;
};

export default function TacticalOperationCenter() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null); 
  const [operation, setOperation] = useState<Operation | null>(null);
  const [sectors, setSectors] = useState<TacticalSector[]>([]);
  const [pois, setPois] = useState<TacticalPOI[]>([]);
  const [tacticalDrones, setTacticalDrones] = useState<TacticalDrone[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [activeTab, setActiveTab] = useState<'resources' | 'layers'>('resources');
  const [activePanel, setActivePanel] = useState<'create' | 'manage' | null>(null);
  const [entityType, setEntityType] = useState<'sector' | 'poi' | 'drone' | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<any>(null); 
  const [mapType, setMapType] = useState<'street' | 'satellite'>('street');
  const [currentDrawMode, setCurrentDrawMode] = useState<string | null>(null);
  const [tempGeometry, setTempGeometry] = useState<any>(null); 
  const [newItemName, setNewItemName] = useState('');
  const [newItemSubType, setNewItemSubType] = useState('base');
  const [newItemStream, setNewItemStream] = useState('');
  
  // Estado para Live PIP (Picture in Picture) Flutuante
  const [pipStream, setPipStream] = useState<string | null>(null);

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
      
      const enrichedDrones = tDrones.map((td: TacticalDrone) => ({ 
          ...td, 
          drone: allDrones.find(d => d.id === td.drone_id), 
          pilot: allPilots.find(p => p.id === td.pilot_id) 
      }));

      // LÓGICA DE AUTO-SPAWN DO DRONE INICIAL
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
              stream_url: op.stream_url // Link de transmissão configurado no formulário
          } as any);
      }

      setOperation(op); setSectors(sects); setPois(points); setTacticalDrones(enrichedDrones as any);
      setDrones(allDrones); setPilots(allPilots);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const operationalSummary = useMemo(() => {
    const totalAreaM2 = sectors.filter(s => s.geojson?.coordinates).reduce((acc, s) => acc + calculatePolygonArea(s.geojson.coordinates), 0);
    return { 
        totalAreaM2, 
        drones: tacticalDrones.length, 
        victims: pois.filter(p => p.type === 'victim').length, 
        teams: pois.filter(p => p.type === 'ground_team').length,
        vehicles: pois.filter(p => p.type === 'vehicle').length
    };
  }, [sectors, pois, tacticalDrones]);

  const handleDrawCreated = (e: any) => {
    const geojson = e.layer.toGeoJSON(); 
    let type: 'poi' | 'sector' = e.layerType === 'marker' ? 'poi' : 'sector';
    setEntityType(type); 
    setTempGeometry(geojson); 
    setCurrentDrawMode(null);
    if (type === 'sector') setNewItemName(PHONETIC[sectors.length % PHONETIC.length]);
    else setNewItemName(`Ponto ${pois.length + 1}`);
    setActivePanel('create');
    setSidebarOpen(true);
  };

  const handleSaveElement = async () => {
      if (!id || !tempGeometry) return;
      try {
          if (entityType === 'poi') {
              const [lng, lat] = tempGeometry.geometry.coordinates;
              await tacticalService.createPOI({ 
                  operation_id: id, 
                  name: newItemName, 
                  type: newItemSubType as any, 
                  lat, lng, 
                  stream_url: newItemStream 
              });
          } else {
              await tacticalService.createSector({ 
                  operation_id: id, 
                  name: newItemName, 
                  type: 'sector', 
                  color: '#ef4444', 
                  geojson: tempGeometry.geometry 
              });
          }
          setActivePanel(null);
          setNewItemStream('');
          loadTacticalData(id);
      } catch(e) { alert("Erro ao salvar elemento."); }
  };

  const handleCaptureSnapshot = async () => {
    if (!mapRef.current || !operation) return;
    try {
      const canvas = await html2canvas(mapRef.current, { useCORS: true, allowTaint: true });
      const base64 = canvas.toDataURL('image/jpeg', 0.8);
      await tacticalService.saveMapSnapshot(operation.id, base64);
      alert("Snapshot tático salvo!");
    } catch (e) { alert("Erro ao capturar mapa."); }
  };

  if (loading || !operation) return <div className="h-screen bg-slate-950 flex items-center justify-center text-white font-black animate-pulse">SINCRONIZANDO TEATRO DE OPERAÇÕES...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden text-slate-800 font-sans relative">
      
      {/* Header Tático Institucional */}
      <div className="h-16 bg-[#7f1d1d] border-b border-red-900/40 flex items-center justify-between px-6 shrink-0 z-[1000] shadow-2xl">
        <div className="flex items-center gap-4 text-white">
          <button onClick={() => navigate('/operations')} className="h-10 w-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-all border border-white/20">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm md:text-base font-black uppercase tracking-tight truncate max-w-[200px] md:max-w-none">{operation.name}</h1>
            <p className="text-[10px] text-red-200 opacity-60 font-bold uppercase tracking-widest">CCO TÁTICO • CBMPR • #{operation.occurrence_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
            <Button onClick={() => setSidebarOpen(!sidebarOpen)} className="bg-white text-red-700 h-10 px-6 font-black text-xs uppercase shadow-xl border-none">
                {sidebarOpen ? 'FECHAR PAINEL' : 'CONTROLES'}
            </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
          {/* BARRA LATERAL TÁTICA */}
          <div className={`${sidebarOpen ? 'w-full lg:w-96' : 'w-0'} bg-white border-r border-slate-200 flex flex-col shadow-2xl z-[500] transition-all duration-300 overflow-hidden shrink-0`}>
              
              <div className="flex bg-slate-100 p-1.5 m-4 rounded-2xl shrink-0 border border-slate-200">
                  <button onClick={() => setActiveTab('resources')} className={`flex-1 py-3 text-[11px] font-black uppercase rounded-xl transition-all ${activeTab === 'resources' ? 'bg-white text-red-700 shadow-md' : 'text-slate-500'}`}>Recursos</button>
                  <button onClick={() => setActiveTab('layers')} className={`flex-1 py-3 text-[11px] font-black uppercase rounded-xl transition-all ${activeTab === 'layers' ? 'bg-white text-red-700 shadow-md' : 'text-slate-500'}`}>Camadas</button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                  {!activePanel ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                            <Card className="p-4 bg-slate-900 text-white border-none shadow-lg">
                                <p className="text-[9px] font-black text-white/40 uppercase mb-1">Área Atuação</p>
                                <h4 className="text-lg font-black">{formatArea(operationalSummary.totalAreaM2)}</h4>
                            </Card>
                            <Card className="p-4 bg-slate-900 text-white border-none shadow-lg">
                                <p className="text-[9px] font-black text-white/40 uppercase mb-1">Vetores RPA</p>
                                <h4 className="text-lg font-black">{operationalSummary.drones} Ativos</h4>
                            </Card>
                            <Card className="p-4 bg-red-50 border-red-100 shadow-sm col-span-2 flex justify-between items-center">
                                <div className="flex gap-4">
                                    <div><p className="text-[9px] font-black text-red-400 uppercase">Equipes</p><p className="text-lg font-black text-red-700">{operationalSummary.teams}</p></div>
                                    <div className="w-px h-8 bg-red-200 self-center"></div>
                                    <div><p className="text-[9px] font-black text-red-400 uppercase">Vítimas</p><p className="text-lg font-black text-red-700">{operationalSummary.victims}</p></div>
                                </div>
                                <Activity className="w-6 h-6 text-red-300 animate-pulse" />
                            </Card>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                <MapPin className="w-3.5 h-3.5" /> Objetivos e Pontos
                            </h3>
                            <div className="space-y-2">
                                {sectors.map(s => (
                                    <div key={s.id} onClick={() => { setSelectedEntity(s); setEntityType('sector'); setActivePanel('manage'); }} className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 rounded-xl" style={{ backgroundColor: s.color + '20', color: s.color }}><Hexagon className="w-5 h-5"/></div>
                                            <div><p className="text-xs font-black uppercase text-slate-800">{s.name}</p><p className="text-[9px] text-slate-400 font-bold">{formatArea(calculatePolygonArea(s.geojson.coordinates))}</p></div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-slate-300"/>
                                    </div>
                                ))}
                                {pois.map(p => (
                                    <div key={p.id} onClick={() => { setSelectedEntity(p); setEntityType('poi'); setActivePanel('manage'); }} className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 rounded-full bg-slate-100 text-slate-600">
                                                {p.type === 'victim' ? <Heart className="w-5 h-5 text-red-600"/> : p.type === 'ground_team' ? <Users className="w-5 h-5 text-blue-600"/> : p.type === 'vehicle' ? <Truck className="w-5 h-5 text-red-600"/> : p.type === 'k9' ? <Dog className="w-5 h-5 text-amber-900"/> : <MapPin className="w-5 h-5"/>}
                                            </div>
                                            <div><p className="text-xs font-black uppercase text-slate-800">{p.name}</p><p className="text-[9px] text-slate-400 font-bold uppercase">{p.type}</p></div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {p.stream_url && <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>}
                                            <ChevronRight className="w-4 h-4 text-slate-300"/>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-slate-100">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                <Activity className="w-3.5 h-3.5" /> Ativos em Tempo Real
                            </h3>
                            <div className="space-y-2">
                                {tacticalDrones.map((td: any) => (
                                    <div key={td.id} onClick={() => { setSelectedEntity(td); setEntityType('drone'); setActivePanel('manage'); }} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3 cursor-pointer hover:bg-slate-100">
                                        <div className="p-2 bg-white rounded-lg shadow-sm"><Activity className="w-4 h-4 text-blue-600"/></div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-black uppercase text-slate-700">{td.drone?.prefix}</p>
                                            <p className="text-[9px] text-slate-400 truncate uppercase">{td.pilot?.full_name}</p>
                                        </div>
                                        {td.stream_url ? <Badge className="ml-auto text-[8px] bg-red-600 text-white animate-pulse">LIVE</Badge> : <Badge variant="success" className="ml-auto text-[8px]">ONLINE</Badge>}
                                    </div>
                                ))}
                            </div>
                        </div>
                      </>
                  ) : activePanel === 'create' ? (
                      <div className="space-y-6 animate-fade-in">
                          <h2 className="text-xs font-black uppercase text-red-700 flex items-center gap-2"><Plus className="w-4 h-4"/> Novo Recurso Tático</h2>
                          <div className="space-y-4">
                              <Input label="Identificação / Nome" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Ex: SETOR ALFA..." />
                              {entityType === 'poi' && (
                                  <>
                                      <Select label="Natureza do Ponto" value={newItemSubType} onChange={e => setNewItemSubType(e.target.value)}>
                                          <option value="base">Posto de Comando (Base)</option>
                                          <option value="victim">Vítima Avistada</option>
                                          <option value="ground_team">Equipe de Solo</option>
                                          <option value="vehicle">Viatura BM</option>
                                          <option value="k9">Binômio (K9)</option>
                                          <option value="hazard">Zona de Perigo</option>
                                          <option value="landing_zone">Ponto de Decolagem</option>
                                      </Select>
                                      <Input label="URL de Transmissão (Ponto)" value={newItemStream} onChange={e => setNewItemStream(e.target.value)} placeholder="Link Câmera..." />
                                  </>
                              )}
                              <div className="flex gap-3 pt-4">
                                  <Button variant="outline" className="flex-1" onClick={() => setActivePanel(null)}>Cancelar</Button>
                                  <Button className="flex-1 bg-red-700 text-white font-black uppercase" onClick={handleSaveElement}>Salvar Elemento</Button>
                              </div>
                          </div>
                      </div>
                  ) : (
                      <div className="space-y-6 animate-fade-in">
                           <h2 className="text-xs font-black uppercase text-blue-700 flex items-center gap-2"><Settings className="w-4 h-4"/> Gestão do Elemento</h2>
                           <div className="p-5 bg-slate-900 rounded-3xl text-white shadow-xl">
                               <p className="text-[10px] font-black text-white/40 uppercase mb-1">{entityType === 'sector' ? 'ÁREA' : entityType === 'drone' ? 'VETOR' : 'PONTO'}</p>
                               <h4 className="text-xl font-black uppercase">
                                   {entityType === 'drone' ? (selectedEntity as any).drone?.prefix : (selectedEntity as any).name}
                               </h4>
                               {entityType === 'sector' && <p className="text-xs text-red-400 font-bold mt-2">Área: {formatArea(calculatePolygonArea(selectedEntity.geojson.coordinates))}</p>}
                               {entityType === 'drone' && <p className="text-xs text-blue-400 font-bold mt-2">PIC: {selectedEntity.pilot?.full_name}</p>}
                               
                               {selectedEntity.stream_url && (
                                   <div className="mt-4 p-3 bg-red-600 rounded-2xl flex items-center justify-between">
                                       <span className="text-[10px] font-black uppercase flex items-center gap-2"><Video className="w-4 h-4"/> Transmissão Ativa</span>
                                       <button onClick={() => setPipStream(selectedEntity.stream_url)} className="text-[10px] bg-white text-red-700 px-4 py-1.5 rounded-full font-black shadow-lg active:scale-95 transition-transform">ASSISTIR</button>
                                   </div>
                               )}
                           </div>
                           <div className="space-y-3">
                               <Button variant="outline" className="w-full text-[10px] font-black uppercase h-12" onClick={() => setActivePanel(null)}>Voltar ao Menu</Button>
                               {entityType !== 'drone' && (
                                   <Button variant="danger" className="w-full text-[10px] font-black uppercase h-12" onClick={async () => {
                                       if (entityType === 'sector') await tacticalService.deleteSector(selectedEntity.id);
                                       else await tacticalService.deletePOI(selectedEntity.id);
                                       setActivePanel(null); loadTacticalData(id!);
                                   }}>Remover do Mapa</Button>
                               )}
                           </div>
                      </div>
                  )}

                  {activeTab === 'layers' && !activePanel && (
                      <div className="space-y-6 animate-fade-in">
                          <div className="p-6 bg-blue-50 border-2 border-dashed border-blue-200 rounded-3xl text-center">
                              <Globe className="w-10 h-10 text-blue-400 mx-auto mb-3" />
                              <h4 className="text-sm font-black text-blue-900 uppercase">Importar Camadas</h4>
                              <p className="text-[10px] text-blue-600 font-bold mt-2">Suporte a arquivos .KML e .KMZ</p>
                              <label className="mt-4 inline-block">
                                  <input type="file" className="hidden" accept=".kml,.kmz" />
                                  <div className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-lg cursor-pointer hover:bg-blue-700">Fazer Upload</div>
                              </label>
                          </div>
                      </div>
                  )}
              </div>
          </div>

          <div className="flex-1 relative z-0 bg-slate-100" ref={mapRef}>
              
              {/* SISTEMA DE PIP (PICTURE IN PICTURE) FLUTUANTE */}
              {pipStream && (
                  <div className="absolute top-24 right-8 w-80 md:w-96 bg-slate-900 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-700 z-[3000] overflow-hidden animate-fade-in flex flex-col ring-8 ring-black/5">
                      <div className="bg-slate-800 p-3 flex justify-between items-center border-b border-slate-700 cursor-move">
                          <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
                              <span className="text-[10px] font-black text-white uppercase tracking-widest">Feed de Vídeo Tático</span>
                          </div>
                          <div className="flex gap-1">
                              <button onClick={() => setPipStream(null)} className="p-1.5 hover:bg-white/10 rounded-full text-slate-400 transition-colors"><X className="w-5 h-5"/></button>
                          </div>
                      </div>
                      <div className="aspect-video bg-black relative flex items-center justify-center">
                          <iframe 
                            src={pipStream} 
                            className="w-full h-full border-none"
                            allow="autoplay; fullscreen"
                          ></iframe>
                      </div>
                      <div className="p-2 bg-slate-800 flex justify-center">
                          <button className="text-[9px] font-black text-slate-400 uppercase tracking-tighter flex items-center gap-2"><Move className="w-3 h-3"/> Arraste para reposicionar</button>
                      </div>
                  </div>
              )}

              {/* FERRAMENTAS FLUTUANTES TÁTICAS */}
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[2000] bg-white/95 backdrop-blur-2xl border border-slate-200 rounded-2xl shadow-2xl flex items-center p-1.5 gap-1.5 ring-8 ring-black/5">
                  <button onClick={() => setCurrentDrawMode(currentDrawMode === 'sector' ? null : 'sector')} className={`p-3 rounded-xl transition-all ${currentDrawMode === 'sector' ? 'bg-red-600 text-white shadow-lg' : 'text-red-600 hover:bg-red-50'}`} title="Setorizar Área">
                    <Hexagon className="w-6 h-6"/>
                  </button>
                  <button onClick={() => setCurrentDrawMode(currentDrawMode === 'route' ? null : 'route')} className={`p-3 rounded-xl transition-all ${currentDrawMode === 'route' ? 'bg-orange-600 text-white shadow-lg' : 'text-orange-600 hover:bg-orange-50'}`} title="Traçar Rota">
                    <Navigation className="w-6 h-6"/>
                  </button>
                  <button onClick={() => setCurrentDrawMode(currentDrawMode === 'poi' ? null : 'poi')} className={`p-3 rounded-xl transition-all ${currentDrawMode === 'poi' ? 'bg-blue-600 text-white shadow-lg' : 'text-blue-600 hover:bg-blue-50'}`} title="Novo Ponto">
                    <Flag className="w-6 h-6"/>
                  </button>
              </div>

              <div className="absolute bottom-10 right-6 z-[1000] flex flex-col gap-3">
                  <button onClick={() => setMapType(mapType === 'street' ? 'satellite' : 'street')} className="bg-white text-slate-700 w-14 h-14 flex items-center justify-center rounded-2xl shadow-2xl border border-slate-200 hover:bg-slate-50">
                    {mapType === 'street' ? <Layers className="w-6 h-6" /> : <Satellite className="w-6 h-6" />}
                  </button>
                  <button onClick={handleCaptureSnapshot} className="bg-white text-slate-700 w-14 h-14 flex items-center justify-center rounded-2xl shadow-2xl border border-slate-200 hover:bg-slate-50">
                    <Camera className="w-6 h-6" />
                  </button>
                  <button onClick={() => {}} className="bg-white text-blue-600 w-14 h-14 flex items-center justify-center rounded-2xl shadow-2xl border border-slate-200 hover:bg-slate-50">
                    <LocateFixed className="w-6 h-6" />
                  </button>
              </div>

              <MapContainer center={[operation.latitude, operation.longitude]} zoom={17} style={{ height: '100%', width: '100%' }}>
                  <MapDrawingBridge drawMode={currentDrawMode} />
                  <TileLayer url={mapType === 'street' ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"} />
                  <SectorsLayer onCreated={handleDrawCreated} />
                  
                  {sectors.map((s: any) => (
                    s.type === 'route' ? (
                      <Polyline key={s.id} positions={L.GeoJSON.coordsToLatLngs(s.geojson.coordinates, 0) as any} pathOptions={{ color: s.color, weight: 6, dashArray: '5, 10' }} />
                    ) : (
                      <Polygon key={s.id} positions={L.GeoJSON.coordsToLatLngs(s.geojson.coordinates, 1) as any} pathOptions={{ color: s.color, fillOpacity: 0.2, weight: 2 }} />
                    )
                  ))}

                  {pois.map((p: any) => (
                    <Marker key={p.id} position={[p.lat, p.lng]} icon={getPoiIcon(p.type, !!p.stream_url)} eventHandlers={{ click: () => { setSelectedEntity(p); setEntityType('poi'); setActivePanel('manage'); } }}>
                        <Popup>
                            <div className="p-2 min-w-[200px]">
                                <h4 className="font-black text-xs uppercase border-b pb-2 mb-2">{p.name}</h4>
                                <p className="text-[10px] text-slate-500 mb-3">{p.description || 'Ponto tático operacional.'}</p>
                                {p.stream_url && (
                                    <button 
                                        onClick={() => setPipStream(p.stream_url!)}
                                        className="w-full bg-red-600 text-white font-black uppercase text-[9px] py-2 rounded-lg flex items-center justify-center gap-2 animate-pulse"
                                    >
                                        <Video className="w-3.5 h-3.5"/> Abrir Live Tática
                                    </button>
                                )}
                            </div>
                        </Popup>
                    </Marker>
                  ))}

                  {tacticalDrones.map((td: any) => td.current_lat && (
                    <Marker 
                        key={td.id} 
                        position={[td.current_lat, td.current_lng]} 
                        icon={getDroneIcon(td.drone?.prefix || 'RPA', !!td.stream_url)} 
                        eventHandlers={{ click: () => { setSelectedEntity(td); setEntityType('drone'); setActivePanel('manage'); } }}
                    >
                        <Popup>
                            <div className="p-2 min-w-[180px]">
                                <p className="text-[9px] font-black text-blue-600 uppercase mb-1">VETOR EM OPERAÇÃO</p>
                                <h4 className="font-black text-sm uppercase leading-none mb-1">{td.drone?.prefix}</h4>
                                <p className="text-[10px] text-slate-500 font-bold uppercase">{td.pilot?.full_name}</p>
                                {td.stream_url && (
                                    <button 
                                        onClick={() => setPipStream(td.stream_url!)}
                                        className="w-full mt-3 bg-red-600 text-white font-black uppercase text-[9px] py-2 rounded-lg flex items-center justify-center gap-2 shadow-lg"
                                    >
                                        <Video className="w-3.5 h-3.5"/> Assistir Transmissão
                                    </button>
                                )}
                            </div>
                        </Popup>
                    </Marker>
                  ))}
              </MapContainer>
          </div>
      </div>
    </div>
  );
}
