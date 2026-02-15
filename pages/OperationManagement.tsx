
import React, { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import { base44 } from "../services/base44Client";
import { Operation, Drone, Pilot, MISSION_HIERARCHY, MISSION_COLORS, MISSION_LABELS, ORGANIZATION_CHART, MissionType } from "../types";
import { Button, Input, Select, Badge, Card } from "../components/ui_components";
import { 
  Plus, Clock, User, X, Radio, Plane, 
  Shield, MapPin, LocateFixed, Users, 
  Share2, Play, Pause, Pencil, CheckCircle, 
  Crosshair, Loader2, Save, FileText, Navigation, LayoutList, Map as MapIcon,
  Sun, Calendar, Zap, Flag, Hexagon, Route,
  Video
} from "lucide-react";
import { useNavigate } from "react-router-dom"; 

const LocationSelectorMap = ({ mode, center, radius, onPositionChange }: any) => {
    const map = useMap();
    useEffect(() => { setTimeout(() => map.invalidateSize(), 400) }, [map]);

    useMapEvents({
        click(e) { onPositionChange(e.latlng.lat, e.latlng.lng); }
    });

    useEffect(() => {
        map.flyTo(center, map.getZoom());
    }, [center, map]);

    return (
        <>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Circle center={center} radius={radius} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15, dashArray: '5, 10', weight: 2 }} />
            <Marker position={center} icon={L.divIcon({ className: '', html: '<div style="background-color: #ef4444; width: 16px; height: 16px; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>', iconSize: [16, 16], iconAnchor: [8, 8] })}>
               <Popup>Ponto Zero (PC)</Popup>
            </Marker>
        </>
    );
};

export default function OperationManagement() {
  const navigate = useNavigate();
  const [operations, setOperations] = useState<Operation[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [mobileView, setMobileView] = useState<'map' | 'list'>('list'); 
  const [loading, setLoading] = useState(false);
  const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
  const [mapLayers, setMapLayers] = useState({ gps: false, ops: true });
  const [controlModal, setControlModal] = useState<{type: 'pause' | 'cancel' | 'end' | null, op: Operation | null}>({type: null, op: null});
  const [flightDurationStr, setFlightDurationStr] = useState("00:00");
  const [actionsTaken, setActionsTaken] = useState('');

  const [formData, setFormData] = useState({ 
    id: '', name: '', occurrence_number: '', mission_type: 'diverse' as any, sub_mission_type: '', pilot_id: '', observer_name: '', drone_id: '', 
    latitude: -25.42, longitude: -49.27, radius: 200, flight_altitude: 60, description: '', stream_url: '', sarpas_protocol: '',
    is_summer_op: false, is_multi_day: false, op_crbm: '', op_unit: '',
    start_date: new Date().toISOString().split('T')[0],
    start_time: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
    estimated_end_time: '', takeoff_points: [] as any[], shapes: null as any
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [ops, pils, drns] = await Promise.all([
        base44.entities.Operation.list('-created_at'), 
        base44.entities.Pilot.list(), 
        base44.entities.Drone.list()
      ]);
      setOperations(ops); setPilots(pils); setDrones(drns);
    } catch(e) {}
  };

  const handleShare = (op: Operation) => {
    const pilot = pilots.find(p => p.id === op.pilot_id);
    const drone = drones.find(d => d.id === op.drone_id);
    const nature = MISSION_HIERARCHY[op.mission_type as MissionType]?.label || op.mission_type;
    const startTime = new Date(op.start_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    const gmapsLink = `https://www.google.com/maps?q=${op.latitude},${op.longitude}`;

    const text = `🚨 *SYSARP - SITUAÇÃO OPERACIONAL* 🚨

🚁 *Ocorrência:* ${op.name}
🔢 *Protocolo:* ${op.occurrence_number}
📋 *Natureza:* ${nature}

👤 *PIC:* ${pilot?.full_name || 'N/A'}
📞 *Contato:* ${pilot?.phone || 'N/A'}
🛡️ *Aeronave:* ${drone?.prefix || 'N/A'} (${drone?.model || 'N/A'})

📍 *Coord:* ${op.latitude.toFixed(6)}, ${op.longitude.toFixed(6)}
🗺️ *Google Maps:* ${gmapsLink}

📏 *Raio:* ${op.radius}m
✈️ *Altitude:* ${op.flight_altitude}m

🕒 *Início:* ${startTime}
🏁 *Término Previsto:* ${op.estimated_end_time || '-'}`;

    if (navigator.share) {
      navigator.share({ title: 'Situação Operacional', text }).catch(() => {
        navigator.clipboard.writeText(text);
        alert("Informações copiadas para a área de transferência!");
      });
    } else {
      navigator.clipboard.writeText(text);
      alert("Informações copiadas para a área de transferência!");
    }
  };

  const handleOpenNewMission = () => {
      setFormData({ 
        id: '', name: '', occurrence_number: '', mission_type: 'diverse', sub_mission_type: '', pilot_id: '', observer_name: '', drone_id: '', 
        latitude: -25.42, longitude: -49.27, radius: 200, flight_altitude: 60, description: '', stream_url: '', sarpas_protocol: '', 
        is_summer_op: false, is_multi_day: false, op_crbm: '', op_unit: '', 
        start_date: new Date().toISOString().split('T')[0], 
        start_time: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}), 
        estimated_end_time: '', takeoff_points: [], shapes: null 
      });
      setIsMissionModalOpen(true);
  };

  const handleSaveMission = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
          const localDate = new Date(`${formData.start_date}T${formData.start_time}:00`);
          const payload = { ...formData, start_time: localDate.toISOString() };
          if (formData.id) {
              await base44.entities.Operation.update(formData.id, payload);
          } else {
              await base44.entities.Operation.create({ ...payload, status: 'active' } as any);
              if (formData.drone_id) await base44.entities.Drone.update(formData.drone_id, { status: 'in_operation' });
          }
          setIsMissionModalOpen(false);
          loadData();
      } catch(e) { alert("Erro ao salvar missão."); } finally { setLoading(false); }
  };

  const handleResume = async (op: Operation) => {
      setLoading(true);
      try { await base44.entities.Operation.update(op.id, { is_paused: false }); loadData(); } catch(e) {} finally { setLoading(false); }
  };

  const handleAction = async (e: React.FormEvent) => {
      e.preventDefault();
      const op = controlModal.op;
      if (!op) return;
      setLoading(true);
      try {
          if (controlModal.type === 'pause') {
              const currentLogs = op.pause_logs || [];
              await base44.entities.Operation.update(op.id, { 
                  is_paused: true,
                  last_pause_start: new Date().toISOString(),
                  pause_logs: [...currentLogs, { start: new Date().toISOString(), reason: actionsTaken }]
              });
          }
          else if (controlModal.type === 'cancel') {
              await base44.entities.Operation.update(op.id, { status: 'cancelled' });
              if (op.drone_id) await base44.entities.Drone.update(op.drone_id, { status: 'available' });
          }
          else if (controlModal.type === 'end') {
              let decimalHours = 0;
              const parts = flightDurationStr.split(':');
              if (parts.length === 2) decimalHours = Number(parts[0]) + (Number(parts[1]) / 60);
              await base44.entities.Operation.update(op.id, { status: 'completed', flight_hours: decimalHours, actions_taken: actionsTaken, end_time: new Date().toISOString() });
              if (op.drone_id) await base44.entities.Drone.update(op.drone_id, { status: 'available' });
          }
          setControlModal({type: null, op: null}); 
          setActionsTaken('');
          loadData();
      } catch(e) {} finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-slate-100 overflow-hidden relative">
      
      {/* Botões Rápidos Mobile */}
      <div className="lg:hidden flex bg-white border-b border-slate-200 shrink-0">
          <button onClick={() => setMobileView('list')} className={`flex-1 py-4 flex items-center justify-center gap-2 text-xs font-black uppercase transition-all ${mobileView === 'list' ? 'text-red-700 border-b-2 border-red-700 bg-slate-50' : 'text-slate-400'}`}><LayoutList className="w-4 h-4" /> Missões</button>
          <button onClick={() => setMobileView('map')} className={`flex-1 py-4 flex items-center justify-center gap-2 text-xs font-black uppercase transition-all ${mobileView === 'map' ? 'text-red-700 border-b-2 border-red-700 bg-slate-50' : 'text-slate-400'}`}><MapIcon className="w-4 h-4" /> Mapa</button>
      </div>

      <div className={`flex-1 relative z-0 ${mobileView === 'list' ? 'hidden lg:block' : 'block h-full'}`}>
          <MapContainer center={[-24.8, -51.5]} zoom={7} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {operations.filter(o => o.status === 'active').map(op => (
                  <Marker key={op.id} position={[op.latitude, op.longitude]} icon={L.divIcon({ className: 'op-marker', html: `<div style="background-color: ${MISSION_COLORS[op.mission_type]}; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.4);"></div>`, iconSize: [14, 14] })}>
                    <Popup>
                        <div className="p-1 min-w-[200px]">
                            <h4 className="font-black text-xs uppercase leading-tight">{op.name}</h4>
                            <p className="text-[10px] text-slate-500 font-mono mt-1">#{op.occurrence_number}</p>
                            <Button size="sm" className="w-full mt-3 h-8 text-[9px] font-black uppercase" onClick={() => navigate(`/operations/${op.id}/gerenciar`)}>CENTRO TÁTICO</Button>
                        </div>
                    </Popup>
                  </Marker>
              ))}
          </MapContainer>
          <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
              <button onClick={() => setMapLayers(p => ({...p, gps: !p.gps}))} className={`w-12 h-12 rounded-2xl bg-white shadow-2xl flex items-center justify-center border border-slate-200 transition-all ${mapLayers.gps ? 'text-blue-600' : 'text-slate-400'}`}><LocateFixed className="w-6 h-6"/></button>
          </div>
      </div>

      <div className={`${mobileView === 'map' ? 'hidden lg:flex' : 'flex'} w-full lg:w-[450px] bg-white flex flex-col shadow-2xl z-10 border-l border-slate-200 overflow-hidden`}>
          <div className="p-6 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
            <div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight leading-none">Missões RPA</h2>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Corpo de Bombeiros Militar</p>
            </div>
            <Button onClick={handleOpenNewMission} className="bg-red-700 hover:bg-red-800 text-white h-11 px-5 font-black text-[11px] uppercase shadow-lg transition-transform active:scale-95"><Plus className="w-4 h-4 mr-2" /> Nova Missão</Button>
          </div>
          
          <div className="flex p-2 bg-slate-100 mx-6 mt-6 rounded-2xl shrink-0 border border-slate-200">
            <button onClick={() => setActiveTab('active')} className={`flex-1 py-3 text-[11px] font-black uppercase rounded-xl transition-all ${activeTab === 'active' ? 'bg-white text-red-700 shadow-md' : 'text-slate-500'}`}>Ativas</button>
            <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 text-[11px] font-black uppercase rounded-xl transition-all ${activeTab === 'history' ? 'bg-white text-red-700 shadow-md' : 'text-slate-500'}`}>Histórico</button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white pb-24 lg:pb-6">
              {activeTab === 'active' ? (
                  operations.filter(o => o.status === 'active').map(op => {
                    const pilot = pilots.find(p => p.id === op.pilot_id);
                    const isPaused = op.is_paused === true;
                    return (
                      <Card key={op.id} className="bg-white border-l-[6px] border-l-red-600 shadow-xl p-6 flex flex-col gap-4 relative transition-all group hover:border-l-red-700">
                          <div className="flex justify-between items-start">
                            <div className="min-w-0 flex-1">
                                <h4 className="font-black text-slate-900 text-lg uppercase leading-none truncate group-hover:text-red-700 transition-colors">{op.name}</h4>
                                <p className="text-[10px] font-mono text-slate-400 mt-2 uppercase font-black tracking-tighter">#{op.occurrence_number}</p>
                            </div>
                            {isPaused && <Badge className="bg-amber-100 text-amber-700 text-[9px] font-black uppercase ring-1 ring-amber-200">PAUSADA</Badge>}
                          </div>
                          <div className="space-y-2 text-[11px] font-black text-slate-500 uppercase tracking-tighter bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3"><Clock className="w-4 h-4 text-red-400" /><span>{new Date(op.start_time).toLocaleString()}</span></div>
                            <div className="flex items-center gap-3"><User className="w-4 h-4 text-blue-400" /><span className="truncate">PIC: {pilot?.full_name}</span></div>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                             <button onClick={(e) => { e.stopPropagation(); isPaused ? handleResume(op) : setControlModal({type: 'pause', op}); }} className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${isPaused ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100' : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'}`}>
                                {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                                <span className="text-[8px] font-black mt-1 uppercase">{isPaused ? 'Retomar' : 'Pausar'}</span>
                             </button>
                             <button onClick={() => { setFormData({...op} as any); setIsMissionModalOpen(true); }} className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"><Pencil className="w-5 h-5"/><span className="text-[8px] font-black mt-1 uppercase">Editar</span></button>
                             <button onClick={() => handleShare(op)} className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-200 bg-slate-50 text-blue-600 hover:bg-blue-100">
                                <Share2 className="w-5 h-5"/>
                                <span className="text-[8px] font-black mt-1 uppercase">Partilhar</span>
                             </button>
                             <button onClick={() => navigate(`/operations/${op.id}/gerenciar`)} className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900 text-white font-black uppercase text-[10px] shadow-lg active:scale-95 transition-transform"><Crosshair className="w-5 h-5 text-red-500 animate-pulse"/> TÁTICO</button>
                          </div>
                          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                             <button onClick={() => setControlModal({type: 'cancel', op})} className="h-11 rounded-xl border border-slate-200 text-slate-500 font-black text-[11px] uppercase hover:bg-red-50 hover:text-red-600 transition-all">X Cancelar</button>
                             <button onClick={() => setControlModal({type: 'end', op})} className="h-11 rounded-xl bg-red-600 text-white font-black text-[11px] uppercase shadow-lg shadow-red-100 hover:bg-red-700 transition-all">✓ Encerrar</button>
                          </div>
                      </Card>
                    );
                  })
              ) : (
                  operations.filter(o => o.status !== 'active').map(op => (
                    <Card key={op.id} className="p-4 bg-white border border-slate-200 rounded-2xl flex justify-between items-center shadow-sm opacity-80 transition-opacity">
                        <div className="min-w-0 flex-1">
                            <p className="font-black text-slate-700 text-xs truncate uppercase leading-none">{op.name}</p>
                            <p className="text-[9px] text-slate-400 font-mono mt-1.5 uppercase font-black">#{op.occurrence_number} • {new Date(op.start_time).toLocaleDateString()}</p>
                        </div>
                        <Badge variant={op.status === 'completed' ? 'success' : 'danger'} className="text-[9px] font-black uppercase">{op.status === 'completed' ? 'CONCLUÍDO' : 'CANCELADO'}</Badge>
                    </Card>
                  ))
              )}
          </div>
      </div>

      {/* MODAL DE CONTROLE DE OPERAÇÃO (PAUSA/CANCELAR/ENCERRAR) */}
      {controlModal.type && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[3000] flex items-center justify-center p-4 animate-fade-in">
              <Card className="w-full max-w-md bg-white shadow-2xl rounded-3xl overflow-hidden border-t-8 border-red-600">
                  <div className="p-8">
                      <div className="flex items-center gap-4 mb-6">
                          <div className="p-4 bg-red-50 rounded-2xl text-red-600">
                              {controlModal.type === 'pause' ? <Pause className="w-7 h-7" /> : 
                               controlModal.type === 'cancel' ? <X className="w-7 h-7" /> : <CheckCircle className="w-7 h-7" />}
                          </div>
                          <div>
                              <h3 className="text-xl font-black uppercase tracking-tight text-slate-800">
                                  {controlModal.type === 'pause' ? 'Pausar Operação' : 
                                   controlModal.type === 'cancel' ? 'Cancelar Missão' : 'Encerrar Missão'}
                              </h3>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Confirmação de Ação Tática</p>
                          </div>
                      </div>

                      <form onSubmit={handleAction} className="space-y-5">
                          {controlModal.type === 'pause' && (
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Motivo da Interrupção</label>
                                  <textarea 
                                      required 
                                      className="w-full p-4 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-red-600 outline-none h-32 resize-none bg-slate-50"
                                      placeholder="Descreva o motivo (ex: Troca de bateria, mau tempo, solicitação do solicitante...)"
                                      value={actionsTaken}
                                      onChange={e => setActionsTaken(e.target.value)}
                                  />
                              </div>
                          )}
                          
                          {controlModal.type === 'end' && (
                              <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-3">
                                      <Input label="Horas de Voo" value={flightDurationStr} onChange={e => setFlightDurationStr(e.target.value)} placeholder="00:00" />
                                      <div className="space-y-1">
                                          <label className="text-xs font-bold text-slate-500">Status</label>
                                          <div className="h-10 flex items-center px-4 bg-green-50 text-green-700 font-bold rounded-lg border border-green-200 text-xs">CONCLUÍDO</div>
                                      </div>
                                  </div>
                                  <div className="space-y-2">
                                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ações Tomadas / Relato Final</label>
                                      <textarea 
                                          required 
                                          className="w-full p-4 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-red-600 outline-none h-32 resize-none bg-slate-50"
                                          placeholder="Resuma as atividades executadas..."
                                          value={actionsTaken}
                                          onChange={e => setActionsTaken(e.target.value)}
                                      />
                                  </div>
                              </div>
                          )}

                          {controlModal.type === 'cancel' && (
                              <div className="p-5 bg-red-50 rounded-2xl border border-red-100 mb-2">
                                  <p className="text-sm text-red-800 font-bold leading-relaxed">
                                      Atenção: Ao cancelar, a missão será movida para o histórico com status "Cancelado" e o vetor será liberado imediatamente.
                                  </p>
                              </div>
                          )}

                          <div className="flex gap-3 pt-2">
                              <Button type="button" variant="outline" className="flex-1 font-black uppercase text-[10px] h-14 rounded-2xl" onClick={() => setControlModal({type: null, op: null})}>VOLTAR</Button>
                              <Button type="submit" disabled={loading} className="flex-[2] bg-red-700 hover:bg-red-800 text-white font-black uppercase text-[10px] h-14 rounded-2xl shadow-xl shadow-red-100">
                                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'CONFIRMAR AÇÃO'}
                              </Button>
                          </div>
                      </form>
                  </div>
              </Card>
          </div>
      )}

      {/* FORMULÁRIO SEQUENCIAL 1 A 10 CONFORME SOLICITADO */}
      {isMissionModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-0 lg:p-4 animate-fade-in">
              <Card className="w-full lg:max-w-4xl h-full lg:h-[95vh] bg-white shadow-2xl rounded-none lg:rounded-3xl flex flex-col overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center shrink-0 bg-slate-900 text-white">
                      <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3"><Radio className="w-7 h-7 text-red-500 animate-pulse" /> LANÇAR OPERAÇÃO RPA</h3>
                      <button onClick={() => setIsMissionModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-7 h-7"/></button>
                  </div>
                  
                  <form onSubmit={handleSaveMission} className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6 bg-slate-50 custom-scrollbar">
                      
                      {/* 1. Lotação Operacional */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Shield className="w-4 h-4"/> 1. LOTAÇÃO OPERACIONAL</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <Select label="CRBM" value={formData.op_crbm} onChange={e => setFormData({...formData, op_crbm: e.target.value, op_unit: ''})} required>
                                  <option value="">Selecione...</option>
                                  {Object.keys(ORGANIZATION_CHART).map(c => <option key={c} value={c}>{c}</option>)}
                              </Select>
                              <Select label="Unidade" value={formData.op_unit} onChange={e => setFormData({...formData, op_unit: e.target.value})} required disabled={!formData.op_crbm}>
                                  <option value="">Selecione...</option>
                                  {formData.op_crbm && ORGANIZATION_CHART[formData.op_crbm as keyof typeof ORGANIZATION_CHART]?.map((u: string) => <option key={u} value={u}>{u}</option>)}
                              </Select>
                          </div>
                      </div>

                      {/* 2. Dados da Missão */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Zap className="w-4 h-4"/> 2. DADOS DA MISSÃO</h4>
                          <Input label="Título da Ocorrência" placeholder="Ex: Incêndio Urbano..." value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <Select label="Natureza" value={formData.mission_type} onChange={e => setFormData({...formData, mission_type: e.target.value as any})} required>
                                  <option value="">Selecione...</option>
                                  {Object.entries(MISSION_HIERARCHY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                              </Select>
                              <Select label="Subnatureza" value={formData.sub_mission_type} onChange={e => setFormData({...formData, sub_mission_type: e.target.value})}>
                                  <option value="">Selecione...</option>
                                  {MISSION_HIERARCHY[formData.mission_type as keyof typeof MISSION_HIERARCHY]?.subtypes.map((s: string) => <option key={s} value={s}>{s}</option>)}
                              </Select>
                          </div>
                      </div>

                      {/* 3. Equipe e Aeronave */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users className="w-4 h-4"/> 3. EQUIPE E AERONAVE</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <Select label="Piloto (PIC)" required value={formData.pilot_id} onChange={e => setFormData({...formData, pilot_id: e.target.value})}>
                                  <option value="">Selecione...</option>
                                  {pilots.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                              </Select>
                              <Select label="Aeronave (RPA)" required value={formData.drone_id} onChange={e => setFormData({...formData, drone_id: e.target.value})}>
                                  <option value="">Selecione...</option>
                                  {drones.map(d => <option key={d.id} value={d.id}>{d.prefix} - {d.model}</option>)}
                              </Select>
                          </div>
                          <Input label="Observador / Auxiliar" placeholder="Nome do militar de apoio" value={formData.observer_name} onChange={e => setFormData({...formData, observer_name: e.target.value})} />
                      </div>

                      {/* 4. Localização e Mapa Tático */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><MapPin className="w-4 h-4"/> 4. LOCALIZAÇÃO E MAPA TÁTICO</h4>
                          <div className="grid grid-cols-2 gap-4">
                              <Input label="Latitude PC" value={formData.latitude} type="number" step="any" onChange={e => setFormData({...formData, latitude: Number(e.target.value)})} />
                              <Input label="Longitude PC" value={formData.longitude} type="number" step="any" onChange={e => setFormData({...formData, longitude: Number(e.target.value)})} />
                              <Input label="Raio de Voo (m)" value={formData.radius} type="number" onChange={e => setFormData({...formData, radius: Number(e.target.value)})} />
                              <Input label="Altitude Máx (m)" value={formData.flight_altitude} type="number" onChange={e => setFormData({...formData, flight_altitude: Number(e.target.value)})} />
                          </div>
                          <div className="h-64 rounded-xl overflow-hidden border border-slate-200 relative">
                              <div className="absolute top-2 left-2 right-2 z-[1000] flex justify-center gap-1">
                                  <button type="button" className="bg-red-600 text-white px-3 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1"><Navigation className="w-3 h-3"/> PC</button>
                                  <button type="button" className="bg-white border text-slate-600 px-3 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1"><Hexagon className="w-3 h-3"/> ÁREA</button>
                                  <button type="button" className="bg-white border text-slate-600 px-3 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1"><Route className="w-3 h-3"/> ROTA</button>
                                  <button type="button" className="bg-white border text-slate-600 px-3 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1"><Flag className="w-3 h-3"/> PONTO</button>
                              </div>
                              <MapContainer center={[formData.latitude, formData.longitude]} zoom={14} style={{ height: '100%', width: '100%' }}>
                                  <LocationSelectorMap center={[formData.latitude, formData.longitude]} radius={formData.radius} onPositionChange={(lat: number, lng: number) => setFormData({...formData, latitude: lat, longitude: lng})}/>
                              </MapContainer>
                          </div>
                      </div>

                      {/* 5. Cronograma Operacional */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Clock className="w-4 h-4"/> 5. CRONOGRAMA OPERACIONAL</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <Input label="Data" type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                              <Input label="Início" type="time" value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})} />
                              <Input label="Término Previsto" type="time" value={formData.estimated_end_time} onChange={e => setFormData({...formData, estimated_end_time: e.target.value})} />
                          </div>
                      </div>

                      {/* 6. Descrição / Notas */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileText className="w-4 h-4"/> 6. DESCRIÇÃO / NOTAS OPERACIONAIS</h4>
                          <textarea className="w-full p-4 border border-slate-200 rounded-xl text-sm min-h-[100px] outline-none focus:ring-2 focus:ring-red-600 resize-none bg-slate-50" placeholder="Relate detalhes, obstáculos or observações importantes da missão..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                      </div>

                      {/* 7. Link de Transmissão */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Video className="w-4 h-4"/> 7. LINK DE TRANSMISSÃO</h4>
                          <Input placeholder="Link YouTube/RTSP..." value={formData.stream_url} onChange={e => setFormData({...formData, stream_url: e.target.value})} />
                      </div>

                      {/* 8. Integração SARPAS */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Zap className="w-4 h-4"/> 8. INTEGRAÇÃO SARPAS NG (MANUAL)</h4>
                          <Input label="Protocolo SARPAS" placeholder="Ex: XXXXXX" value={formData.sarpas_protocol} onChange={e => setFormData({...formData, sarpas_protocol: e.target.value})} />
                      </div>

                      {/* 9. Operação Verão */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Sun className="w-4 h-4"/> 9. OPERAÇÃO VERÃO</h4>
                          <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-orange-50 transition-colors">
                              <input type="checkbox" className="w-5 h-5 rounded accent-orange-500" checked={formData.is_summer_op} onChange={e => setFormData({...formData, is_summer_op: e.target.checked})} />
                              <span className="text-sm font-bold text-slate-700 flex items-center gap-2"><Sun className="w-4 h-4 text-orange-500"/> VINCULAR À OPERAÇÃO VERÃO</span>
                          </label>
                      </div>

                      {/* 10. Diário de Bordo */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Calendar className="w-4 h-4"/> 10. DIÁRIO DE BORDO</h4>
                          <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors">
                              <input type="checkbox" className="w-5 h-5 rounded accent-blue-600" checked={formData.is_multi_day} onChange={e => setFormData({...formData, is_multi_day: e.target.checked})} />
                              <span className="text-sm font-bold text-slate-700 flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-600"/> ATIVAR MODO MULTIDIAS</span>
                          </label>
                      </div>

                  </form>
                  <div className="p-6 lg:p-8 border-t bg-white flex flex-col md:flex-row gap-4 shrink-0">
                      <Button variant="outline" onClick={() => setIsMissionModalOpen(false)} className="h-14 font-black uppercase text-xs rounded-xl flex-1">CANCELAR</Button>
                      <Button onClick={handleSaveMission} disabled={loading} className="flex-[2] h-14 bg-red-700 text-white font-black uppercase text-xs shadow-2xl rounded-xl flex items-center justify-center gap-3">
                          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                          INICIAR MISSÃO RPA
                      </Button>
                  </div>
              </Card>
          </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .leaflet-container { border-radius: inherit; }
      `}</style>
    </div>
  );
}
