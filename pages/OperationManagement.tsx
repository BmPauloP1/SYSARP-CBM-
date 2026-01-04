
import React, { useState, useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import { base44 } from "../services/base44Client";
import { Operation, Drone, Pilot, MISSION_HIERARCHY, MissionType, ORGANIZATION_CHART, MISSION_COLORS } from "../types";
import { SUMMER_LOCATIONS } from "../types_summer";
import { Button, Input, Select, Badge, Card } from "../components/ui_components";
/* Added Activity to the imports to fix the error on line 480 */
import { 
  Plus, Clock, User, Share2, Pencil, X, CheckSquare, 
  Radio, Sun, Calendar, MapPin, Building2, 
  Navigation, Layers, MousePointer2, Users, 
  Pause, XCircle, Trash2, ChevronRight,
  FileText, Send, Info, Video, Plane, AlertTriangle, Shield, Check, Phone, Globe, Terminal,
  Activity
} from "lucide-react";
import OperationDailyLog from "../components/OperationDailyLog";

import "@geoman-io/leaflet-geoman-free";

// --- MAPEAMENTO GEOGRÁFICO DAS UNIDADES ---
const UNIT_COORDINATES: Record<string, [number, number]> = {
  "1º CRBM - Curitiba": [-25.4214, -49.2745],
  "1º BBM - Curitiba": [-25.4746, -49.2796],
  "6º BBM - São José dos Pinhais": [-25.5349, -49.2065],
  "7º BBM - Colombo": [-25.3325, -49.2241],
  "8º BBM - Paranaguá": [-25.5204, -48.5093],
  "2º CRBM - Londrina": [-23.3103, -51.1628],
  "3º BBM - Londrina": [-23.3210, -51.1650],
  "11º BBM - Apucarana": [-23.5505, -51.4614],
  "1ª CIBM - Ivaiporã": [-24.23174830493947, -51.67066976419622],
  "3ª CIBM - Santo Antônio da Platina": [-23.2941, -50.0783],
  "4ª CIBM - Cianorte": [-23.6629, -52.6074],
  "5ª CIBM - Paranavaí": [-23.0822, -52.4632],
  "3º CRBM - Cascavel": [-24.9555, -53.4552],
  "4º BBM - Cascavel": [-24.9580, -53.4600],
  "9º BBM - Foz do Iguaçu": [-25.5478, -54.5881],
  "10º BBM - Francisco Beltrão": [-26.0772, -53.0519],
  "13º BBM - Pato Branco": [-26.2294, -52.6713],
  "4º CRBM - Maringá": [-23.4210, -51.9331],
  "5º BBM - Maringá": [-23.4250, -51.9400],
  "2ª CIBM - Umuarama": [-23.7664, -53.3206],
  "5º CRBM - Ponta Grossa": [-25.0950, -50.1619],
  "2º BBM - Ponta Grossa": [-25.0990, -50.1650],
  "12º BBM - Guarapuava": [-25.3935, -51.4627],
  "6ª CIBM - Irati": [-25.4673, -50.6514],
  "BOA - Batalhão de Operações Aéreas": [-25.4284, -49.2733],
  "GOST - Socorro Tático": [-25.4397, -49.2719]
};

// --- HELPERS ---
const cleanUnitString = (unit: string, crbm: string) => {
    const target = (unit && unit !== "") ? unit : (crbm && crbm !== "" ? crbm : "SOARP");
    const base = target.split(' - ')[0];
    return base.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

const generateNextProtocol = (operations: Operation[], unit: string, crbm: string) => {
    const year = new Date().getFullYear().toString();
    const prefix = "ARP";
    const cleanedUnit = cleanUnitString(unit, crbm);
    const unitOps = operations.filter(o => o.occurrence_number && o.occurrence_number.includes(`${year}${prefix}${cleanedUnit}`));
    let sequence = 1;
    if (unitOps.length > 0) {
        const sorted = unitOps.sort((a, b) => b.occurrence_number.localeCompare(a.occurrence_number));
        const lastProtocol = sorted[0].occurrence_number;
        const match = lastProtocol.match(/(\d{5})$/);
        if (match) sequence = parseInt(match[1], 10) + 1;
    }
    return `${year}${prefix}${cleanedUnit}${String(sequence).padStart(5, '0')}`;
};

const getIcon = (color: string) => {
  return L.divIcon({
    className: "custom-div-icon",
    html: `<div style="background-color: ${color}; width: 14px; height: 14px; border: 2.5px solid white; border-radius: 50%; box-shadow: 0 0 6px rgba(0,0,0,0.4);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

const createCustomIcon = (type: 'unit' | 'pilot' | 'drone', count: number = 0) => {
  let bgColor = "#1e293b"; 
  let iconHtml = "";
  if (type === 'unit') {
    bgColor = "#b91c1c";
    iconHtml = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="2.5" fill="none"><path d="M3 21h18M3 7v1a3 3 0 0 0 6 0V7m0 0v1a3 3 0 0 0 6 0V7m0 0v1a3 3 0 0 0 6 0V7M4 21V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v17"/></svg>`;
  } else if (type === 'pilot') {
    bgColor = "#2563eb";
    iconHtml = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="2.5" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  } else if (type === 'drone') {
    bgColor = "#ea580c";
    iconHtml = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="2.5" fill="none"><path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M12 12v-4" /><path d="M4.5 9m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0" /><path d="M19.5 9m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0" /><path d="M4.5 15m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0" /><path d="M19.5 15m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0" /></svg>`;
  }
  const badgeHtml = count > 1 ? `
    <div style="position: absolute; top: -10px; right: -10px; background-color: #ef4444; color: white; font-size: 10px; font-weight: 900; width: 18px; height: 18px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; z-index: 1000; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
      ${count}
    </div>` : "";
  return L.divIcon({
    className: "custom-resource-icon",
    html: `<div style="position: relative; background-color: ${bgColor}; width: 28px; height: 28px; border-radius: 8px; border: 2px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 6px rgba(0,0,0,0.3);">${iconHtml}${badgeHtml}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
};

const MapController = ({ isPanelCollapsed }: { isPanelCollapsed: boolean }) => {
  const map = useMap();
  useEffect(() => { 
    const timer = setTimeout(() => { if (map.getContainer()) map.invalidateSize(); }, 350);
    return () => clearTimeout(timer);
  }, [map, isPanelCollapsed]);
  return null;
};

const MapPanController = ({ lat, lng }: { lat: number, lng: number }) => {
    const map = useMap();
    const lastPos = useRef({ lat, lng });
    useEffect(() => {
        if (lat !== lastPos.current.lat || lng !== lastPos.current.lng) {
            map.flyTo([lat, lng], map.getZoom() > 10 ? map.getZoom() : 15);
            lastPos.current = { lat, lng };
        }
    }, [lat, lng, map]);
    return null;
};

const MapEventsHandler = ({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) => {
    const map = useMap();
    useEffect(() => {
        if (!map) return;
        map.on('click', (e) => onMapClick(e.latlng.lat, e.latlng.lng));
        return () => { map.off('click'); };
    }, [map]);
    return null;
};

export default function OperationManagement() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [currentUser, setCurrentUser] = useState<Pilot | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);

  // --- CAMADAS ---
  const [visibleLayers, setVisibleLayers] = useState({
      units: false,
      pilots: false,
      fleet: false,
      missions: true
  });

  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState<Operation | null>(null);
  const [isCancellingOp, setIsCancellingOp] = useState<Operation | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isAcknowledgeCancel, setIsAcknowledgeCancel] = useState(false);
  const [viewingLogOp, setViewingLogOp] = useState<Operation | null>(null);

  const initialFormState = {
    name: '', pilot_id: '', second_pilot_id: '', observer_name: '', drone_id: '',
    mission_type: 'sar' as MissionType, sub_mission_type: '',
    latitude: -25.2521, longitude: -52.0215, radius: 500, flight_altitude: 60,
    status: 'active' as any, occurrence_number: '', sarpas_protocol: '', 
    is_summer_op: false, is_multi_day: false,
    summer_city: '', summer_pgv: '',
    op_crbm: '', op_unit: '',
    description: '', stream_url: '',
    date: new Date().toISOString().split('T')[0],
    start_time_local: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    end_time_local: '',
    takeoff_points: [] as { lat: number; lng: number; alt: number }[]
  };

  const [formData, setFormData] = useState(initialFormState);
  const [finishData, setFinishData] = useState({ description: '', flight_hours: '00:00' });

  useEffect(() => { loadData(); const interval = setInterval(loadData, 30000); return () => clearInterval(interval); }, []);

  const loadData = async () => {
    try {
      const [ops, pils, drns, me] = await Promise.all([
        base44.entities.Operation.list('-created_at'), 
        base44.entities.Pilot.list(), 
        base44.entities.Drone.list(), 
        base44.auth.me()
      ]);
      setOperations(ops); 
      setPilots(pils.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))); 
      setDrones(drns); 
      setCurrentUser(me);
    } catch(e) {}
  };

  const handleNewMission = () => {
    setFormData(initialFormState);
    setIsEditing(null);
    setIsCreating(true);
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => setFormData(prev => ({ ...prev, latitude: pos.coords.latitude, longitude: pos.coords.longitude })),
            null, { enableHighAccuracy: true }
        );
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
      if (!isCreating) return;
      setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
  };

  const addPointOfInterest = () => {
      setFormData(prev => ({ ...prev, takeoff_points: [...prev.takeoff_points, { lat: prev.latitude, lng: prev.longitude, alt: prev.flight_altitude }] }));
  };

  const performSave = async () => {
    setLoading(true);
    try {
      let finalPayload: any = { ...formData };
      
      if (formData.is_summer_op && formData.summer_city && formData.summer_pgv) {
          finalPayload.name = `VERÃO: ${formData.summer_city} - ${formData.summer_pgv}`;
      }

      if (!isEditing) {
          const unitToUse = formData.op_unit || pilots.find(p => p.id === formData.pilot_id)?.unit || "";
          const crbmToUse = formData.op_crbm || pilots.find(p => p.id === formData.pilot_id)?.crbm || "";
          finalPayload.occurrence_number = generateNextProtocol(operations, unitToUse, crbmToUse);
          const combinedDateTime = `${formData.date}T${formData.start_time_local}:00`;
          finalPayload.start_time = new Date(combinedDateTime).toISOString();
          
          if (formData.end_time_local) {
              const endDateTime = `${formData.date}T${formData.end_time_local}:00`;
              finalPayload.end_time = new Date(endDateTime).toISOString();
          }
      }
      
      const uiOnlyFields = ['date', 'start_time_local', 'end_time_local', 'summer_city', 'summer_pgv'];
      uiOnlyFields.forEach(f => delete finalPayload[f]);
      finalPayload.latitude = Number(finalPayload.latitude);
      finalPayload.longitude = Number(finalPayload.longitude);

      if (isEditing) await base44.entities.Operation.update(isEditing, finalPayload);
      else {
          await base44.entities.Operation.create(finalPayload);
          if (finalPayload.drone_id) await base44.entities.Drone.update(finalPayload.drone_id, { status: 'in_operation' });
      }
      setIsCreating(false); setIsEditing(null); loadData();
    } catch (e) { alert("Erro ao salvar missão."); } finally { setLoading(false); }
  };

  const handleShareOp = (op: Operation) => {
    const pilot = pilots.find(p => p.id === op.pilot_id);
    const drone = drones.find(d => d.id === op.drone_id);
    const startTime = new Date(op.start_time);
    let locStr = `📍 *Ponto Principal:* ${op.latitude.toFixed(6)}, ${op.longitude.toFixed(6)}\n📏 *Raio:* ${op.radius}m | ✈️ *Alt:* ${op.flight_altitude || 60}m`;
    if (op.takeoff_points?.length) {
        locStr += `\n\n🔗 *Áreas Vinculadas:*`;
        op.takeoff_points.forEach((pt, i) => locStr += `\n🔹 PT ${i+1}: ${pt.lat.toFixed(6)}, ${pt.lng.toFixed(6)} (Alt: ${pt.alt}m)`);
    }
    const text = `🚨 *SYSARP - SITUAÇÃO OPERACIONAL* 🚨\n\n🚁 *Ocorrência:* ${op.name.toUpperCase()}\n🔢 *Protocolo:* ${op.occurrence_number}\n📋 *Natureza:* ${MISSION_HIERARCHY[op.mission_type]?.label || op.mission_type}\n\n👤 *PIC:* ${pilot?.full_name || 'N/A'}\n🛡️ *Aeronave:* ${drone ? `${drone.prefix} (${drone.model})` : 'N/A'}\n\n${locStr}\n\n🕒 *Início:* ${startTime.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const groupedResources = useMemo(() => {
    const groups: Record<string, { pilots: Pilot[], drones: Drone[] }> = {};
    Object.keys(UNIT_COORDINATES).forEach(key => groups[key] = { pilots: [], drones: [] });
    pilots.forEach(p => {
        if (p.status !== 'active') return;
        const match = Object.keys(UNIT_COORDINATES).find(unitKey => p.unit?.toLowerCase().includes(unitKey.split(' - ')[1]?.toLowerCase() || "___"));
        if (match) groups[match].pilots.push(p);
    });
    drones.forEach(d => {
        if (d.status === 'in_operation') return;
        const match = Object.keys(UNIT_COORDINATES).find(unitKey => d.unit?.toLowerCase().includes(unitKey.split(' - ')[1]?.toLowerCase() || "___"));
        if (match) groups[match].drones.push(d);
    });
    return groups;
  }, [pilots, drones]);

  const displayedOps = activeTab === 'active' ? operations.filter(o => o.status === 'active') : operations.filter(o => o.status !== 'active');

  return (
    <div className="flex flex-col lg:flex-row h-full w-full relative bg-slate-100 overflow-hidden font-sans">
      
      {/* MAPA */}
      <div className="flex-1 w-full relative z-0 order-1 lg:order-1 border-b lg:border-r border-slate-200 min-h-0">
        <MapContainer center={[-25.2521, -52.0215]} zoom={8} style={{ height: '100%', width: '100%' }}>
          <MapController isPanelCollapsed={isPanelCollapsed} />
          {isCreating && <MapPanController lat={formData.latitude} lng={formData.longitude} />}
          {isCreating && <MapEventsHandler onMapClick={handleMapClick} />}
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          {visibleLayers.missions && displayedOps.map(op => {
             const opColor = MISSION_COLORS[op.mission_type] || '#ef4444';
             return (
             <React.Fragment key={`map-op-${op.id}`}>
               <Marker position={[op.latitude, op.longitude]} icon={getIcon(opColor)}>
                  <Popup>
                    <div className="min-w-[200px] p-1">
                        <h4 className="font-bold border-b pb-1 mb-1 uppercase text-xs">{op.name}</h4>
                        <Badge variant="danger">{MISSION_HIERARCHY[op.mission_type]?.label}</Badge>
                        <p className="text-[10px] mt-2 text-slate-500 font-mono">#{op.occurrence_number}</p>
                    </div>
                  </Popup>
               </Marker>
               <Circle center={[op.latitude, op.longitude]} radius={op.radius || 500} pathOptions={{ color: opColor, fillOpacity: 0.1, weight: 2 }} />
               {(op.takeoff_points || []).map((pt: any, i: number) => (
                    <React.Fragment key={`${op.id}-pt-${i}`}>
                        <Marker position={[pt.lat, pt.lng]} icon={getIcon(opColor)} opacity={0.8} />
                        <Circle center={[pt.lat, pt.lng]} radius={op.radius || 500} pathOptions={{ color: opColor, fillOpacity: 0.05, dashArray: '5, 10', weight: 1 }} />
                    </React.Fragment>
               ))}
             </React.Fragment>
          )})}

          {Object.entries(UNIT_COORDINATES).map(([unitName, coords]) => {
              const group = groupedResources[unitName];
              return (
                  <React.Fragment key={`res-${unitName}`}>
                    {visibleLayers.units && (
                        <Marker position={coords} icon={createCustomIcon('unit')}>
                            <Popup><span className="font-bold text-red-700 text-xs uppercase">{unitName}</span></Popup>
                        </Marker>
                    )}
                    {visibleLayers.pilots && group.pilots.length > 0 && (
                        <Marker position={[coords[0] - 0.005, coords[1]]} icon={createCustomIcon('pilot', group.pilots.length)}>
                            <Popup>
                                <div className="min-w-[200px] p-1">
                                    <h4 className="font-black text-blue-700 border-b pb-2 mb-2 uppercase text-[10px]">Pilotos Disponíveis - {unitName}</h4>
                                    {group.pilots.map(p => (
                                        <div key={p.id} className="flex justify-between items-center bg-slate-50 p-2 rounded mb-1 border border-slate-100">
                                            <span className="text-xs font-bold text-slate-700">{p.full_name}</span>
                                            <button onClick={() => window.open(`https://wa.me/55${p.phone?.replace(/\D/g,'')}`)} className="p-1 bg-green-500 text-white rounded-full hover:bg-green-600 shadow-sm"><Phone className="w-3 h-3" /></button>
                                        </div>
                                    ))}
                                </div>
                            </Popup>
                        </Marker>
                    )}
                    {visibleLayers.fleet && group.drones.length > 0 && (
                        <Marker position={[coords[0], coords[1] + 0.008]} icon={createCustomIcon('drone', group.drones.length)}>
                             <Popup>
                                <div className="min-w-[200px] p-1">
                                    <h4 className="font-black text-orange-700 border-b pb-2 mb-2 uppercase text-[10px]">Aeronaves em Garagem - {unitName}</h4>
                                    {group.drones.map(d => (
                                        <div key={d.id} className="flex justify-between items-center bg-slate-50 p-2 rounded mb-1 border border-slate-100">
                                            <span className="text-xs font-bold text-slate-700">{d.prefix}</span>
                                            <Badge variant="success">{d.status.toUpperCase()}</Badge>
                                        </div>
                                    ))}
                                </div>
                            </Popup>
                        </Marker>
                    )}
                  </React.Fragment>
              );
          })}

          {isCreating && (
              <>
                <Marker position={[formData.latitude, formData.longitude]} icon={getIcon('#dc2626')} />
                <Circle center={[formData.latitude, formData.longitude]} radius={formData.radius} pathOptions={{ color: '#dc2626', dashArray: '5, 10', weight: 2 }} />
              </>
          )}

          {/* CONTROLES (BOTTOM LEFT) */}
          <div className="leaflet-bottom leaflet-left" style={{ marginBottom: '25px', marginLeft: '15px', pointerEvents: 'auto' }}>
              <div className="bg-white/95 backdrop-blur-md p-2 rounded-2xl shadow-2xl border border-slate-200 flex flex-col gap-2">
                  <button onClick={() => setVisibleLayers(p => ({...p, missions: !p.missions}))} className={`p-2.5 rounded-xl transition-all ${visibleLayers.missions ? 'bg-red-600 text-white scale-110 shadow-lg' : 'bg-slate-100 text-slate-400'}`} title="Missões"><Radio className="w-5 h-5"/></button>
                  <button onClick={() => setVisibleLayers(p => ({...p, fleet: !p.fleet}))} className={`p-2.5 rounded-xl transition-all ${visibleLayers.fleet ? 'bg-orange-600 text-white scale-110 shadow-lg' : 'bg-slate-100 text-slate-400'}`} title="Frota"><Plane className="w-5 h-5"/></button>
                  <button onClick={() => setVisibleLayers(p => ({...p, pilots: !p.pilots}))} className={`p-2.5 rounded-xl transition-all ${visibleLayers.pilots ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'bg-slate-100 text-slate-400'}`} title="Efetivo"><Users className="w-5 h-5"/></button>
                  <button onClick={() => setVisibleLayers(p => ({...p, units: !p.units}))} className={`p-2.5 rounded-xl transition-all ${visibleLayers.units ? 'bg-slate-800 text-white scale-110 shadow-lg' : 'bg-slate-100 text-slate-400'}`} title="Bases"><Shield className="w-5 h-5"/></button>
              </div>
          </div>
        </MapContainer>
        
        <div className="absolute top-4 right-4 z-[1000]">
            <button onClick={() => setIsPanelCollapsed(!isPanelCollapsed)} className="bg-white p-2.5 rounded-lg shadow-xl border text-slate-600 hover:bg-slate-50">
                {isPanelCollapsed ? <MousePointer2 className="w-6 h-6" /> : <Layers className="w-6 h-6" />}
            </button>
        </div>
      </div>

      {/* PAINEL LATERAL */}
      <div className={`bg-white z-10 flex flex-col shadow-2xl overflow-hidden order-2 transition-all duration-300 ${isPanelCollapsed ? 'lg:w-0' : 'lg:w-[38rem]'} w-full ${isPanelCollapsed ? 'h-0' : 'h-[65vh] lg:h-full'}`}>
        <div className="flex-1 flex flex-col h-full overflow-hidden w-full lg:min-w-[38rem]">
            {isCreating ? (
                <div className="flex-1 flex flex-col h-full overflow-y-auto p-5 bg-slate-50/30">
                    <div className="flex justify-between items-center mb-5 border-b pb-3">
                      <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Radio className="w-5 h-5 text-red-600" />Lançar Operação RPA</h2>
                      <button onClick={() => { setIsCreating(false); setIsEditing(null); }} className="p-1 hover:bg-slate-200 rounded text-slate-400"><X className="w-5 h-5" /></button>
                    </div>
                    
                    <form onSubmit={e => { e.preventDefault(); performSave(); }} className="space-y-6 pb-10">
                        
                        {/* 1. ÁREA */}
                        <section className="bg-white p-4 rounded-xl shadow-sm border space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b pb-2"><Shield className="w-3 h-3"/> 1. Lotação Operacional</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <Select label="CRBM" value={formData.op_crbm} onChange={e => setFormData({...formData, op_crbm: e.target.value, op_unit: ''})} required>
                                   <option value="">Selecione...</option>
                                   {Object.keys(ORGANIZATION_CHART).map(crbm => <option key={crbm} value={crbm}>{crbm}</option>)}
                                </Select>
                                <Select label="Unidade" value={formData.op_unit} onChange={e => setFormData({...formData, op_unit: e.target.value})} required disabled={!formData.op_crbm}>
                                   <option value="">Selecione...</option>
                                   {formData.op_crbm && (ORGANIZATION_CHART as any)[formData.op_crbm]?.map((u: string) => <option key={u} value={u}>{u}</option>)}
                                </Select>
                            </div>
                        </section>

                        {/* 2. MISSÃO */}
                        <section className="bg-white p-4 rounded-xl shadow-sm border space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b pb-2"><Navigation className="w-3 h-3"/> 2. Dados da Missão</h3>
                            <Input label="Título da Ocorrência" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="Ex: Incêndio Urbano..." />
                            <div className="grid grid-cols-2 gap-3">
                               <Select label="Natureza" value={formData.mission_type} onChange={e => setFormData({...formData, mission_type: e.target.value as any})} required>
                                  {Object.entries(MISSION_HIERARCHY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                               </Select>
                               <Select label="Subnatureza" value={formData.sub_mission_type} onChange={e => setFormData({...formData, sub_mission_type: e.target.value})} required>
                                  <option value="">Selecione...</option>
                                  {MISSION_HIERARCHY[formData.mission_type]?.subtypes.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                               </Select>
                            </div>
                        </section>

                        {/* 3. EQUIPE E RPA */}
                        <section className="bg-white p-4 rounded-xl shadow-sm border space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b pb-2"><Users className="w-3 h-3"/> 3. Equipe e Aeronave</h3>
                            <div className="grid grid-cols-2 gap-3">
                              <Select label="Piloto (PIC)" value={formData.pilot_id} onChange={e => setFormData({...formData, pilot_id: e.target.value})} required>
                                  <option value="">Selecione...</option>
                                  {pilots.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                              </Select>
                              <Select label="Aeronave (RPA)" value={formData.drone_id} onChange={e => setFormData({...formData, drone_id: e.target.value})} required>
                                <option value="">Selecione...</option>
                                {drones.filter(d => d.status === 'available' || d.id === formData.drone_id).map(d => <option key={d.id} value={d.id}>{d.prefix} - {d.model}</option>)}
                              </Select>
                            </div>
                            <Input label="Observador / Auxiliar" value={formData.observer_name} onChange={e => setFormData({...formData, observer_name: e.target.value})} placeholder="Nome do Observador (Opcional)" />
                        </section>

                        {/* 4. SUPORTE E INTEGRAÇÕES (Print do Usuário) */}
                        <section className="bg-white p-4 rounded-xl shadow-sm border space-y-5">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b pb-2"><Globe className="w-3 h-3"/> 4. Integração e Transmissão</h3>
                            
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative group">
                                <div className="absolute -top-2 right-4">
                                    <Badge variant="warning" className="text-[9px] flex items-center gap-1 shadow-sm"><Terminal className="w-2.5 h-2.5"/> Em Construção</Badge>
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Send className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm font-bold text-slate-700">Integração SARPAS</span>
                                </div>
                                <Input 
                                    label="Protocolo SARPAS (Manual)" 
                                    labelClassName="text-[10px] font-black text-slate-400 uppercase"
                                    value={formData.sarpas_protocol} 
                                    onChange={e => setFormData({...formData, sarpas_protocol: e.target.value})} 
                                    placeholder="Ex: BR-2024-..." 
                                />
                            </div>

                            <div>
                                <label className="text-xs font-black text-slate-500 uppercase mb-1 block">Link de Transmissão (Opcional)</label>
                                <Input 
                                    value={formData.stream_url} 
                                    onChange={e => setFormData({...formData, stream_url: e.target.value})} 
                                    placeholder="RTMP / YouTube / DroneDeploy" 
                                    className="bg-white"
                                />
                            </div>
                        </section>

                        {/* 5. CONFIGURAÇÕES ESPECIAIS (Verão e Multidias) */}
                        <section className="bg-white p-4 rounded-xl shadow-sm border space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between items-center border-b pb-2">
                               <div className="flex items-center gap-2"><Activity className="w-3 h-3"/> 5. Configurações Especiais</div>
                            </h3>

                            <div className="space-y-3">
                                <label className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-100 rounded-xl cursor-pointer group transition-all hover:bg-orange-100/50">
                                    <input type="checkbox" checked={formData.is_summer_op} onChange={e => setFormData({...formData, is_summer_op: e.target.checked})} className="w-5 h-5 accent-orange-500 rounded" />
                                    <div className="flex items-center gap-2">
                                        <Sun className="w-5 h-5 text-orange-600" />
                                        <span className="text-sm font-bold text-orange-900 uppercase">Vincular à Operação Verão</span>
                                    </div>
                                </label>

                                {formData.is_summer_op && (
                                    <div className="p-4 bg-white rounded-xl border border-orange-200 animate-fade-in grid grid-cols-2 gap-4 shadow-inner">
                                        <Select label="Cidade Verão" value={formData.summer_city} onChange={e => setFormData({...formData, summer_city: e.target.value, summer_pgv: ''})}>
                                            <option value="">Selecione...</option>
                                            {Object.keys(SUMMER_LOCATIONS).map(c => <option key={c} value={c}>{c}</option>)}
                                        </Select>
                                        <Select label="Posto (PGV)" value={formData.summer_pgv} onChange={e => setFormData({...formData, summer_pgv: e.target.value})} disabled={!formData.summer_city}>
                                            <option value="">Selecione...</option>
                                            {formData.summer_city && SUMMER_LOCATIONS[formData.summer_city as keyof typeof SUMMER_LOCATIONS].map(p => <option key={p} value={p}>{p}</option>)}
                                        </Select>
                                    </div>
                                )}

                                <label className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl cursor-pointer group transition-all hover:bg-blue-100/50">
                                    <input type="checkbox" checked={formData.is_multi_day} onChange={e => setFormData({...formData, is_multi_day: e.target.checked})} className="w-5 h-5 accent-blue-600 rounded" />
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-blue-600" />
                                        <span className="text-sm font-bold text-blue-900 uppercase">Ativar Modo Multidias (Diário de Bordo)</span>
                                    </div>
                                </label>

                                {formData.is_multi_day && (
                                    <div className="p-4 bg-white rounded-xl border border-blue-200 animate-fade-in text-xs text-blue-800 flex items-start gap-3 shadow-inner">
                                        <Info className="w-5 h-5 shrink-0" />
                                        <div>
                                            <p className="font-bold">Modo Avançado de Gerenciamento</p>
                                            <p className="opacity-80">Permite designar pilotos, drones e relatos individuais para cada dia da missão.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* 6. LOCALIZAÇÃO */}
                        <section className="bg-white p-4 rounded-xl shadow-sm border space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2"><MapPin className="w-3 h-3"/> 6. Geolocalização</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Latitude" type="number" step="any" value={formData.latitude} onChange={e => setFormData({...formData, latitude: Number(e.target.value)})} />
                                <Input label="Longitude" type="number" step="any" value={formData.longitude} onChange={e => setFormData({...formData, longitude: Number(e.target.value)})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Raio de Voo (m)" type="number" value={formData.radius} onChange={e => setFormData({...formData, radius: Number(e.target.value)})} />
                                <Input label="Altitude Máx (m AGL)" type="number" value={formData.flight_altitude} onChange={e => setFormData({...formData, flight_altitude: Number(e.target.value)})} />
                            </div>
                            <Button type="button" variant="outline" onClick={addPointOfInterest} className="w-full h-11 border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all font-bold">
                                <Plus className="w-4 h-4 mr-2" /> VINCULAR ÁREA DE APOIO
                            </Button>
                        </section>

                        {/* 7. CRONOGRAMA */}
                        <section className="bg-white p-4 rounded-xl shadow-sm border space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2"><Clock className="w-3 h-3"/> 7. Cronograma Operacional</h3>
                            <div className="grid grid-cols-3 gap-3">
                                <Input label="Data" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                                <Input label="Início" type="time" value={formData.start_time_local} onChange={e => setFormData({...formData, start_time_local: e.target.value})} />
                                <Input label="Término Previsto" type="time" value={formData.end_time_local} onChange={e => setFormData({...formData, end_time_local: e.target.value})} />
                            </div>
                        </section>

                        {/* 8. DESCRIÇÃO / NOTAS (Print do Usuário) */}
                        <section className="bg-white p-4 rounded-xl shadow-sm border space-y-3">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2"><FileText className="w-3 h-3"/> 8. Descrição / Notas</h3>
                            <textarea 
                                className="w-full h-32 p-4 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none bg-white text-slate-900"
                                placeholder="Detalhes da operação..."
                                value={formData.description}
                                onChange={e => setFormData({...formData, description: e.target.value})}
                            />
                        </section>

                        {/* AÇÕES FINAIS */}
                        <div className="pt-6 border-t flex gap-4">
                           <Button variant="outline" className="flex-1 h-12 font-bold uppercase text-xs" type="button" onClick={() => setIsCreating(false)}>Cancelar</Button>
                           <Button type="submit" className="flex-[2] h-12 bg-red-700 text-white font-black shadow-lg uppercase tracking-widest text-xs" disabled={loading}>
                               {loading ? 'Salvando...' : 'INICIAR MISSÃO RPA'}
                           </Button>
                        </div>
                    </form>
                </div>
            ) : viewingLogOp ? (
                <div className="flex-1 flex flex-col h-full overflow-y-auto p-5 bg-white animate-fade-in">
                    <div className="flex justify-between items-center mb-6 border-b pb-4">
                        <div>
                           <h2 className="text-xl font-bold text-slate-800">Diário de Bordo</h2>
                           <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">{viewingLogOp.name}</p>
                        </div>
                        <button onClick={() => setViewingLogOp(null)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6 text-slate-400" /></button>
                    </div>
                    <OperationDailyLog operationId={viewingLogOp.id} pilots={pilots} drones={drones} currentUser={currentUser} />
                </div>
            ) : (
                <>
                    <div className="p-5 border-b bg-white flex justify-between items-center shadow-sm shrink-0">
                        <div><h2 className="text-xl font-bold text-slate-800">Missões RPA</h2><p className="text-[10px] text-slate-400 uppercase font-bold">Monitoramento Tempo Real</p></div>
                        <Button onClick={handleNewMission} className="bg-red-700 text-white h-10 px-6 font-bold shadow-lg text-xs uppercase"><Plus className="w-4 h-4 mr-1.5" /> NOVA MISSÃO</Button>
                    </div>
                    <div className="px-5 py-3 bg-slate-50 shrink-0">
                       <div className="bg-slate-200 p-1 rounded-lg flex gap-1 shadow-inner">
                          <button onClick={() => setActiveTab('active')} className={`flex-1 py-2 text-xs font-black rounded-md transition-all ${activeTab === 'active' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>ATIVAS</button>
                          <button onClick={() => setActiveTab('history')} className={`flex-1 py-2 text-xs font-black rounded-md transition-all ${activeTab === 'history' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>HISTÓRICO</button>
                       </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30">
                        {displayedOps.map(op => (
                            <Card key={op.id} className={`bg-white border rounded-xl overflow-hidden shadow-sm border-l-4 ${op.status === 'active' ? 'border-l-red-600' : 'border-l-slate-400'} hover:shadow-md transition-all`}>
                                <div className="p-4">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1 pr-3">
                                            <h3 className="font-bold text-slate-800 text-base leading-tight uppercase">{op.name}</h3>
                                            <p className="text-[9px] font-mono text-slate-400 mt-0.5">#{op.occurrence_number}</p>
                                        </div>
                                        <Badge variant={op.status === 'active' ? 'success' : op.status === 'completed' ? 'default' : 'danger'}>{op.status === 'active' ? 'EM ANDAMENTO' : op.status.toUpperCase()}</Badge>
                                    </div>
                                    <div className="text-[11px] font-bold text-slate-500 space-y-1.5 mb-5">
                                        <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-slate-300" /> {new Date(op.start_time).toLocaleString()}</div>
                                        <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-slate-300" /> PIC: {pilots.find(p => p.id === op.pilot_id)?.full_name}</div>
                                        {op.takeoff_points && op.takeoff_points.length > 0 && <div className="flex items-center gap-2 text-blue-600 font-black uppercase text-[9px] tracking-tight"><Layers className="w-3 h-3" /> Multi-pontos: {op.takeoff_points.length + 1} áreas</div>}
                                    </div>
                                    {op.status === 'active' && (
                                        <div className="space-y-3 pt-3 border-t border-slate-100">
                                            <div className="flex gap-2">
                                                <button onClick={() => handleShareOp(op)} className="p-2.5 rounded-lg border bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"><Share2 className="w-4 h-4" /></button>
                                                <button onClick={() => alert("Recurso em desenvolvimento...")} className="p-2.5 rounded-lg border bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors"><Pause className="w-4 h-4" /></button>
                                                <button onClick={() => { setFormData({...op} as any); setIsEditing(op.id); setIsCreating(true); }} className="p-2.5 rounded-lg border bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors"><Pencil className="w-4 h-4" /></button>
                                                {op.is_multi_day && <button onClick={() => setViewingLogOp(op)} className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border bg-blue-600 text-white hover:bg-blue-700 transition-colors text-[10px] font-black uppercase"><FileText className="w-4 h-4"/> Diário Bordo <ChevronRight className="w-3 h-3"/></button>}
                                            </div>
                                            <div className="flex gap-3">
                                                <Button onClick={() => setIsCancellingOp(op)} variant="outline" className="flex-1 h-11 border-red-600 text-red-600 hover:bg-red-50 text-[10px] font-black uppercase shadow-sm"><XCircle className="w-4 h-4 mr-1.5" /> Cancelar</Button>
                                                <Button onClick={() => setIsFinishing(op)} className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase shadow-md"><CheckSquare className="w-4 h-4 mr-1.5" /> Encerrar</Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                </>
            )}
        </div>
      </div>
      
      {/* MODALS */}
      {isFinishing && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card className="w-full max-w-lg bg-white p-8 rounded-2xl shadow-2xl border-t-8 border-green-600 animate-fade-in">
                <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl font-black text-green-700 flex items-center gap-2"><CheckSquare className="w-6 h-6" /> CONCLUIR VOO</h2>
                    <button onClick={() => setIsFinishing(null)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
                </div>
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    setLoading(true);
                    try {
                        const timeParts = finishData.flight_hours.split(':');
                        const flightHours = parseInt(timeParts[0] || '0', 10) + (parseInt(timeParts[1] || '0', 10) / 60);
                        await base44.entities.Operation.update(isFinishing.id, { status: 'completed', flight_hours: flightHours, actions_taken: finishData.description, end_time: new Date().toISOString() });
                        if (isFinishing.drone_id) await base44.entities.Drone.update(isFinishing.drone_id, { status: 'available', total_flight_hours: (drones.find(d => d.id === isFinishing.drone_id)?.total_flight_hours || 0) + flightHours });
                        setIsFinishing(null); loadData();
                    } catch (e) { alert("Erro ao encerrar."); } finally { setLoading(false); }
                }} className="space-y-5">
                    <div className="bg-slate-50 p-4 rounded-xl border">
                        <label className="text-xs font-black text-slate-500 uppercase mb-2 block">Duração Efetiva (HH:mm)</label>
                        <Input type="text" placeholder="00:00" value={finishData.flight_hours} onChange={e => setFinishData({...finishData, flight_hours: e.target.value.replace(/[^0-9:]/g, '')})} required className="text-2xl font-mono text-center h-16 shadow-inner" />
                    </div>
                    <textarea className="w-full p-4 border rounded-xl text-sm h-32 outline-none resize-none bg-white" value={finishData.description} onChange={e => setFinishData({...finishData, description: e.target.value})} placeholder="Relate o desfecho operacional..." />
                    <div className="flex gap-3 pt-2">
                        <Button type="button" variant="outline" className="flex-1 h-12 font-bold uppercase text-xs" onClick={() => setIsFinishing(null)}>CANCELAR</Button>
                        <Button type="submit" disabled={loading} className="flex-[2] h-12 bg-green-600 hover:bg-green-700 text-white font-black shadow-xl uppercase tracking-widest text-xs">Gravar e Finalizar</Button>
                    </div>
                </form>
            </Card>
        </div>
      )}
      {isCancellingOp && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card className="w-full max-w-lg bg-white p-8 rounded-2xl shadow-2xl border-t-8 border-red-600 animate-fade-in">
                <div className="flex justify-between items-start mb-6"><h2 className="text-2xl font-black text-red-700 flex items-center gap-2"><AlertTriangle className="w-8 h-8 text-red-600" /> CANCELAR</h2><button onClick={() => setIsCancellingOp(null)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button></div>
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!isAcknowledgeCancel) return;
                    setLoading(true);
                    try {
                        await base44.entities.Operation.update(isCancellingOp.id, { status: 'cancelled', end_time: new Date().toISOString(), description: `CANCELADO: ${cancelReason}` });
                        if(isCancellingOp.drone_id) await base44.entities.Drone.update(isCancellingOp.drone_id, { status: 'available' });
                        setIsCancellingOp(null); loadData();
                    } catch(e) { alert("Erro ao cancelar."); } finally { setLoading(false); }
                }} className="space-y-6">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100"><p className="text-sm text-red-800">Deseja cancelar a missão: <strong>{isCancellingOp.name}</strong>?</p></div>
                    <textarea className="w-full p-4 border rounded-xl text-sm h-32 outline-none resize-none bg-white" placeholder="Motivo..." required value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
                    <label className="flex items-start gap-3 cursor-pointer p-4 bg-slate-50 rounded-xl border"><input type="checkbox" className="mt-1 w-5 h-5 accent-red-600 rounded" checked={isAcknowledgeCancel} onChange={e => setIsAcknowledgeCancel(e.target.checked)} required /><span className="text-xs font-bold text-slate-600">Estou ciente que esta ação é irreversível.</span></label>
                    <div className="flex gap-3 pt-2"><Button type="button" variant="outline" className="flex-1 h-12 font-bold" onClick={() => setIsCancellingOp(null)}>VOLTAR</Button><Button type="submit" disabled={loading || !isAcknowledgeCancel} className="flex-[2] h-12 bg-red-600 text-white font-black shadow-xl uppercase text-xs">CONFIRMAR</Button></div>
                </form>
            </Card>
        </div>
      )}
    </div>
  );
}
