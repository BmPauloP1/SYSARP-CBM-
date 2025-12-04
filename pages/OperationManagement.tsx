import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { base44 } from "../services/base44Client";
import { sarpasApi } from "../services/sarpasApi";
import { operationSummerService } from "../services/operationSummerService";
import { Operation, Drone, Pilot, MISSION_HIERARCHY, ARO_SCENARIOS, AroItem, AroAssessment, MissionType, ConflictNotification } from "../types";
import { SUMMER_LOCATIONS } from "../types_summer";
import { Button, Input, Select, Badge, Card } from "../components/ui_components";
import { Plus, Video, Map as MapIcon, Clock, ArrowLeft, Save, Crosshair, User, Plane, Share2, Pencil, X, CloudRain, Wind, CheckSquare, ShieldCheck, AlertTriangle, Radio, Send, Sun, FileText, Timer, Anchor, Users, Eye, History, Activity, Pause, Play } from "lucide-react";

// Fix Leaflet icons
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const tempIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to handle map clicks
const LocationSelector = ({ onLocationSelect, isSelecting }: { onLocationSelect: (lat: number, lng: number) => void, isSelecting: boolean }) => {
  useMapEvents({
    click(e) {
      if (isSelecting) {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

// Safe Map Controller
const MapController = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      if (map && map.getContainer()) map.invalidateSize();
    }, 500);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

// Weather Widget Component
const WeatherWidget = ({ lat, lng }: { lat: number, lng: number }) => {
  const windSpeed = Math.floor(Math.random() * 25) + 5; // 5-30 km/h
  const kpIndex = Math.floor(Math.random() * 4); // 0-4
  const rainProb = Math.floor(Math.random() * 30); // 0-30%

  return (
    <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 w-full animate-fade-in mt-2 shadow-md">
      <div className="flex items-center gap-2 mb-3 border-b border-slate-700 pb-2">
        <CloudRain className="w-4 h-4 text-blue-400" />
        <span className="text-xs font-bold uppercase tracking-wider">Meteorologia Local (Estimada)</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center bg-slate-800/50 p-2 rounded">
            <Wind className="w-4 h-4 text-slate-400 mb-1" />
            <span className="text-[10px] text-slate-400">Vento</span>
            <span className={`text-xs font-bold ${windSpeed > 20 ? 'text-red-400' : 'text-green-400'}`}>{windSpeed} km/h</span>
        </div>
        <div className="flex flex-col items-center bg-slate-800/50 p-2 rounded">
            <AlertTriangle className="w-4 h-4 text-slate-400 mb-1" />
            <span className="text-[10px] text-slate-400">Índice KP</span>
            <span className={`text-xs font-bold ${kpIndex > 3 ? 'text-red-400' : 'text-green-400'}`}>{kpIndex}</span>
        </div>
        <div className="flex flex-col items-center bg-slate-800/50 p-2 rounded">
            <CloudRain className="w-4 h-4 text-slate-400 mb-1" />
            <span className="text-[10px] text-slate-400">Chuva</span>
            <span className="text-xs font-bold text-blue-300">{rainProb}%</span>
        </div>
      </div>
      <div className="mt-2 text-[9px] text-slate-500 text-center border-t border-slate-800 pt-1">
        Coords: {lat.toFixed(4)}, {lng.toFixed(4)}
      </div>
    </div>
  );
};

// Haversine Distance Calculation (in meters)
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const AroModal = ({ onConfirm, onCancel }: any) => {
    return (
        <div className="fixed inset-0 bg-black/80 z-[2000] flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <h2 className="font-bold text-xl mb-4">Avaliação de Risco Operacional</h2>
                <p className="mb-4 text-slate-600">Confirme que a avaliação de risco foi realizada para esta operação.</p>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onCancel}>Cancelar</Button>
                    <Button onClick={() => onConfirm({items: [], declaration_accepted: true, rubric: "SYSTEM", created_at: new Date().toISOString()})}>
                        Confirmar A.R.O. e Prosseguir
                    </Button>
                </div>
            </div>
        </div>
    )
};

const ChecklistModal = ({ onConfirm, onCancel }: any) => (
    <div className="fixed inset-0 bg-black/70 z-[2000] flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h2 className="font-bold text-xl mb-4">Checklist de Decolagem</h2>
            <p className="mb-4">Verifique itens físicos e de segurança antes de prosseguir.</p>
            <Button onClick={onConfirm} className="w-full bg-green-600 hover:bg-green-700 text-white">Confirmar Decolagem</Button>
            <Button variant="outline" onClick={onCancel} className="w-full mt-2">Cancelar</Button>
        </div>
    </div>
);

// Modal para informar motivo da pausa
const PauseReasonModal = ({ onConfirm, onCancel }: { onConfirm: (reason: string) => void, onCancel: () => void }) => {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 bg-black/80 z-[2000] flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-lg max-w-md w-full animate-fade-in">
            <h2 className="font-bold text-lg mb-2 flex items-center gap-2">
               <Pause className="w-5 h-5 text-amber-600" />
               Pausar Operação
            </h2>
            <p className="text-sm text-slate-500 mb-4">O tempo de voo será congelado. Informe o motivo da pausa.</p>
            
            <Input 
               label="Motivo" 
               placeholder="Ex: Troca de Bateria, Troca de Hélice, Chuva..."
               value={reason}
               onChange={e => setReason(e.target.value)}
               autoFocus
            />
            
            <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={onCancel}>Cancelar</Button>
                <Button 
                  disabled={!reason.trim()} 
                  onClick={() => onConfirm(reason)}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                    Confirmar Pausa
                </Button>
            </div>
        </div>
    </div>
  );
};


const ConflictModal = ({ conflicts, onAck, onCancel }: any) => (
     <div className="fixed inset-0 bg-red-900/80 z-[2001] flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-lg max-w-md w-full border-4 border-red-500">
            <h2 className="font-bold text-xl text-red-700 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6"/> ALERTA DE CONFLITO
            </h2>
            <p className="mb-4 text-slate-700 font-medium">Conflito de espaço aéreo detectado com {conflicts.length} operação(ões) ativa(s).</p>
            
            <div className="bg-red-50 p-3 rounded mb-4 text-sm">
                <p className="font-bold text-red-800">Aeronave(s) próxima(s):</p>
                <ul className="list-disc list-inside text-red-700">
                    {conflicts.map((c: Operation) => <li key={c.id}>{c.name} ({c.radius}m)</li>)}
                </ul>
            </div>

            <Button onClick={onAck} className="w-full bg-red-600 text-white hover:bg-red-700">Estou Ciente (Manter Coordenação)</Button>
            <Button variant="outline" onClick={onCancel} className="w-full mt-2">Abortar Criação</Button>
        </div>
    </div>
);

export default function OperationManagement() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState<Operation | null>(null);
  
  const [showChecklist, setShowChecklist] = useState(false); 
  const [showAroModal, setShowAroModal] = useState(false); 
  const [conflictData, setConflictData] = useState<Operation[] | null>(null); 
  const [loading, setLoading] = useState(false);
  
  const [aroData, setAroData] = useState<AroAssessment | null>(null); 
  const [tempMarker, setTempMarker] = useState<{lat: number, lng: number} | null>(null);
  const [sendToSarpas, setSendToSarpas] = useState(false); 
  
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  
  // Pause State
  const [pausingOpId, setPausingOpId] = useState<string | null>(null);

  // Summer Op States
  const [isSummerOp, setIsSummerOp] = useState(false);
  const [summerCity, setSummerCity] = useState("");
  const [summerPost, setSummerPost] = useState("");

  const initialFormState = {
    name: '',
    pilot_id: '',
    pilot_name: '', // Novo
    second_pilot_id: '',
    second_pilot_name: '', // Novo
    observer_id: '',
    observer_name: '', // Novo
    drone_id: '',
    mission_type: 'sar' as MissionType,
    sub_mission_type: '',
    latitude: -25.2521, 
    longitude: -52.0215,
    radius: 500,
    flight_altitude: 60,
    stream_url: '',
    description: '',
    sarpas_protocol: '', // Campo manual de protocolo
    // Novos campos de tempo
    start_time_local: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
    end_time_local: new Date(new Date().getTime() + 60*60*1000).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
  };

  // Estado estendido para o formulário
  const [formData, setFormData] = useState(initialFormState);

  const [finishData, setFinishData] = useState({
    description: '',
    actions_taken: '',
    flight_hours: 0,
    photos: [] as File[],
    kmz_file: null as File | null
  });

  const loadData = async () => {
    try {
      const [ops, pils, drns] = await Promise.all([
        base44.entities.Operation.list('-created_at'),
        base44.entities.Pilot.filter({ status: 'active' }),
        base44.entities.Drone.list()
      ]);
      setOperations(ops);
      setPilots(pils);
      setDrones(drns);
    } catch(e: any) {
      if (e.message && !e.message.includes("Failed to fetch")) {
         console.error(e);
      }
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); 
    return () => clearInterval(interval);
  }, []);

  const handleLocationSelect = (lat: number, lng: number) => {
    setTempMarker({ lat, lng });
    setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
  };

  const checkConflicts = (newOp: typeof formData): Operation[] => {
    if (!newOp.latitude || !newOp.longitude || !newOp.radius) return [];
    const activeOps = operations.filter(op => op.status === 'active' && op.id !== isEditing);
    const conflicts: Operation[] = [];
    activeOps.forEach(existingOp => {
      const distance = getDistance(newOp.latitude, newOp.longitude, existingOp.latitude, existingOp.longitude);
      if (distance < ((newOp.radius) + existingOp.radius + 100)) conflicts.push(existingOp);
    });
    return conflicts;
  };

  // Função para iniciar edição populando o formulário
  const handleStartEdit = (op: Operation) => {
    const start = new Date(op.start_time);
    const end = op.end_time ? new Date(op.end_time) : new Date(start.getTime() + 60*60000);

    // Tenta encontrar os nomes se não estiverem salvos no objeto, usando os IDs
    const pilot = pilots.find(p => p.id === op.pilot_id);
    const second = pilots.find(p => p.id === op.second_pilot_id);
    const observer = pilots.find(p => p.id === op.observer_id);

    setFormData({
        name: op.name,
        pilot_id: op.pilot_id || '',
        pilot_name: op.pilot_name || pilot?.full_name || '',
        second_pilot_id: op.second_pilot_id || '',
        second_pilot_name: op.second_pilot_name || second?.full_name || '',
        observer_id: op.observer_id || '',
        observer_name: op.observer_name || observer?.full_name || '',
        drone_id: op.drone_id,
        mission_type: op.mission_type,
        sub_mission_type: op.sub_mission_type || '',
        latitude: op.latitude,
        longitude: op.longitude,
        radius: op.radius,
        flight_altitude: op.flight_altitude || 60,
        stream_url: op.stream_url || '',
        description: op.description || '',
        sarpas_protocol: op.sarpas_protocol || '',
        start_time_local: start.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
        end_time_local: end.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
    });
    setTempMarker({ lat: op.latitude, lng: op.longitude });
    setIsEditing(op.id);
    setIsCreating(true); // Força a exibição do formulário
  };

  const handleCancelForm = () => {
    setIsCreating(false);
    setIsEditing(null);
    setTempMarker(null);
    setFormData(initialFormState);
    setSendToSarpas(false);
    setIsSummerOp(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
       performSave();
    } else {
       if (!formData.pilot_name || !formData.drone_id) { alert("Nome do piloto em comando e aeronave são obrigatórios"); return; }
       if (!formData.name) { alert("Nome da operação é obrigatório"); return; }
       
       if (isSummerOp) {
          if (!summerCity || !summerPost) {
             alert("Para Operação Verão, é obrigatório selecionar a Localidade e o Posto de Guarda-Vidas.");
             return;
          }
       }

       const conflicts = checkConflicts(formData);
       if (conflicts.length > 0) setConflictData(conflicts);
       else setShowAroModal(true);
    }
  };

  const handleConflictAck = () => {
    setShowAroModal(true);
  };

  const handleAroConfirm = (assessment: AroAssessment) => {
    setAroData(assessment);
    setShowAroModal(false);
    setShowChecklist(true);
  };

  // Helper para combinar Data Hoje + Hora Input
  const combineDateAndTime = (timeStr: string): string => {
    const now = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
    return date.toISOString();
  };

  const performSave = async () => {
    setLoading(true);
    try {
      const startTimeISO = combineDateAndTime(formData.start_time_local);
      const endTimeISO = combineDateAndTime(formData.end_time_local);

      const sanitizeUuid = (val: string | undefined) => (!val || val === "") ? null : val;

      if (isEditing) {
        await base44.entities.Operation.update(isEditing, {
          name: formData.name,
          pilot_id: sanitizeUuid(formData.pilot_id),
          pilot_name: formData.pilot_name,
          second_pilot_id: sanitizeUuid(formData.second_pilot_id),
          second_pilot_name: formData.second_pilot_name,
          observer_id: sanitizeUuid(formData.observer_id),
          observer_name: formData.observer_name,
          drone_id: formData.drone_id,
          stream_url: formData.stream_url,
          radius: formData.radius,
          flight_altitude: formData.flight_altitude,
          mission_type: formData.mission_type,
          sub_mission_type: formData.sub_mission_type,
          description: formData.description,
          sarpas_protocol: formData.sarpas_protocol, 
          latitude: formData.latitude,
          longitude: formData.longitude,
          start_time: startTimeISO,
          end_time: endTimeISO
        });
        alert("Operação atualizada com sucesso!");
        handleCancelForm();
      } else {
        const selectedPilot = pilots.find(p => p.id === formData.pilot_id);
        const selectedDrone = drones.find(d => d.id === formData.drone_id);
        
        // Inicializa com o valor manual digitado
        let sarpasProtocol = formData.sarpas_protocol || "";
        
        let finalDescription = formData.description;
        if (isSummerOp && summerCity && summerPost) {
            const summerHeader = `[OP VERÃO] ${summerCity} - ${summerPost}`;
            finalDescription = finalDescription 
               ? `${summerHeader}\n\n${finalDescription}` 
               : summerHeader;
        }

        // Integração SARPAS: Só funciona se houver um piloto vinculado com cadastro
        if (sendToSarpas && selectedPilot && selectedDrone) {
           try {
             sarpasProtocol = await sarpasApi.submitFlightRequest({
                ...formData,
                description: finalDescription,
                start_time: startTimeISO,
                end_time: endTimeISO
             }, selectedPilot, selectedDrone);
             alert(`Solicitação SARPAS enviada! Protocolo: ${sarpasProtocol}`);
           } catch (sarpasError: any) {
             console.error("Erro SARPAS", sarpasError);
             const shouldContinue = window.confirm(`Erro ao conectar com SARPAS: ${sarpasError.message}\n\nDeseja continuar criando a operação APENAS localmente (sem registro oficial no espaço aéreo)?`);
             
             if (!shouldContinue) {
                setLoading(false);
                return; 
             }
           }
        }

        const occurrenceNumber = `${new Date().getFullYear()}${selectedPilot?.unit?.split(' ')[0] || 'BM'}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

        const { start_time_local, end_time_local, ...rawPayload } = formData;
        
        const dbPayload = {
            ...rawPayload,
            pilot_id: sanitizeUuid(rawPayload.pilot_id),
            second_pilot_id: sanitizeUuid(rawPayload.second_pilot_id),
            observer_id: sanitizeUuid(rawPayload.observer_id),
        };

        await base44.entities.Operation.create({
          ...dbPayload,
          occurrence_number: occurrenceNumber,
          status: 'active',
          start_time: startTimeISO,
          end_time: endTimeISO,
          photos: [],
          sarpas_protocol: sarpasProtocol,
          aro: aroData,
          is_summer_op: isSummerOp,
          description: finalDescription || `Operação iniciada em ${new Date().toLocaleString()}`
        } as any);

        await base44.entities.Drone.update(formData.drone_id, { status: 'in_operation' });

        if (conflictData && conflictData.length > 0) {
           for (const existingOp of conflictData) {
              const notification: Omit<ConflictNotification, 'id'> = {
                 target_pilot_id: existingOp.pilot_id,
                 new_op_name: formData.name,
                 new_pilot_name: formData.pilot_name || 'Desconhecido',
                 new_pilot_phone: selectedPilot?.phone || '',
                 new_op_altitude: formData.flight_altitude,
                 new_op_radius: formData.radius,
                 created_at: new Date().toISOString(),
                 acknowledged: false
              };
              try {
                await base44.entities.ConflictNotification.create(notification);
              } catch (e) {
                console.error("Erro ao criar notificação de conflito", e);
              }
           }
        }
        
        handleCancelForm();
      }
      loadData();
    } catch (error: any) {
      console.error(error);
      alert(`Erro ao salvar operação: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
      setShowChecklist(false);
      setShowAroModal(false);
      setConflictData(null); 
    }
  };

  // --- PAUSE LOGIC ---

  const handlePauseOp = (opId: string) => {
     setPausingOpId(opId);
  };

  const confirmPause = async (reason: string) => {
     if (!pausingOpId) return;
     setLoading(true);
     try {
        const op = operations.find(o => o.id === pausingOpId);
        if (!op) throw new Error("Operação não encontrada");

        const currentLogs = op.pause_logs || [];
        const newLog = { start: new Date().toISOString(), reason };
        
        await base44.entities.Operation.update(pausingOpId, {
            is_paused: true,
            last_pause_start: new Date().toISOString(),
            pause_logs: [...currentLogs, newLog]
        });
        
        alert("Operação pausada! O tempo de voo está congelado.");
        setPausingOpId(null);
        loadData();
     } catch (e) {
        console.error(e);
        alert("Erro ao pausar");
     } finally {
        setLoading(false);
     }
  };

  const handleResumeOp = async (op: Operation) => {
     if (!op.is_paused || !op.last_pause_start) return;
     
     if (!window.confirm(`Retomar operação "${op.name}"?`)) return;
     
     setLoading(true);
     try {
        const now = new Date();
        const pauseStart = new Date(op.last_pause_start);
        const pauseDurationMinutes = Math.round((now.getTime() - pauseStart.getTime()) / 60000);
        
        const currentLogs = op.pause_logs || [];
        // Update last log with end time
        if (currentLogs.length > 0) {
            currentLogs[currentLogs.length - 1].end = now.toISOString();
            currentLogs[currentLogs.length - 1].duration = pauseDurationMinutes;
        }

        await base44.entities.Operation.update(op.id, {
            is_paused: false,
            last_pause_start: null,
            total_pause_duration: (op.total_pause_duration || 0) + pauseDurationMinutes,
            pause_logs: currentLogs
        });
        
        alert("Operação retomada com sucesso!");
        loadData();
     } catch (e) {
        console.error(e);
        alert("Erro ao retomar");
     } finally {
        setLoading(false);
     }
  };


  const handleFinishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFinishing) return;
    setLoading(true);

    try {
      const endTime = new Date();
      const startTime = new Date(isFinishing.start_time);
      
      // Tempo total decorrido bruto (minutos)
      const rawDurationMinutes = (endTime.getTime() - startTime.getTime()) / 60000;
      
      // Descontar pausas
      const totalPauseMinutes = isFinishing.total_pause_duration || 0;
      
      // Tempo efetivo em HORAS (com casas decimais)
      const calculatedDuration = Number(((rawDurationMinutes - totalPauseMinutes) / 60).toFixed(2));
      
      // Proteção contra tempo negativo
      const finalFlightHours = calculatedDuration > 0 ? calculatedDuration : 0.01;

      let kmzUrl = "";
      if (finishData.kmz_file) {
        const upload = await base44.integrations.Core.UploadFile({ file: finishData.kmz_file });
        kmzUrl = upload.url;
      }

      await base44.entities.Operation.update(isFinishing.id, {
        status: 'completed',
        end_time: endTime.toISOString(),
        flight_hours: finalFlightHours,
        description: finishData.description,
        actions_taken: finishData.actions_taken,
        kmz_file: kmzUrl
      } as any);

      const currentDrone = drones.find(d => d.id === isFinishing.drone_id);
      await base44.entities.Drone.update(isFinishing.drone_id, { 
          status: 'available',
          total_flight_hours: (currentDrone?.total_flight_hours || 0) + finalFlightHours
      });
      
      await base44.entities.FlightLog.create({
        operation_id: isFinishing.id,
        pilot_id: isFinishing.pilot_id,
        drone_id: isFinishing.drone_id,
        flight_date: isFinishing.start_time,
        flight_hours: finalFlightHours,
        mission_type: isFinishing.mission_type
      });

      if (isFinishing.is_summer_op) {
         const pilot = pilots.find(p => p.id === isFinishing.pilot_id);
         
         const missionMap: Record<string, 'patrulha' | 'resgate' | 'prevencao' | 'apoio' | 'treinamento'> = {
           sar: 'resgate', fire: 'apoio', aph: 'apoio', traffic_accident: 'apoio',
           hazmat: 'apoio', natural_disaster: 'apoio', public_security: 'patrulha',
           inspection: 'prevencao', air_support: 'apoio', maritime: 'resgate',
           environmental: 'patrulha', training: 'treinamento', admin_support: 'apoio',
           diverse: 'prevencao', search_rescue: 'resgate', civil_defense: 'apoio',
           monitoring: 'patrulha', disaster: 'apoio'
         };
         
         let locationName = isFinishing.name;
         if (isFinishing.description && isFinishing.description.includes('[OP VERÃO]')) {
             const firstLine = isFinishing.description.split('\n')[0];
             locationName = firstLine.replace('[OP VERÃO] ', '').trim();
         }

         await operationSummerService.create({
            pilot_id: isFinishing.pilot_id,
            drone_id: isFinishing.drone_id,
            mission_type: missionMap[isFinishing.mission_type] || 'prevencao', 
            location: locationName, 
            date: isFinishing.start_time.split('T')[0],
            start_time: new Date(isFinishing.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            end_time: endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            flight_duration: Math.round(finalFlightHours * 60),
            notes: `Ocorrência: ${isFinishing.occurrence_number}. ${finishData.description}`,
            evidence_photos: [],
            evidence_videos: []
         }, pilot?.id || 'system');
         
         alert("Registro no Diário da Operação Verão criado automaticamente!");
      }

      setIsFinishing(null);
      loadData();
    } catch (error) {
      console.error(error);
      alert("Erro ao encerrar operação");
    } finally {
      setLoading(false);
    }
  };

  const handleShareOp = (op: Operation) => {
      const pilot = pilots.find(p => p.id === op.pilot_id);
      const drone = drones.find(d => d.id === op.drone_id);

      const mapLink = `https://www.google.com/maps?q=${op.latitude},${op.longitude}`;
      const streamText = op.stream_url ? `\n📡 *Transmissão:* ${op.stream_url}` : '';
      const missionLabel = MISSION_HIERARCHY[op.mission_type]?.label || op.mission_type;
      
      const startTime = new Date(op.start_time);
      const endTime = op.end_time 
          ? new Date(op.end_time) 
          : new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // +2h se não definido

      const text = `🚨 *SYSARP - SITUAÇÃO OPERACIONAL* 🚨\n\n` +
          `🚁 *Ocorrência:* ${op.name}\n` +
          `🔢 *Protocolo:* ${op.occurrence_number}\n` +
          `📋 *Natureza:* ${missionLabel}\n` +
          `👤 *Piloto:* ${op.pilot_name || pilot?.full_name || 'N/A'}\n` +
          `📞 *Contato:* ${pilot ? pilot.phone : 'N/A'}\n` +
          `🛸 *Aeronave:* ${drone ? `${drone.model} (${drone.prefix})` : 'N/A'}\n` +
          `📍 *Coord:* ${op.latitude}, ${op.longitude}\n` +
          `🗺️ *Mapa:* ${mapLink}\n` +
          `🕒 *Início:* ${startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}\n` +
          `🏁 *Término Previsto:* ${endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}\n` +
          `📝 *Protocolo SARPAS:* ${op.sarpas_protocol || 'N/A'}\n` +
          `${streamText}\n\n` +
          `_Enviado via Centro de Comando SYSARP_`;

      const encodedText = encodeURIComponent(text);
      window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  const activeOps = operations.filter(o => o.status === 'active');
  const historyOps = operations.filter(o => o.status === 'completed');
  const displayedOps = activeTab === 'active' ? activeOps : historyOps;

  return (
    <div className="flex flex-col lg:flex-row h-full w-full relative bg-slate-100 overflow-hidden">
      {conflictData && <ConflictModal conflicts={conflictData} onAck={handleConflictAck} onCancel={() => setConflictData(null)} />}
      {showAroModal && <AroModal onConfirm={handleAroConfirm} onCancel={() => setShowAroModal(false)} />}
      {showChecklist && <ChecklistModal onConfirm={performSave} onCancel={() => setShowChecklist(false)} />}
      {pausingOpId && <PauseReasonModal onConfirm={confirmPause} onCancel={() => setPausingOpId(null)} />}

      <datalist id="pilots-list">
          {pilots.map(p => <option key={p.id} value={p.full_name} />)}
      </datalist>

      {/* Mapa (Esquerda) */}
      <div className="w-full h-[40vh] lg:h-full lg:flex-1 z-0 relative order-1 lg:order-1 border-b lg:border-r border-slate-200">
        <MapContainer 
          center={[-25.2521, -52.0215]} 
          zoom={8} 
          style={{ height: '100%', width: '100%' }}
        >
          <MapController />
          <TileLayer attribution='OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <LocationSelector onLocationSelect={handleLocationSelect} isSelecting={isCreating} />
          
          {activeOps.map(op => {
            const lat = Number(op.latitude);
            const lng = Number(op.longitude);
            if (isNaN(lat) || isNaN(lng)) return null;
            return (
              <Marker key={op.id} position={[lat, lng]} icon={icon}>
                  <Popup>
                    <b>{op.name}</b><br/>
                    {op.is_summer_op && <span className="text-orange-600 font-bold text-xs">☀️ Op. Verão</span>}
                    {(op.second_pilot_name || op.observer_name) && (
                        <div className="flex gap-1 mt-1 text-xs text-blue-600 font-bold">
                            Equipe Estendida
                        </div>
                    )}
                    {op.is_paused && <span className="block mt-1 text-amber-600 font-bold bg-amber-50 px-1 rounded border border-amber-200 text-xs text-center">PAUSADA</span>}
                  </Popup>
              </Marker>
            );
          })}
          
          {tempMarker && !isNaN(Number(formData.radius)) && formData.radius > 0 && (
            <>
              <Marker key="temp-marker" position={[tempMarker.lat, tempMarker.lng]} icon={tempIcon} />
              <Circle 
                center={[tempMarker.lat, tempMarker.lng]} 
                radius={Number(formData.radius)} 
                pathOptions={{ color: 'orange', dashArray: '5, 5', fillColor: 'orange', fillOpacity: 0.2 }}
              />
            </>
          )}
        </MapContainer>
      </div>

      {/* Painel Lateral (Direita) */}
      <div className="w-full lg:w-[28rem] h-auto flex-1 lg:h-full bg-white lg:border-l border-slate-200 z-10 flex flex-col shadow-xl overflow-hidden order-2 lg:order-2">
        
        {isCreating ? (
           <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* ... Form Header ... */}
              <div className="p-4 border-b flex items-center justify-between bg-slate-50 shrink-0">
                 <h2 className="font-bold text-lg text-slate-800">{isEditing ? 'Editar Operação' : 'Nova Operação'}</h2>
                 <Button variant="outline" onClick={handleCancelForm} size="sm"><X className="w-4 h-4"/></Button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                <form id="opForm" onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                         <div className="space-y-3">
                            <Input label="Nome da Operação" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: Busca em Matinhos" required />
                            <Select label="Aeronave" required value={formData.drone_id} onChange={e => setFormData({...formData, drone_id: e.target.value})}>
                                <option value="">Selecione...</option>
                                {drones.map(d => <option key={d.id} value={d.id}>{d.prefix} - {d.model}</option>)}
                            </Select>
                         </div>
                    </div>

                    <div className="space-y-4">
                         <h3 className="text-xs font-bold text-slate-500 uppercase border-b pb-1 flex items-center gap-2">
                            <Users className="w-3 h-3" /> Equipe de Voo
                         </h3>
                         <div className="space-y-3">
                            <Input 
                                label="Piloto em Comando (PIC) *" required list="pilots-list" value={formData.pilot_name}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const found = pilots.find(p => p.full_name === val);
                                    setFormData({...formData, pilot_name: val, pilot_id: found ? found.id : ''});
                                }}
                                placeholder="Digite ou selecione..."
                                className="font-semibold bg-blue-50 border-blue-200"
                            />
                            <Input 
                                label="Segundo Piloto (Opcional)" list="pilots-list" value={formData.second_pilot_name}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const found = pilots.find(p => p.full_name === val);
                                    setFormData({...formData, second_pilot_name: val, second_pilot_id: found ? found.id : ''});
                                }}
                                placeholder="Digite ou selecione..."
                            />
                            <Input 
                                label="Observador (Opcional)" list="pilots-list" value={formData.observer_name}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const found = pilots.find(p => p.full_name === val);
                                    setFormData({...formData, observer_name: val, observer_id: found ? found.id : ''});
                                }}
                                placeholder="Digite ou selecione..."
                            />
                         </div>
                    </div>

                    <div className="space-y-4">
                         <h3 className="text-xs font-bold text-slate-500 uppercase border-b pb-1 flex items-center gap-2">
                            <Radio className="w-3 h-3" /> Detalhes da Missão
                         </h3>
                         <div className="grid grid-cols-2 gap-3">
                            <Select label="Natureza" required value={formData.mission_type} onChange={e => setFormData({...formData, mission_type: e.target.value as any, sub_mission_type: ''})}>
                                {Object.entries(MISSION_HIERARCHY).map(([k, v]) => <option key={k} value={k}>{(v as any).label}</option>)}
                            </Select>
                            <Select label="Sub-natureza" required value={formData.sub_mission_type} onChange={e => setFormData({...formData, sub_mission_type: e.target.value})}>
                                <option value="">Selecione...</option>
                                {(MISSION_HIERARCHY[formData.mission_type]?.subtypes || []).map(sub => <option key={sub} value={sub}>{sub}</option>)}
                            </Select>
                         </div>
                         <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">Descrição / Observações (SARPAS)</label>
                            <textarea 
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none h-20 resize-none"
                                placeholder="Detalhes da ocorrência..."
                                value={formData.description}
                                onChange={e => setFormData({...formData, description: e.target.value})}
                            />
                         </div>
                    </div>

                    <div className="space-y-4">
                         <h3 className="text-xs font-bold text-slate-500 uppercase border-b pb-1 flex items-center gap-2">
                            <Plane className="w-3 h-3" /> Parâmetros de Voo
                         </h3>
                         <div className="grid grid-cols-2 gap-3">
                            <Input label="Raio (m)" type="number" value={formData.radius} onChange={e => setFormData({...formData, radius: Number(e.target.value)})} required />
                            <Input label="Altitude (m)" type="number" value={formData.flight_altitude} onChange={e => setFormData({...formData, flight_altitude: Number(e.target.value)})} required />
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                            <Input label="Início (Hora)" type="time" required value={formData.start_time_local} onChange={e => setFormData({...formData, start_time_local: e.target.value})} />
                            <Input label="Término Previsto" type="time" required value={formData.end_time_local} onChange={e => setFormData({...formData, end_time_local: e.target.value})} />
                         </div>
                         <Input label="Link de Transmissão (Opcional)" placeholder="RTMP / YouTube / DroneDeploy" value={formData.stream_url} onChange={e => setFormData({...formData, stream_url: e.target.value})} />
                    </div>

                    <div className="space-y-4">
                         <h3 className="text-xs font-bold text-slate-500 uppercase border-b pb-1 flex items-center gap-2">
                            <MapIcon className="w-3 h-3" /> Localização e Clima
                         </h3>
                         <div className="grid grid-cols-2 gap-3">
                             <Input label="Latitude" value={formData.latitude} readOnly className="bg-slate-50 text-slate-500" />
                             <Input label="Longitude" value={formData.longitude} readOnly className="bg-slate-50 text-slate-500" />
                         </div>
                         <div className="p-2 bg-blue-50 border border-blue-100 rounded text-xs text-blue-800 flex items-center gap-2">
                            <Crosshair className="w-4 h-4" />
                            Clique no mapa para atualizar a coordenada.
                         </div>
                         <WeatherWidget lat={formData.latitude} lng={formData.longitude} />
                    </div>

                    <div className="space-y-3 pt-2">
                        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Send className="w-4 h-4 text-indigo-600" />
                                    <div>
                                        <span className="text-xs font-bold text-indigo-800 flex items-center gap-2">
                                            Solicitar Voo (SARPAS)
                                            <span className="text-[10px] bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded border border-indigo-300">EM CONSTRUÇÃO</span>
                                        </span>
                                        <span className="text-xs text-indigo-600 block">Integração automática temporariamente desativada</span>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-1 animate-fade-in">
                                <Input 
                                    label="Protocolo SARPAS (Manual)"
                                    placeholder="Ex: SRPS-12345678"
                                    value={formData.sarpas_protocol}
                                    onChange={e => setFormData({...formData, sarpas_protocol: e.target.value})}
                                    className="bg-white text-xs"
                                />
                            </div>
                        </div>

                        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Sun className="w-4 h-4 text-orange-600" />
                                    <div>
                                        <span className="text-xs font-bold text-orange-800 block">Operação Verão</span>
                                    </div>
                                </div>
                                <input type="checkbox" className="w-5 h-5 accent-orange-600" checked={isSummerOp} onChange={e => setIsSummerOp(e.target.checked)} />
                            </div>
                            {isSummerOp && (
                                <div className="grid grid-cols-2 gap-2 pt-1 animate-fade-in">
                                    <Select className="text-xs bg-white" value={summerCity} onChange={e => { setSummerCity(e.target.value); setSummerPost(""); }}>
                                        <option value="">Cidade...</option>
                                        {Object.keys(SUMMER_LOCATIONS).map(city => <option key={city} value={city}>{city}</option>)}
                                    </Select>
                                    <Select className="text-xs bg-white" value={summerPost} disabled={!summerCity} onChange={e => setSummerPost(e.target.value)}>
                                        <option value="">Posto...</option>
                                        {summerCity && SUMMER_LOCATIONS[summerCity].map(post => <option key={post} value={post}>{post}</option>)}
                                    </Select>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="sticky bottom-0 bg-white pt-4 border-t border-slate-100 flex gap-3">
                        <Button type="button" variant="outline" onClick={handleCancelForm} className="flex-1">Cancelar</Button>
                        <Button type="submit" className="flex-1" disabled={loading}>
                            {loading ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Prosseguir')}
                        </Button>
                    </div>
                </form>
              </div>
           </div>
        ) : isFinishing ? (
           <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between bg-slate-50 shrink-0">
                 <h2 className="font-bold text-lg text-slate-800">Encerrar Operação</h2>
                 <Button variant="outline" onClick={() => setIsFinishing(null)} size="sm"><X className="w-4 h-4"/></Button>
              </div>
              <div className="p-6 overflow-y-auto">
                 <form onSubmit={handleFinishSubmit} className="space-y-4">
                    <div className="bg-slate-50 p-3 rounded text-sm mb-2">
                       <p className="font-bold text-slate-700">{isFinishing.name}</p>
                       <p className="text-slate-500 text-xs">Início: {new Date(isFinishing.start_time).toLocaleString()}</p>
                       
                       {isFinishing.is_paused && (
                           <div className="bg-amber-100 text-amber-800 p-2 mt-2 rounded text-xs font-bold border border-amber-200 flex items-center gap-2">
                               <AlertTriangle className="w-4 h-4" />
                               ATENÇÃO: A operação está PAUSADA. Retome para encerrar corretamente ou confirme abaixo para encerrar e contabilizar o tempo até a última pausa.
                           </div>
                       )}
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Descrição Final / Resultado</label>
                        <textarea 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm h-24 focus:ring-2 focus:ring-green-500 outline-none"
                            placeholder="Descreva o desfecho da operação..."
                            required
                            value={finishData.description}
                            onChange={e => setFinishData({...finishData, description: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Ações Realizadas</label>
                        <textarea 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm h-20 focus:ring-2 focus:ring-green-500 outline-none"
                            placeholder="Voo de busca, varredura, monitoramento..."
                            value={finishData.actions_taken}
                            onChange={e => setFinishData({...finishData, actions_taken: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Anexar Log de Voo (KMZ/KML)</label>
                        <input 
                            type="file" 
                            accept=".kmz,.kml,.gpx"
                            className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            onChange={e => setFinishData({...finishData, kmz_file: e.target.files ? e.target.files[0] : null})}
                        />
                    </div>
                    <Button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white mt-4">
                        {loading ? 'Encerrando...' : 'Confirmar Encerramento'}
                    </Button>
                 </form>
              </div>
           </div>
        ) : (
           <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="p-4 border-b flex flex-col gap-4 bg-slate-50 shrink-0">
                 <div className="flex justify-between items-center">
                    <div>
                       <h2 className="font-bold text-lg text-slate-800">Operações</h2>
                       <p className="text-xs text-slate-500">Gerencie missões</p>
                    </div>
                    <Button onClick={() => { setFormData(initialFormState); setIsCreating(true); }} size="sm" className="shadow-sm">
                       <Plus className="w-4 h-4 mr-1" /> Nova
                    </Button>
                 </div>
                 
                 {/* Tabs Navigation */}
                 <div className="flex bg-slate-200 p-1 rounded-lg">
                     <button 
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'active' ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => setActiveTab('active')}
                     >
                        <Activity className="w-3 h-3" /> Em Andamento ({activeOps.length})
                     </button>
                     <button 
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => setActiveTab('history')}
                     >
                        <History className="w-3 h-3" /> Histórico Recente
                     </button>
                 </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                 {displayedOps.length === 0 ? (
                    <div className="text-center p-8 text-slate-400 text-sm italic">
                       Nenhuma operação {activeTab === 'active' ? 'ativa' : 'no histórico'}.
                    </div>
                 ) : (
                    displayedOps.map(op => (
                       <div key={op.id} className={`bg-white border rounded-lg p-3 hover:shadow-md transition-shadow relative ${op.status === 'completed' ? 'opacity-80 bg-slate-50 border-slate-200' : 'border-l-4 border-l-green-500'}`}>
                          <div className="flex justify-between items-start mb-1">
                             <h3 className="font-bold text-slate-800 text-sm">{op.name}</h3>
                             {op.is_paused ? (
                                 <Badge className="bg-amber-100 text-amber-700 animate-pulse flex items-center gap-1 text-[10px]">
                                     <Pause className="w-3 h-3" /> PAUSADA
                                 </Badge>
                             ) : (
                                 <Badge variant={op.status === 'active' ? 'success' : 'default'} className="text-[10px] uppercase">{op.status === 'active' ? 'Ativa' : 'Finalizada'}</Badge>
                             )}
                          </div>
                          <div className="text-xs text-slate-500 space-y-1">
                             <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {new Date(op.start_time).toLocaleString()}
                             </div>
                             <div className="flex items-center gap-1 font-mono">
                                <ShieldCheck className="w-3 h-3" /> {op.occurrence_number}
                             </div>
                             <div className="flex items-center gap-1 text-slate-600">
                                <User className="w-3 h-3" /> {op.pilot_name || 'Piloto N/I'}
                             </div>
                             {(op.second_pilot_name || op.observer_name) && (
                                <div className="flex gap-2 mt-1">
                                    {op.second_pilot_name && <span title="Segundo Piloto" className="flex items-center gap-1 text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded"><Users className="w-3 h-3"/> 2º Piloto</span>}
                                    {op.observer_name && <span title="Observador" className="flex items-center gap-1 text-purple-600 font-bold bg-purple-50 px-1.5 py-0.5 rounded"><Eye className="w-3 h-3"/> Obs.</span>}
                                </div>
                             )}
                          </div>
                          
                          <div className="mt-3 flex gap-2 border-t pt-2">
                            {op.status === 'active' ? (
                                <>
                                    {op.is_paused ? (
                                        <Button 
                                            size="sm" 
                                            className="flex-1 h-8 text-xs bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100" 
                                            onClick={() => handleResumeOp(op)}
                                            title="Retomar Operação"
                                        >
                                            <Play className="w-3 h-3 mr-1" /> Retomar
                                        </Button>
                                    ) : (
                                        <Button 
                                            size="sm" 
                                            className="flex-1 h-8 text-xs bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100" 
                                            onClick={() => handlePauseOp(op.id)}
                                            title="Pausar (Troca de Bateria, etc.)"
                                        >
                                            <Pause className="w-3 h-3 mr-1" /> Pausar
                                        </Button>
                                    )}

                                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 flex items-center justify-center" onClick={() => handleStartEdit(op)} title="Editar">
                                        <Pencil className="w-3 h-3" />
                                    </Button>
                                    
                                    <Button size="sm" className="flex-1 h-8 text-xs bg-slate-800 text-white hover:bg-black" onClick={() => setIsFinishing(op)}>
                                        <CheckSquare className="w-3 h-3 mr-1" /> Encerrar
                                    </Button>
                                    
                                    <Button 
                                        size="sm"
                                        className="h-8 w-8 p-0 flex items-center justify-center bg-green-100 text-green-700 hover:bg-green-200 border-green-200"
                                        onClick={() => handleShareOp(op)}
                                        title="Compartilhar"
                                    >
                                        <Share2 className="w-4 h-4" />
                                    </Button>
                                </>
                            ) : (
                                <Button variant="outline" size="sm" className="w-full h-8 text-xs text-slate-500" disabled>
                                    Arquivado
                                </Button>
                            )}
                          </div>
                       </div>
                    ))
                 )}
              </div>
           </div>
        )}
      </div>
    </div>
  );
}