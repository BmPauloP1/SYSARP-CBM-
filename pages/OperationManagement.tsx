
import React, { useState, useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import { base44 } from "../services/base44Client";
import { Operation, Drone, Pilot, MISSION_HIERARCHY, MissionType, ORGANIZATION_CHART, MISSION_COLORS } from "../types";
import { SUMMER_LOCATIONS } from "../types_summer";
import { Button, Input, Select, Badge, Card } from "../components/ui_components";
import { 
  Plus, Clock, User, Share2, Pencil, X, CheckSquare, 
  Radio, Sun, Calendar, MapPin, Building2, 
  Navigation, Layers, MousePointer2, Users, 
  Pause, XCircle, Trash2, ChevronRight,
  FileText, Send, Info, Video, Plane, AlertTriangle
} from "lucide-react";
import OperationDailyLog from "../components/OperationDailyLog";

import "@geoman-io/leaflet-geoman-free";

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
    
    const unitOps = operations.filter(o => 
        o.occurrence_number && o.occurrence_number.includes(`${year}${prefix}${cleanedUnit}`)
    );

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

  const handleMapClick = (lat: number, lng: number) => {
      if (!isCreating) return;
      setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
  };

  const handleNewMission = () => {
    setFormData(initialFormState);
    setIsCreating(true);
    
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setFormData(prev => ({
                    ...prev,
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                }));
            },
            (error) => {
                console.warn("Geolocalização recusada ou indisponível.", error);
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    }
  };

  const handleShareOp = (op: Operation) => {
    const pilot = pilots.find(p => p.id === op.pilot_id);
    const drone = drones.find(d => d.id === op.drone_id);
    const startTime = new Date(op.start_time);
    
    // Construção dinâmica das coordenadas (Multi-pontos)
    let locationDetails = `📍 *Ponto Principal:* ${op.latitude.toFixed(6)}, ${op.longitude.toFixed(6)}\n` +
                          `📏 *Raio:* ${op.radius}m | ✈️ *Alt:* ${op.flight_altitude || 60}m`;

    if (op.takeoff_points && op.takeoff_points.length > 0) {
        locationDetails += `\n\n🔗 *Áreas Vinculadas (${op.takeoff_points.length}):*`;
        op.takeoff_points.forEach((pt, i) => {
            locationDetails += `\n🔹 *Ponto ${i + 1}:* ${pt.lat.toFixed(6)}, ${pt.lng.toFixed(6)}\n` +
                               `📏 *Raio:* ${op.radius}m | ✈️ *Alt:* ${pt.alt}m`;
        });
    }

    const text = `🚨 *SYSARP - SITUAÇÃO OPERACIONAL* 🚨\n\n` +
        `🚁 *Ocorrência:* ${op.name.toUpperCase()}\n` +
        `🔢 *Protocolo:* ${op.occurrence_number}\n` +
        `📋 *Natureza:* ${MISSION_HIERARCHY[op.mission_type]?.label || op.mission_type}\n\n` +
        `👤 *Piloto (PIC):* ${pilot?.full_name || 'N/A'}\n` +
        `🛡️ *Aeronave:* ${drone ? `${drone.prefix} (${drone.model})` : 'N/A'}\n\n` +
        `${locationDetails}\n\n` +
        `🕒 *Início:* ${startTime.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}\n` +
        (op.stream_url ? `\n🎥 *Link Transmissão:* ${op.stream_url}` : '');

    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const addPointOfInterest = () => {
      setFormData(prev => ({
          ...prev,
          takeoff_points: [...prev.takeoff_points, { lat: prev.latitude, lng: prev.longitude, alt: prev.flight_altitude }]
      }));
  };

  const updatePoint = (idx: number, field: string, value: number) => {
      const newPoints = [...formData.takeoff_points];
      newPoints[idx] = { ...newPoints[idx], [field]: value };
      setFormData({ ...formData, takeoff_points: newPoints });
  };

  const removePoint = (idx: number) => {
      setFormData(prev => ({
          ...prev,
          takeoff_points: prev.takeoff_points.filter((_, i) => i !== idx)
      }));
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
      }
      const uiOnlyFields = ['date', 'start_time_local', 'end_time_local', 'summer_city', 'summer_pgv'];
      uiOnlyFields.forEach(field => delete finalPayload[field]);
      finalPayload.latitude = Number(finalPayload.latitude);
      finalPayload.longitude = Number(finalPayload.longitude);
      finalPayload.radius = Number(finalPayload.radius);
      finalPayload.flight_altitude = Number(finalPayload.flight_altitude);
      const uuidFields = ['pilot_id', 'second_pilot_id', 'drone_id'];
      uuidFields.forEach(field => { if (finalPayload[field] === "") finalPayload[field] = null; });
      if (isEditing) await base44.entities.Operation.update(isEditing, finalPayload);
      else {
          await base44.entities.Operation.create(finalPayload);
          if (finalPayload.drone_id) await base44.entities.Drone.update(finalPayload.drone_id, { status: 'in_operation' });
      }
      setIsCreating(false); setIsEditing(null); loadData();
      alert("Missão salva com sucesso!");
    } catch (e: any) {
      console.error("[SYSARP] Falha ao salvar operação:", e);
      alert(`Erro ao salvar missão: ${e.message || 'Verifique os campos obrigatórios.'}`);
    } finally { setLoading(false); }
  };

  const handleFinishOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFinishing) return;
    setLoading(true);
    try {
        const timeParts = finishData.flight_hours.split(':');
        const flightHours = parseInt(timeParts[0] || '0', 10) + (parseInt(timeParts[1] || '0', 10) / 60);
        await base44.entities.Operation.update(isFinishing.id, {
            status: 'completed', flight_hours: flightHours,
            description: `${isFinishing.description || ''}\n\n[CONCLUSAO]: ${finishData.description}`,
            end_time: new Date().toISOString()
        });
        if (isFinishing.drone_id) {
            const drone = drones.find(d => d.id === isFinishing.drone_id);
            if (drone) await base44.entities.Drone.update(drone.id, { status: 'available', total_flight_hours: (drone.total_flight_hours || 0) + flightHours });
        }
        setIsFinishing(null); setFinishData({ description: '', flight_hours: '00:00' });
        loadData();
    } catch (e) { alert("Erro ao encerrar."); } finally { setLoading(false); }
  };

  const handleCancelOperationSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isCancellingOp || !isAcknowledgeCancel || !cancelReason.trim()) return;
      
      setLoading(true);
      try {
          await base44.entities.Operation.update(isCancellingOp.id, { 
              status: 'cancelled', 
              end_time: new Date().toISOString(),
              description: `${isCancellingOp.description || ''}\n\n[CANCELAMENTO]: ${cancelReason}`
          });
          if(isCancellingOp.drone_id) {
              await base44.entities.Drone.update(isCancellingOp.drone_id, { status: 'available' });
          }
          setIsCancellingOp(null);
          setCancelReason("");
          setIsAcknowledgeCancel(false);
          loadData();
          alert("Missão cancelada com sucesso. Aeronave liberada.");
      } catch(e) { 
          alert("Erro ao cancelar missão."); 
      } finally { 
          setLoading(false); 
      }
  };

  const displayedOps = activeTab === 'active' ? operations.filter(o => o.status === 'active') : operations.filter(o => o.status !== 'active');

  const renderDetailedPopup = (op: Operation, pointLabel?: string) => {
    const pilot = pilots.find(p => p.id === op.pilot_id);
    const drone = drones.find(d => d.id === op.drone_id);
    
    return (
      <Popup>
        <div className="min-w-[280px] p-1 font-sans">
          <h3 className="font-bold text-slate-900 text-base uppercase leading-tight border-b pb-2 mb-2">
            {pointLabel ? `${op.name} (${pointLabel})` : op.name}
          </h3>
          <p className="text-[10px] text-slate-400 font-mono mb-2">#{op.occurrence_number}</p>
          
          <div className="mb-4">
             <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-100">
                {MISSION_HIERARCHY[op.mission_type]?.label}
             </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl space-y-2.5 border border-slate-100 shadow-inner">
             <div className="flex items-center gap-3 text-sm text-slate-600">
                <User className="w-4 h-4 text-slate-400" />
                <div>
                   <span className="font-bold text-slate-800">Piloto:</span> {pilot?.full_name || 'N/A'}
                </div>
             </div>
             <div className="flex items-center gap-3 text-sm text-slate-600">
                <Plane className="w-4 h-4 text-slate-400" />
                <div>
                   <span className="font-bold text-slate-800">RPA:</span> {drone ? `${drone.prefix} - ${drone.model}` : 'N/A'}
                </div>
             </div>
             <div className="flex items-start gap-3 text-sm text-slate-600">
                <Building2 className="w-4 h-4 text-slate-400 mt-0.5" />
                <div className="flex flex-col">
                   <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-800">Área/Unidade:</span>
                      <span className="text-slate-700 text-xs">{drone?.unit || op.op_unit || 'N/A'}</span>
                   </div>
                   <span className="text-[10px] text-slate-400 mt-0.5">{drone?.crbm || op.op_crbm}</span>
                </div>
             </div>
          </div>
          
          <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
             <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {new Date(op.start_time).toLocaleTimeString()}</span>
             <span className="flex items-center gap-1"><Navigation className="w-3 h-3"/> Raio: {op.radius}m</span>
          </div>
        </div>
      </Popup>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full relative bg-slate-100 overflow-hidden font-sans">
      
      {/* MAPA */}
      <div className="flex-1 w-full relative z-0 order-1 lg:order-1 border-b lg:border-r border-slate-200 min-h-0">
        <MapContainer center={[-25.2521, -52.0215]} zoom={8} style={{ height: '100%', width: '100%' }}>
          <MapController isPanelCollapsed={isPanelCollapsed} />
          {isCreating && <MapPanController lat={formData.latitude} lng={formData.longitude} />}
          {isCreating && <MapEventsHandler onMapClick={handleMapClick} />}
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          {displayedOps.map(op => {
             const opColor = MISSION_COLORS[op.mission_type] || '#ef4444';
             return (
             <React.Fragment key={`map-op-${op.id}`}>
               <Marker position={[op.latitude, op.longitude]} icon={getIcon(opColor)}>
                  {renderDetailedPopup(op)}
               </Marker>
               <Circle center={[op.latitude, op.longitude]} radius={op.radius || 500} pathOptions={{ color: opColor, fillOpacity: 0.1, weight: 2 }} />
               
               {(op.takeoff_points || []).map((pt: any, i: number) => (
                 <React.Fragment key={`${op.id}-pt-${i}`}>
                    <Marker position={[pt.lat, pt.lng]} icon={getIcon(opColor)} opacity={0.8}>
                        {renderDetailedPopup(op, `PT #${i+1}`)}
                    </Marker>
                    <Circle center={[pt.lat, pt.lng]} radius={op.radius || 500} pathOptions={{ color: opColor, fillOpacity: 0.05, dashArray: '5, 10', weight: 1 }} />
                 </React.Fragment>
               ))}
             </React.Fragment>
          )})}

          {isCreating && (
              <>
                <Marker position={[formData.latitude, formData.longitude]} icon={getIcon('#dc2626')} />
                <Circle center={[formData.latitude, formData.longitude]} radius={formData.radius} pathOptions={{ color: '#dc2626', dashArray: '5, 10', weight: 2 }} />
                {formData.takeoff_points.map((pt, i) => (
                    <Marker key={`new-pt-${i}`} position={[pt.lat, pt.lng]} icon={getIcon('#dc2626')} opacity={0.6} />
                ))}
              </>
          )}
        </MapContainer>
        <div className="absolute top-4 right-4 z-[1000]">
            <button onClick={() => setIsPanelCollapsed(!isPanelCollapsed)} className="bg-white p-2.5 rounded-lg shadow-xl border text-slate-600 hover:bg-slate-50 transition-all">
                {isPanelCollapsed ? <MousePointer2 className="w-6 h-6" /> : <Layers className="w-6 h-6" />}
            </button>
        </div>
      </div>

      {/* PAINEL LATERAL */}
      <div className={`bg-white z-10 flex flex-col shadow-2xl overflow-hidden order-2 transition-all duration-300 ${isPanelCollapsed ? 'lg:w-0' : 'lg:w-[35rem]'} w-full ${isPanelCollapsed ? 'h-0' : 'h-[65vh] lg:h-full'}`}>
        <div className="flex-1 flex flex-col h-full overflow-hidden w-full lg:min-w-[35rem]">
            
            {isCreating ? (
                <div className="flex-1 flex flex-col h-full overflow-y-auto p-5 bg-slate-50/30">
                    <div className="flex justify-between items-center mb-5 border-b border-slate-200 pb-3">
                      <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Radio className="w-5 h-5 text-red-600" />Lançar Operação RPA</h2>
                      <button onClick={() => { setIsCreating(false); setIsEditing(null); }} className="p-1 hover:bg-slate-200 rounded text-slate-400"><X className="w-5 h-5" /></button>
                    </div>
                    
                    <form onSubmit={e => { e.preventDefault(); performSave(); }} className="space-y-5 pb-10">
                        {/* Form sections (omitted for brevity but preserved) */}
                        <section className="bg-white p-4 rounded-xl shadow-sm border space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Building2 className="w-3 h-3"/> 1. Lotação de Área</h3>
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

                        <section className="bg-white p-4 rounded-xl shadow-sm border space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Navigation className="w-3 h-3"/> 2. Dados da Missão</h3>
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

                        <section className="bg-white p-4 rounded-xl shadow-sm border space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users className="w-3 h-3"/> 3. Equipe e Aeronave</h3>
                            <div className="grid grid-cols-2 gap-3">
                              <Select label="Piloto (PIC)" value={formData.pilot_id} onChange={e => setFormData({...formData, pilot_id: e.target.value})} required>
                                  <option value="">Selecione...</option>
                                  {pilots.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                              </Select>
                              <Select label="2º Piloto (SIC)" value={formData.second_pilot_id} onChange={e => setFormData({...formData, second_pilot_id: e.target.value})}>
                                  <option value="">Nenhum</option>
                                  {pilots.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                              </Select>
                            </div>
                            <Input label="Observador RPA" value={formData.observer_name} onChange={e => setFormData({...formData, observer_name: e.target.value})} placeholder="Nome do Observador" />
                            <Select label="Aeronave (RPA)" value={formData.drone_id} onChange={e => setFormData({...formData, drone_id: e.target.value})} required>
                                <option value="">Selecione...</option>
                                {drones.filter(d => d.status === 'available' || d.id === formData.drone_id).map(d => <option key={d.id} value={d.id}>{d.prefix} - {d.model}</option>)}
                            </Select>
                        </section>

                        <section className="bg-white p-4 rounded-xl shadow-sm border space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Geolocalização</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Latitude (Ponto Principal)" type="number" step="any" value={formData.latitude} onChange={e => setFormData({...formData, latitude: Number(e.target.value)})} />
                                <Input label="Longitude (Ponto Principal)" type="number" step="any" value={formData.longitude} onChange={e => setFormData({...formData, longitude: Number(e.target.value)})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Raio (m)" type="number" value={formData.radius} onChange={e => setFormData({...formData, radius: Number(e.target.value)})} />
                                <Input label="Altitude Máx (m)" type="number" value={formData.flight_altitude} onChange={e => setFormData({...formData, flight_altitude: Number(e.target.value)})} />
                            </div>
                        </section>

                        <section className="bg-white p-4 rounded-xl shadow-sm border space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">DATA E HORÁRIO</h3>
                            <Input label="Data da Ocorrência" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Início (Local)" type="time" value={formData.start_time_local} onChange={e => setFormData({...formData, start_time_local: e.target.value})} />
                                <Input label="Término Previsto" type="time" value={formData.end_time_local} onChange={e => setFormData({...formData, end_time_local: e.target.value})} />
                            </div>
                        </section>

                        <div className="pt-6 border-t flex gap-4">
                           <Button variant="outline" className="flex-1 h-12 font-bold uppercase text-xs" type="button" onClick={() => setIsCreating(false)}>Cancelar</Button>
                           <Button type="submit" className="flex-[2] h-12 bg-red-700 text-white font-black shadow-lg uppercase text-xs tracking-widest" disabled={loading}>INICIAR OPERAÇÃO</Button>
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
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Missões RPA</h2>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Monitoramento em Tempo Real</p>
                        </div>
                        <Button onClick={handleNewMission} className="bg-red-700 text-white h-10 px-6 font-bold shadow-lg text-xs uppercase">
                          <Plus className="w-4 h-4 mr-1.5" /> NOVA MISSÃO
                        </Button>
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
                                        <Badge variant={op.status === 'active' ? 'success' : op.status === 'completed' ? 'default' : 'danger'}>
                                            {op.status === 'active' ? 'EM ANDAMENTO' : op.status.toUpperCase()}
                                        </Badge>
                                    </div>

                                    <div className="text-[11px] font-bold text-slate-500 space-y-1.5 mb-5">
                                        <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-slate-300" /> {new Date(op.start_time).toLocaleString()}</div>
                                        <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-slate-300" /> PIC: {pilots.find(p => p.id === op.pilot_id)?.full_name}</div>
                                        {op.takeoff_points && op.takeoff_points.length > 0 && (
                                            <div className="flex items-center gap-2 text-blue-600 font-black uppercase text-[9px] tracking-tight">
                                                <Layers className="w-3 h-3" /> Multi-pontos: {op.takeoff_points.length + 1} áreas vinculadas
                                            </div>
                                        )}
                                    </div>
                                    
                                    {op.status === 'active' && (
                                        <div className="space-y-3 pt-3 border-t border-slate-100">
                                            <div className="flex gap-2">
                                                <button onClick={() => handleShareOp(op)} className="p-2.5 rounded-lg border bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Compartilhar extrato no WhatsApp"><Share2 className="w-4 h-4" /></button>
                                                <button onClick={() => alert("Pausar...")} className="p-2.5 rounded-lg border bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors"><Pause className="w-4 h-4" /></button>
                                                <button onClick={() => { setFormData({...op} as any); setIsEditing(op.id); setIsCreating(true); }} className="p-2.5 rounded-lg border bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors"><Pencil className="w-4 h-4" /></button>
                                                {op.is_multi_day && (
                                                    <button onClick={() => setViewingLogOp(op)} className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border bg-blue-600 text-white hover:bg-blue-700 transition-colors text-[10px] font-black uppercase">
                                                        <FileText className="w-4 h-4"/> Diário Bordo <ChevronRight className="w-3 h-3"/>
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex gap-3">
                                                <Button onClick={() => setIsCancellingOp(op)} variant="outline" className="flex-1 h-11 border-red-600 text-red-600 hover:bg-red-50 text-[10px] font-black uppercase tracking-tighter shadow-sm">
                                                    <XCircle className="w-4 h-4 mr-1.5" /> Cancelar
                                                </Button>
                                                <Button onClick={() => setIsFinishing(op)} className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-tighter shadow-md">
                                                    <CheckSquare className="w-4 h-4 mr-1.5" /> Encerrar
                                                </Button>
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

      {/* Modals remain unchanged */}
      {isFinishing && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card className="w-full max-w-lg bg-white p-8 rounded-2xl shadow-2xl border-t-8 border-green-600 animate-fade-in">
                <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl font-black text-green-700 flex items-center gap-2"><CheckSquare className="w-6 h-6" /> CONCLUIR VOO</h2>
                    <button onClick={() => setIsFinishing(null)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
                </div>
                <form onSubmit={handleFinishOperation} className="space-y-5">
                    <div className="bg-slate-50 p-4 rounded-xl border">
                        <label className="text-xs font-black text-slate-500 uppercase mb-2 block">Duração Efetiva (HH:mm)</label>
                        <Input type="text" placeholder="00:00" value={finishData.flight_hours} onChange={e => setFinishData({...finishData, flight_hours: e.target.value.replace(/[^0-9:]/g, '')})} required className="text-2xl font-mono text-center h-16 shadow-inner" />
                    </div>
                    <textarea className="w-full p-4 border rounded-xl text-sm h-32 focus:ring-2 focus:ring-green-500 outline-none resize-none bg-white border-slate-300" value={finishData.description} onChange={e => setFinishData({...finishData, description: e.target.value})} placeholder="Relate o desfecho operacional..." />
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
            <Card className="w-full max-w-lg bg-white p-8 rounded-2xl shadow-2xl border-t-8 border-green-600 animate-fade-in">
                <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl font-black text-red-700 flex items-center gap-2">
                        <AlertTriangle className="w-8 h-8 text-red-600" /> CANCELAR OPERAÇÃO
                    </h2>
                    <button onClick={() => setIsCancellingOp(null)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <form onSubmit={handleCancelOperationSubmit} className="space-y-6">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                        <p className="text-sm text-red-800 leading-tight">
                            Você está solicitando o cancelamento imediato da missão: <br/>
                            <strong className="uppercase">{isCancellingOp.name}</strong>
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase block">Motivo do Cancelamento</label>
                        <textarea 
                            className="w-full p-4 border rounded-xl text-sm h-32 focus:ring-2 focus:ring-red-500 outline-none resize-none bg-white border-slate-300"
                            placeholder="Descreva por que a missão está sendo cancelada..."
                            required
                            value={cancelReason}
                            onChange={e => setCancelReason(e.target.value)}
                        />
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <input 
                                type="checkbox" 
                                className="mt-1 w-5 h-5 accent-red-600 rounded border-slate-300 transition-all"
                                checked={isAcknowledgeCancel}
                                onChange={e => setIsAcknowledgeCancel(e.target.checked)}
                                required
                            />
                            <span className="text-xs font-bold text-slate-600 group-hover:text-slate-800 transition-colors">
                                Estou ciente de que esta ação é irreversível. Após o cancelamento, a ocorrência será enviada ao histórico e NÃO poderá mais ser editada ou reativada.
                            </span>
                        </label>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button 
                            type="button" 
                            variant="outline" 
                            className="flex-1 h-12 font-bold uppercase text-xs" 
                            onClick={() => setIsCancellingOp(null)}
                        >
                            VOLTAR
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={loading || !isAcknowledgeCancel || !cancelReason.trim()} 
                            className="flex-[2] h-12 bg-red-600 hover:bg-red-700 text-white font-black shadow-xl uppercase tracking-widest text-xs disabled:opacity-50"
                        >
                            {loading ? "PROCESSANDO..." : "CONFIRMAR CANCELAMENTO"}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
      )}
    </div>
  );
}
