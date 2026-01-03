
import React, { useState, useEffect, useRef, useMemo, memo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { base44 } from "../services/base44Client";
import { supabase, isConfigured } from "../services/supabase"; 
import { sarpasApi } from "../services/sarpasApi";
import { operationSummerService } from "../services/operationSummerService";
import { Operation, Drone, Pilot, MISSION_HIERARCHY, AroAssessment, MissionType, ConflictNotification, ORGANIZATION_CHART } from "../types";
import { SUMMER_LOCATIONS } from "../types_summer";
import { Button, Input, Select, Badge, Card } from "../components/ui_components";
import { Plus, Map as MapIcon, Clock, Crosshair, User, Plane, Share2, Pencil, X, CloudRain, Wind, CheckSquare, ShieldCheck, AlertTriangle, Radio, Send, Sun, Users, Eye, History, Activity, Pause, Play, Edit3, Database, Copy, ChevronsRight, ChevronsLeft, ChevronsDown, ChevronsUp, Maximize2, Building2, Landmark, MapPin, Phone, Calendar, Hammer, Layers, MessageCircle, Trash2, XCircle, Ban, PlayCircle } from "lucide-react";
import OperationDailyLog from "../components/OperationDailyLog";

import "@geoman-io/leaflet-geoman-free";

const UNIT_GEO: Record<string, [number, number]> = {
  "1º CRBM - Curitiba (Sede Regional)": [-25.417336, -49.278911], 
  "1º BBM - Curitiba (Portão)": [-25.474580, -49.294240], 
  "6º BBM - São José dos Pinhais": [-25.535265, -49.202396],
  "7º BBM - Colombo": [-25.292900, -49.226800],
  "8º BBM - Paranaguá": [-25.5205, -48.5095],
  "BOA - Batalhão de Operações Aéreas": [-25.5161, -49.1702],
  "GOST - Grupo de Operações de Socorro Tático": [-25.42, -49.28],
  "CCB (QCGBM) - Quartel do Comando Geral": [-25.4146, -49.2720],
  "2º CRBM - Londrina (Sede Regional)": [-23.311580, -51.171220],
  "3º BBM - Londrina": [-23.311580, -51.171220], 
  "11º BBM - Apucarana": [-23.5510, -51.4614],
  "1ª CIBM - Ivaiporã": [-24.23174830493947, -51.67066976419622],
  "3ª CIBM - Santo Antônio da Platina": [-23.295225, -50.078847], 
  "3º CRBM - Cascavel (Sede Regional)": [-24.956700, -53.457800], 
  "4º BBM - Cascavel": [-24.956700, -53.457800], 
  "9º BBM - Foz do Iguaçu": [-25.540498, -54.584351],
  "10º BBM - Francisco Beltrão": [-26.0779, -53.0520],
  "13º BBM - Pato Branco": [-26.2282, -52.6705],
  "4º CRBM - Maringá (Sede Regional)": [-23.418900, -51.938700], 
  "5º BBM - Maringá": [-23.418900, -51.938700], 
  "2ª CIBM - Umuarama": [-23.7641, -53.3246],
  "4ª CIBM - Cianorte": [-23.6528, -52.6073],
  "5ª CIBM - Paranavaí": [-23.0792, -52.4607],
  "5º CRBM - Ponta Grossa (Sede Regional)": [-25.091600, -50.160800], 
  "2º BBM - Ponta Grossa": [-25.091600, -50.160800], 
  "12º BBM - Guarapuava": [-25.3935, -51.4566],
  "6ª CIBM - Irati": [-25.4682, -50.6511]
};

const iconCache: Record<string, L.DivIcon> = {};
const getCachedIcon = (type: string, count: number) => {
  const key = `${type}-${count}`;
  if (iconCache[key]) return iconCache[key];

  let iconSvg = '';
  let bgColor = '';
  if (type === 'unit') {
    bgColor = 'bg-slate-800';
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg>`;
  } else if (type === 'pilot') {
    bgColor = 'bg-blue-600';
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  } else {
    bgColor = 'bg-orange-600';
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke-width="0" fill="none"/><path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M12 12v-3.5"/><path d="M12 12h-3.5"/></svg>`;
  }

  const badgeHtml = count > 1 ? `<div class="absolute -top-3 -right-3 bg-red-600 text-white text-[10px] font-bold px-1 py-0.5 rounded-full border-2 border-white shadow-md min-w-[20px] flex items-center justify-center">${count}</div>` : '';
  const html = `<div class="relative flex items-center justify-center w-full h-full shadow-lg rounded-lg border-2 border-white ${bgColor} text-white">${iconSvg}${badgeHtml}</div>`;
  
  const icon = L.divIcon({ html, className: 'bg-transparent', iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -18] });
  iconCache[key] = icon;
  return icon;
};

const defaultIcon = L.icon({ iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png", iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png", shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png", iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });

const isValidCoord = (lat: any, lng: any) => {
  const nLat = Number(lat);
  const nLng = Number(lng);
  return !isNaN(nLat) && !isNaN(nLng) && nLat !== 0 && nLng !== 0;
};

const MapController = ({ isPanelCollapsed }: { isPanelCollapsed: boolean }) => {
  const map = useMap();
  useEffect(() => { 
    if (map) {
      const timer = setTimeout(() => {
        if (map.getContainer()) map.invalidateSize();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [map, isPanelCollapsed]);
  return null;
};

const ResourceLayer = ({ pilots, drones, showUnits, showPilots, showDrones }: any) => {
  return useMemo(() => {
    return Object.entries(UNIT_GEO).map(([unitName, coords]) => {
         const [lat, lng] = coords;
         const unitPilots = pilots.filter((p: any) => p.unit === unitName);
         const unitDrones = drones.filter((d: any) => d.unit === unitName && d.status !== 'in_operation');
         const shouldRender = (showUnits) || (showPilots && unitPilots.length > 0) || (showDrones && unitDrones.length > 0);
         if (!shouldRender) return null;
         return (
           <React.Fragment key={`unit-group-${unitName}`}>
             {showUnits && (
                <Marker position={coords} icon={getCachedIcon('unit', 1)} zIndexOffset={50}>
                  <Popup><div className="min-w-[180px]"><h3 className="font-bold text-slate-800 border-b pb-1 mb-1">{unitName}</h3><p className="text-xs text-slate-500">Base Operacional</p></div></Popup>
                </Marker>
             )}
             {showPilots && unitPilots.length > 0 && (
                <Marker position={[lat + 0.0003, lng]} icon={getCachedIcon('pilot', unitPilots.length)} zIndexOffset={1000}>
                   <Popup><h3 className="font-bold text-blue-800 border-b mb-1">Pilotos</h3><div className="space-y-0.5">{unitPilots.map((p:any) => <div key={p.id} className="text-[10px]">{p.full_name}</div>)}</div></Popup>
                </Marker>
             )}
             {showDrones && unitDrones.length > 0 && (
                <Marker position={[lat - 0.0003, lng]} icon={getCachedIcon('drone', unitDrones.length)} zIndexOffset={900}>
                   <Popup><h3 className="font-bold text-orange-800 border-b mb-1">Frota</h3><div className="space-y-0.5">{unitDrones.map((d:any) => <div key={d.id} className="text-[10px]">{d.prefix} - {d.model}</div>)}</div></Popup>
                </Marker>
             )}
           </React.Fragment>
         );
      });
  }, [pilots, drones, showUnits, showPilots, showDrones]);
};

export default function OperationManagement() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [currentUser, setCurrentUser] = useState<Pilot | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState<Operation | null>(null);
  const [isCancelling, setIsCancelling] = useState<Operation | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showUnits, setShowUnits] = useState(false);
  const [showPilots, setShowPilots] = useState(false);
  const [showDrones, setShowDrones] = useState(false);
  const [editTab, setEditTab] = useState<'details' | 'daily_log'>('details');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  const initialFormState = {
    name: '', pilot_id: '', drone_id: '',
    mission_type: 'sar' as MissionType, latitude: -25.2521, longitude: -52.0215, radius: 500, flight_altitude: 60,
    description: '', status: 'active' as any, occurrence_number: ''
  };
  const [formData, setFormData] = useState(initialFormState);
  const [finishData, setFinishData] = useState({ description: '', flight_hours: '00:00' });

  useEffect(() => { loadData(); const interval = setInterval(loadData, 30000); return () => clearInterval(interval); }, []);

  const loadData = async () => {
    try {
      const [ops, pils, drns, me] = await Promise.all([base44.entities.Operation.list('-created_at'), base44.entities.Pilot.list(), base44.entities.Drone.list(), base44.auth.me()]);
      setOperations(ops); 
      setPilots(pils.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))); 
      setDrones(drns); 
      setCurrentUser(me);
    } catch(e: any) { console.error(e); }
  };

  const handleTogglePause = async (op: Operation) => {
    try {
        const isPaused = !op.is_paused;
        await base44.entities.Operation.update(op.id, { is_paused: isPaused });
        loadData();
    } catch(e) { console.error(e); }
  };

  const handleShareOp = (op: Operation) => {
      const pilot = pilots.find(p => p.id === op.pilot_id);
      const text = `🚨 *SYSARP - OPERAÇÃO ATIVA* 🚨\n\n🚁 *Nome:* ${op.name}\n🔢 *Protocolo:* ${op.occurrence_number}\n👤 *Piloto:* ${pilot?.full_name || 'N/A'}\n📍 *Local:* ${op.latitude}, ${op.longitude}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCancelling || !cancelReason.trim()) return;
    setLoading(true);
    try {
        await base44.entities.Operation.update(isCancelling.id, {
            status: 'cancelled',
            description: `${isCancelling.description || ''}\n\n[MOTIVO CANCELAMENTO]: ${cancelReason}`,
            end_time: new Date().toISOString()
        });
        if (isCancelling.drone_id) await base44.entities.Drone.update(isCancelling.drone_id, { status: 'available' });
        alert("Operação cancelada!");
        setIsCancelling(null); setCancelReason(""); loadData();
    } catch (e) { alert("Erro ao cancelar."); } finally { setLoading(false); }
  };

  const handleFinishOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFinishing) return;
    setLoading(true);
    try {
        // Converte HH:mm para horas decimais com precisão
        const timeParts = finishData.flight_hours.split(':');
        const h = parseInt(timeParts[0] || '0', 10);
        const m = parseInt(timeParts[1] || '0', 10);
        const flightHours = h + (m / 60);

        if (isNaN(flightHours) || flightHours < 0) {
            alert("Duração de voo inválida. Use o formato HH:mm.");
            setLoading(false);
            return;
        }
        
        // 1. Atualiza a operação
        await base44.entities.Operation.update(isFinishing.id, {
            status: 'completed',
            flight_hours: flightHours,
            description: `${isFinishing.description || ''}\n\n[CONCLUSAO]: ${finishData.description}`,
            end_time: new Date().toISOString()
        });

        // 2. BUSCA O ESTADO MAIS ATUAL DO DRONE NO BANCO (Source of Truth)
        if (isFinishing.drone_id) {
            // Recarregamos a lista para pegar o valor exato no banco antes da soma
            const allDrones = await base44.entities.Drone.list();
            const freshDrone = allDrones.find(d => d.id === isFinishing.drone_id);
            
            if (freshDrone) {
                const currentTotal = freshDrone.total_flight_hours || 0;
                const newTotal = currentTotal + flightHours;
                
                await base44.entities.Drone.update(isFinishing.drone_id, { 
                    status: 'available',
                    total_flight_hours: newTotal
                });
                console.log(`[TBO SYNC] Drone ${freshDrone.prefix}: Sincronizado ${currentTotal}h + ${flightHours}h = ${newTotal}h`);
            }
        }

        alert("Operação encerrada e horas de voo sincronizadas no histórico da aeronave!"); 
        setIsFinishing(null); 
        setFinishData({ description: '', flight_hours: '00:00' });
        loadData();
    } catch (e) { 
        alert("Erro ao encerrar."); 
        console.error(e);
    } finally { 
        setLoading(false); 
    }
  };

  const performSave = async () => {
    setLoading(true);
    try {
      if (isEditing) {
          await base44.entities.Operation.update(isEditing, formData);
          alert("Operação atualizada!");
      } else {
          await base44.entities.Operation.create({ ...formData, start_time: new Date().toISOString(), occurrence_number: formData.occurrence_number || `OP-${Date.now()}` } as any);
          if (formData.drone_id) await base44.entities.Drone.update(formData.drone_id, { status: 'in_operation' });
          alert("Operação iniciada!");
      }
      setIsCreating(false); setIsEditing(null); loadData();
    } catch (e) { alert("Erro ao salvar."); } finally { setLoading(false); }
  };

  const displayedOps = activeTab === 'active' ? operations.filter(o => o.status === 'active') : operations.filter(o => o.status !== 'active');

  return (
    <div className="flex flex-col lg:flex-row h-full w-full relative bg-slate-100 overflow-hidden">
      {/* MODAL CANCELAMENTO */}
      {isCancelling && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4">
            <Card className="w-full max-w-lg bg-white p-6 shadow-2xl border-t-4 border-amber-500">
                <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2"><Ban className="w-6 h-6 text-amber-500" /> Cancelar Operação</h2>
                    <button onClick={() => setIsCancelling(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleConfirmCancel} className="space-y-4">
                    <textarea className="w-full p-3 border rounded-lg text-sm h-24 resize-none bg-white" value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Motivo do cancelamento..." required />
                    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setIsCancelling(null)}>Voltar</Button><Button type="submit" disabled={loading} className="bg-amber-500 text-white font-bold">Confirmar</Button></div>
                </form>
            </Card>
        </div>
      )}

      {/* MODAL ENCERRAMENTO */}
      {isFinishing && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4">
            <Card className="w-full max-w-lg bg-white p-6 shadow-2xl border-t-4 border-green-600">
                <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2"><CheckSquare className="w-6 h-6 text-green-600" /> Encerrar Operação</h2>
                    <button onClick={() => setIsFinishing(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleFinishOperation} className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-2">Contabilização de TBO</p>
                        <p className="text-sm text-slate-600">Informe o tempo <strong>efetivo de voo</strong> abaixo no formato Horas:Minutos.</p>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-sm font-medium text-slate-700">Duração Efetiva (HH:mm)</label>
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Ex: 01:45</span>
                        </div>
                        <Input 
                            type="text" 
                            placeholder="00:00"
                            value={finishData.flight_hours} 
                            onChange={e => {
                                const val = e.target.value.replace(/[^0-9:]/g, '');
                                setFinishData({...finishData, flight_hours: val});
                            }} 
                            required 
                        />
                    </div>
                    <textarea className="w-full p-3 border rounded-lg text-sm h-24 resize-none bg-white" value={finishData.description} onChange={e => setFinishData({...finishData, description: e.target.value})} placeholder="Relato final da missão..." />
                    <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setIsFinishing(null)}>Cancelar</Button><Button type="submit" disabled={loading} className="bg-green-600 text-white font-bold px-6">Encerrar e Contabilizar</Button></div>
                </form>
            </Card>
        </div>
      )}

      {/* MAPA */}
      <div className="flex-1 w-full relative z-0 order-1 lg:order-1 border-b lg:border-r border-slate-200 min-h-0">
        <MapContainer center={[-25.2521, -52.0215]} zoom={8} style={{ height: '100%', width: '100%' }}>
          <MapController isPanelCollapsed={isPanelCollapsed} />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ResourceLayer pilots={pilots} drones={drones} showUnits={showUnits} showPilots={showPilots} showDrones={showDrones} />
          {operations.filter(o => o.status === 'active').map(op => {
             const pilot = pilots.find(p => p.id === op.pilot_id);
             const drone = drones.find(d => d.id === op.drone_id);
             
             return isValidCoord(op.latitude, op.longitude) && (
               <Marker key={`op-marker-${op.id}`} position={[Number(op.latitude), Number(op.longitude)]} icon={defaultIcon}>
                  <Popup>
                    <div className="min-w-[280px] p-1 font-sans">
                        <h3 className="font-bold text-slate-900 text-base uppercase leading-tight border-b pb-2 mb-2">{op.name}</h3>
                        <p className="text-[10px] text-slate-400 font-mono mb-2">#{op.occurrence_number}</p>
                        
                        <div className="mb-4">
                           <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-100">
                              {MISSION_HIERARCHY[op.mission_type]?.label}
                           </span>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl space-y-2.5 border border-slate-100">
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
                                    <span className="text-slate-700">{drone?.unit || 'N/A'}</span>
                                 </div>
                                 <span className="text-[10px] text-slate-400 mt-0.5">{drone?.crbm}</span>
                              </div>
                           </div>
                        </div>
                    </div>
                  </Popup>
               </Marker>
             )
          })}
        </MapContainer>
        <div className="absolute top-4 right-4 z-[1000]">
            <button onClick={() => setIsPanelCollapsed(!isPanelCollapsed)} className="bg-white p-2 rounded-md shadow-md border text-slate-600">{isPanelCollapsed ? <ChevronsLeft className="w-6 h-6" /> : <ChevronsRight className="w-6 h-6" />}</button>
        </div>
        <div className="absolute bottom-6 left-4 z-[1000] flex flex-col gap-2">
           <button onClick={() => setShowUnits(!showUnits)} className={`p-2 rounded-lg shadow-md border text-xs font-bold transition-all ${showUnits ? 'bg-slate-800 text-white' : 'bg-white text-slate-500'}`}>Unidades</button>
           <button onClick={() => setShowPilots(!showPilots)} className={`p-2 rounded-lg shadow-md border text-xs font-bold transition-all ${showPilots ? 'bg-blue-600 text-white' : 'bg-white text-slate-500'}`}>Pilotos</button>
           <button onClick={() => setShowDrones(!showDrones)} className={`p-2 rounded-lg shadow-md border text-xs font-bold transition-all ${showDrones ? 'bg-orange-600 text-white' : 'bg-white text-slate-500'}`}>Frota</button>
        </div>
      </div>

      {/* PAINEL LATERAL */}
      <div className={`bg-white z-10 flex flex-col shadow-xl overflow-hidden order-2 transition-all duration-300 ${isPanelCollapsed ? 'lg:w-0' : 'lg:w-[28rem]'} w-full ${isPanelCollapsed ? 'h-0' : 'h-[55vh] lg:h-full'}`}>
        <div className="flex-1 flex flex-col h-full overflow-hidden w-full lg:min-w-[28rem]">
            {isCreating ? (
                <div className="flex-1 flex flex-col h-full overflow-y-auto p-4">
                    <div className="flex justify-between items-center mb-6 border-b pb-4">
                      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Radio className="w-6 h-6 text-red-600" />
                        {isEditing ? 'Editar Operação' : 'Nova Operação'}
                      </h2>
                      <button onClick={() => { setIsCreating(false); setIsEditing(null); }} className="p-1 hover:bg-slate-100 rounded">
                        <X className="w-6 h-6 text-slate-400" />
                      </button>
                    </div>
                    <form onSubmit={e => { e.preventDefault(); performSave(); }} className="space-y-4">
                        <Input label="Nome da Operação" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="Ex: Incêndio em Vegetação - Morretes" />
                        <div className="grid grid-cols-2 gap-4">
                           <Input label="Nº Ocorrência" value={formData.occurrence_number} onChange={e => setFormData({...formData, occurrence_number: e.target.value})} placeholder="Opcional" />
                           <Select label="Natureza" value={formData.mission_type} onChange={e => setFormData({...formData, mission_type: e.target.value as any})} required>
                              {Object.entries(MISSION_HIERARCHY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                           </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <Select label="Aeronave" value={formData.drone_id} onChange={e => setFormData({...formData, drone_id: e.target.value})} required>
                              <option value="">Selecione...</option>
                              {drones.filter(d => d.status === 'available' || d.id === formData.drone_id).map(d => <option key={d.id} value={d.id}>{d.prefix} - {d.model}</option>)}
                          </Select>
                          <Select label="Piloto Comandante" value={formData.pilot_id} onChange={e => setFormData({...formData, pilot_id: e.target.value})} required>
                              <option value="">Selecione...</option>
                              {pilots.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <Input label="Raio (m)" type="number" value={formData.radius} onChange={e => setFormData({...formData, radius: Number(e.target.value)})} />
                           <Input label="Altitude (m)" type="number" value={formData.flight_altitude} onChange={e => setFormData({...formData, flight_altitude: Number(e.target.value)})} />
                        </div>
                        <div className="pt-6 border-t flex gap-3">
                           <Button variant="outline" className="flex-1" type="button" onClick={() => { setIsCreating(false); setIsEditing(null); }}>Cancelar</Button>
                           <Button type="submit" className="flex-1 bg-red-700 text-white font-bold" disabled={loading}>{isEditing ? 'Atualizar' : 'Iniciar Operação'}</Button>
                        </div>
                    </form>
                </div>
            ) : (
                <>
                    {/* SIDEBAR HEADER */}
                    <div className="p-6 border-b bg-white shrink-0 flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-slate-800">Operações</h2>
                        <Button onClick={() => { setFormData(initialFormState); setIsCreating(true); setIsEditing(null); }} className="bg-red-700 hover:bg-red-800 text-white h-10 px-6 font-bold shadow-md">
                          <Plus className="w-5 h-5 mr-2" /> Nova
                        </Button>
                    </div>

                    {/* ABAS ATIVAS / HISTÓRICO */}
                    <div className="px-6 py-4 bg-slate-50 shrink-0">
                       <div className="bg-slate-200 p-1 rounded-lg flex gap-1">
                          <button 
                            onClick={() => setActiveTab('active')}
                            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'active' ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            Ativas
                          </button>
                          <button 
                            onClick={() => setActiveTab('history')}
                            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'history' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            Histórico
                          </button>
                       </div>
                    </div>

                    {/* LISTA DE CARDS */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {displayedOps.map(op => {
                            const pilot = pilots.find(p => p.id === op.pilot_id);
                            const isPaused = op.is_paused;
                            const leftBorderColor = isPaused ? 'border-l-amber-500' : 'border-l-red-600';

                            return (
                                <Card key={`op-list-${op.id}`} className={`bg-white border rounded-xl overflow-hidden shadow-md border-l-4 ${leftBorderColor} hover:shadow-lg transition-all`}>
                                    <div className="p-5">
                                        <div className="flex justify-between items-start mb-3">
                                            <h3 className="font-bold text-slate-800 text-lg leading-tight flex-1 pr-4">{op.name}</h3>
                                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isPaused ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700 animate-pulse'}`}>
                                                {isPaused ? 'PAUSADA' : 'EM ANDAMENTO'}
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 mb-6">
                                            <div className="flex items-center gap-2 text-slate-500 text-sm">
                                                <Clock className="w-4 h-4" />
                                                <span>{new Date(op.start_time).toLocaleString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-500 text-sm">
                                                <User className="w-4 h-4" />
                                                <span>{pilot?.full_name || 'N/A'}</span>
                                            </div>
                                        </div>

                                        {op.status === 'active' && (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <button 
                                                  onClick={() => handleShareOp(op)}
                                                  className="p-2.5 rounded-lg border border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                                  title="Compartilhar"
                                                >
                                                  <Share2 className="w-5 h-5" />
                                                </button>
                                                <button 
                                                  onClick={() => handleTogglePause(op)}
                                                  className={`p-2.5 rounded-lg border transition-colors ${isPaused ? 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100' : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'}`}
                                                  title={isPaused ? "Continuar" : "Pausar"}
                                                >
                                                  {isPaused ? <PlayCircle className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                                                </button>
                                                <button 
                                                  onClick={() => { setFormData({...op, occurrence_number: op.occurrence_number || ''}); setIsEditing(op.id); setIsCreating(true); }}
                                                  className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                                  title="Editar Detalhes"
                                                >
                                                  <Pencil className="w-5 h-5" />
                                                </button>
                                                
                                                <div className="flex-1 flex gap-2">
                                                  <Button 
                                                    onClick={() => setIsCancelling(op)}
                                                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold h-11 border-none"
                                                  >
                                                    <XCircle className="w-4 h-4 mr-1.5" />
                                                    Cancelar
                                                  </Button>
                                                  <Button 
                                                    onClick={() => setIsFinishing(op)}
                                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold h-11 border-none"
                                                  >
                                                    <CheckSquare className="w-4 h-4 mr-1.5" />
                                                    Encerrar
                                                  </Button>
                                                </div>
                                            </div>
                                        )}
                                        {op.status !== 'active' && (
                                            <Badge variant={op.status === 'completed' ? 'success' : 'danger'}>{op.status.toUpperCase()}</Badge>
                                        )}
                                    </div>
                                </Card>
                            );
                        })}
                        {displayedOps.length === 0 && (
                            <div className="text-center py-20 text-slate-400 italic">
                               Nenhuma operação {activeTab === 'active' ? 'ativa' : 'no histórico'}.
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
      </div>
    </div>
  );
}
