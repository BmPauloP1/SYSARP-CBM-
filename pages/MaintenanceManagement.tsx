import React, { useState, useEffect } from "react";
import { base44 } from "../services/base44Client";
import { Maintenance, Drone, Pilot, MaintenanceType } from "../types";
import { Card, Button, Input, Select, Badge } from "../components/ui_components";
import { Wrench, Calendar, FileText, Upload, AlertTriangle, CheckCircle, Clock, ClipboardCheck, ArrowRight, Database, Copy, X } from "lucide-react";

export default function MaintenanceManagement() {
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [pendingMaintenances, setPendingMaintenances] = useState<Maintenance[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<Pilot | null>(null);

  // Form State - Nova Manutenção
  const [formData, setFormData] = useState<Partial<Maintenance>>({
    maintenance_type: 'corrective',
    maintenance_date: new Date().toISOString().split('T')[0],
    maintenance_time: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
    in_flight_incident: false,
    status: 'scheduled'
  });

  // Form State - Baixa de Manutenção (Realizar)
  const [closureId, setClosureId] = useState("");
  const [closureData, setClosureData] = useState({
    technician: "",
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
    notes: "",
    type: "corrective" as MaintenanceType
  });

  const [logFile, setLogFile] = useState<File | null>(null);
  
  // SQL Error State
  const [sqlError, setSqlError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [maintList, droneList, pilotList, me] = await Promise.all([
        base44.entities.Maintenance.list('-maintenance_date'),
        base44.entities.Drone.list(),
        base44.entities.Pilot.filter({ status: 'active' }),
        base44.auth.me()
      ]);
      
      setMaintenances(maintList);
      setPendingMaintenances(maintList.filter(m => m.status !== 'completed'));
      setDrones(droneList);
      setPilots(pilotList);
      setCurrentUser(me);
    } catch(e) {
      console.error(e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLogFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let fileUrl = "";
      if (formData.in_flight_incident && logFile) {
        const uploadResult = await base44.integrations.Core.UploadFile({ file: logFile });
        fileUrl = uploadResult.url;
      }

      await base44.entities.Maintenance.create({
        ...formData,
        log_file_url: fileUrl,
        next_maintenance_date: formData.next_maintenance_date || new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
        cost: formData.cost || 0
      } as any);

      if (formData.drone_id && (formData.maintenance_type === 'corrective' || formData.in_flight_incident)) {
        await base44.entities.Drone.update(formData.drone_id, { status: 'maintenance' });
      }

      alert("Registro de manutenção criado com sucesso!");
      setFormData({
        maintenance_type: 'corrective',
        maintenance_date: new Date().toISOString().split('T')[0],
        maintenance_time: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
        in_flight_incident: false,
        status: 'scheduled',
        description: '',
        technician: ''
      });
      setLogFile(null);
      loadData();
    } catch (error: any) {
      console.error(error);
      const msg = error.message || '';
      
      // Detecção de erro de tabela ou coluna faltante
      if (msg.includes("relation") || msg.includes("column") || msg.includes("permission")) {
          if (currentUser?.role === 'admin') {
              setSqlError(`
-- SQL PARA CRIAR/CORRIGIR TABELA DE MANUTENÇÕES
CREATE TABLE IF NOT EXISTS public.maintenances (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now(),
    drone_id uuid REFERENCES public.drones(id) ON DELETE CASCADE,
    pilot_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    maintenance_type text NOT NULL,
    description text,
    technician text,
    maintenance_date date,
    maintenance_time time,
    next_maintenance_date date,
    cost float DEFAULT 0,
    status text DEFAULT 'scheduled',
    in_flight_incident boolean DEFAULT false,
    log_file_url text
);

-- PERMISSÕES
ALTER TABLE public.maintenances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir Acesso Total" ON public.maintenances FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
              `);
          } else {
              alert("Erro de banco de dados. Contate o administrador.");
          }
      } else {
          alert(`Erro ao registrar manutenção: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closureId) return;
    setLoading(true);

    try {
        const originalMaint = pendingMaintenances.find(m => m.id === closureId);
        if (!originalMaint) throw new Error("Registro não encontrado");

        const updatedDescription = `${originalMaint.description}\n\n[RESOLUÇÃO ${closureData.date} ${closureData.time}]: ${closureData.notes}`;

        await base44.entities.Maintenance.update(closureId, {
            status: 'completed',
            technician: closureData.technician,
            maintenance_date: closureData.date,
            maintenance_time: closureData.time,
            maintenance_type: closureData.type,
            description: updatedDescription
        });

        await base44.entities.Drone.update(originalMaint.drone_id, { status: 'available' });

        alert("Manutenção registrada e aeronave liberada com sucesso!");
        
        setClosureId("");
        setClosureData({
            technician: "",
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
            notes: "",
            type: "corrective"
        });
        
        loadData();

    } catch (error: any) {
        console.error(error);
        if (error.message && (error.message.includes("permission") || error.message.includes("policy"))) {
             if (currentUser?.role === 'admin') {
                 setSqlError(`
-- CORREÇÃO DE PERMISSÃO (RLS)
DROP POLICY IF EXISTS "Permitir atualizar manutenções" ON public.maintenances;
CREATE POLICY "Permitir atualizar manutenções" ON public.maintenances FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
                 `);
             }
             alert("Erro de permissão ao atualizar registro.");
        } else {
             alert("Erro ao realizar baixa da manutenção.");
        }
    } finally {
        setLoading(false);
    }
  };

  const copySqlToClipboard = () => {
    if (sqlError) {
      navigator.clipboard.writeText(sqlError);
      alert("Código SQL copiado!");
    }
  };

  const maintenanceTypes: Record<MaintenanceType, string> = {
    preventive: "Preventiva",
    corrective: "Corretiva",
    inspection: "Inspeção",
    calibration: "Calibração",
    battery: "Bateria",
    propeller: "Hélices",
    camera: "Câmera/Gimbal",
    general: "Geral"
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative">
      
      {/* SQL FIX MODAL (Only for Admins) */}
      {sqlError && currentUser?.role === 'admin' && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in">
           <Card className="w-full max-w-3xl flex flex-col bg-white border-4 border-red-600 shadow-2xl">
              <div className="p-4 bg-red-600 text-white flex justify-between items-center">
                 <h3 className="font-bold text-lg flex items-center gap-2"><Database className="w-6 h-6" /> Atualização Necessária</h3>
                 <button onClick={() => setSqlError(null)} className="hover:bg-red-700 p-1 rounded"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                 <p className="text-slate-700 font-medium">O módulo de manutenção encontrou uma inconsistência no banco de dados. Execute o código abaixo no Supabase para corrigir.</p>
                 <div className="relative"><pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto font-mono border border-slate-700 max-h-64">{sqlError}</pre>
                 <button onClick={copySqlToClipboard} className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white p-2 rounded"><Copy className="w-4 h-4" /></button></div>
              </div>
              <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
                 <Button variant="outline" onClick={() => setSqlError(null)}>Fechar</Button>
                 <Button onClick={copySqlToClipboard} className="bg-blue-600 text-white hover:bg-blue-700"><Copy className="w-4 h-4 mr-2" /> Copiar SQL</Button>
              </div>
           </Card>
        </div>
      )}

      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 p-4 md:p-6 shadow-sm z-10">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Wrench className="w-6 h-6 md:w-8 md:h-8 text-slate-700" />
          Gestão de Manutenção
        </h1>
        <p className="text-xs md:text-sm text-slate-500 mt-1">Controle de intervenções técnicas e histórico da frota.</p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6 pb-8">
          
          <div className="grid lg:grid-cols-3 gap-6">
            
            {/* COLUMN LEFT: ACTIONS */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* CARD 1: REALIZAR MANUTENÇÃO (BAIXA) */}
              <Card className="p-5 md:p-6 shadow-md border-l-4 border-l-green-500 bg-white">
                 <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-green-600"/>
                    Realizar Manutenção (Baixa)
                 </h2>
                 <form onSubmit={handleCompleteMaintenance} className="space-y-4">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Ordem de Serviço Pendente</label>
                        <select 
                            className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-green-500 outline-none bg-white"
                            value={closureId}
                            onChange={(e) => {
                                setClosureId(e.target.value);
                                const selected = pendingMaintenances.find(m => m.id === e.target.value);
                                if (selected) {
                                    setClosureData(prev => ({
                                        ...prev,
                                        technician: selected.technician !== 'A definir' ? selected.technician : '',
                                        type: selected.maintenance_type
                                    }));
                                }
                            }}
                            required
                        >
                            <option value="">Selecione para dar baixa...</option>
                            {pendingMaintenances.map(m => {
                                const drone = drones.find(d => d.id === m.drone_id);
                                return (
                                    <option key={m.id} value={m.id}>
                                        {drone?.prefix} - {new Date(m.maintenance_date).toLocaleDateString()} ({maintenanceTypes[m.maintenance_type]})
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Input 
                            label="Data Realização" 
                            type="date" 
                            required 
                            value={closureData.date} 
                            onChange={e => setClosureData({...closureData, date: e.target.value})}
                        />
                        <Input 
                            label="Hora" 
                            type="time" 
                            required 
                            value={closureData.time} 
                            onChange={e => setClosureData({...closureData, time: e.target.value})}
                        />
                    </div>

                    <Select 
                        label="Tipo de Manutenção Realizada" 
                        required 
                        value={closureData.type} 
                        onChange={e => setClosureData({...closureData, type: e.target.value as MaintenanceType})}
                    >
                        {Object.entries(maintenanceTypes).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </Select>

                    <Input 
                        label="Realizado por (Técnico)" 
                        placeholder="Nome do responsável"
                        required
                        value={closureData.technician} 
                        onChange={e => setClosureData({...closureData, technician: e.target.value})}
                    />

                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">O que foi feito? (Relatório)</label>
                        <textarea 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm h-20 resize-none bg-white text-slate-900"
                            placeholder="Descreva o serviço executado..."
                            required
                            value={closureData.notes} 
                            onChange={e => setClosureData({...closureData, notes: e.target.value})}
                        />
                    </div>

                    <Button type="submit" disabled={loading || !closureId} className="w-full bg-green-600 hover:bg-green-700 text-white shadow-md">
                        {loading ? 'Processando...' : 'Registrar Manutenção'}
                    </Button>
                 </form>
              </Card>

              {/* CARD 2: NOVA SOLICITAÇÃO */}
              <Card className="p-5 md:p-6 shadow-md border border-slate-200">
                <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                   <AlertTriangle className="w-5 h-5 text-amber-600"/>
                   Solicitar / Agendar Evento
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Select 
                    label="Aeronave" 
                    required 
                    value={formData.drone_id || ''} 
                    onChange={e => setFormData({...formData, drone_id: e.target.value})}
                  >
                    <option value="">Selecione o drone...</option>
                    {drones.map(d => (
                      <option key={d.id} value={d.id}>{d.prefix} - {d.model}</option>
                    ))}
                  </Select>

                  <div className="grid grid-cols-2 gap-3">
                    <Input 
                      label="Data Solicitação" 
                      type="date" 
                      required 
                      value={formData.maintenance_date} 
                      onChange={e => setFormData({...formData, maintenance_date: e.target.value})}
                    />
                    <Input 
                      label="Hora" 
                      type="time" 
                      required 
                      value={formData.maintenance_time} 
                      onChange={e => setFormData({...formData, maintenance_time: e.target.value})}
                    />
                  </div>

                  <Select 
                    label="Tipo de Manutenção" 
                    required 
                    value={formData.maintenance_type} 
                    onChange={e => setFormData({...formData, maintenance_type: e.target.value as MaintenanceType})}
                  >
                    {Object.entries(maintenanceTypes).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </Select>

                  <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                        checked={formData.in_flight_incident}
                        onChange={e => setFormData({...formData, in_flight_incident: e.target.checked})}
                      />
                      <span className="font-semibold text-red-800 text-sm">Aconteceu em voo?</span>
                    </label>

                    {formData.in_flight_incident && (
                      <div className="mt-2 animate-fade-in">
                        <label className="block text-xs font-medium text-red-700 mb-1">
                          Log de Voo (AirData/KML/KMZ)
                        </label>
                        <div className="flex items-center gap-2">
                          <label className="flex-1 cursor-pointer bg-white border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm flex items-center justify-center hover:bg-red-50 transition-colors shadow-sm">
                            <Upload className="w-4 h-4 mr-2" />
                            <span className="truncate">{logFile ? logFile.name : "Anexar Arquivo"}</span>
                            <input type="file" className="hidden" accept=".kml,.kmz,.csv,.txt" onChange={handleFileChange} />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  <Select 
                    label="Piloto Responsável" 
                    required={formData.in_flight_incident} // Obrigatório se foi incidente
                    value={formData.pilot_id || ''} 
                    onChange={e => setFormData({...formData, pilot_id: e.target.value})}
                  >
                    <option value="">Selecione o piloto...</option>
                    {pilots.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>
                    ))}
                  </Select>

                  <Input 
                    label="Técnico / Oficina (Destino)" 
                    placeholder="Para quem enviar?"
                    required
                    value={formData.technician || ''} 
                    onChange={e => setFormData({...formData, technician: e.target.value})}
                  />

                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Motivo / Problema</label>
                    <textarea 
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm h-20 resize-none bg-white text-slate-900"
                      placeholder="Descreva o problema..."
                      required
                      value={formData.description || ''} 
                      onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                  </div>

                  <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                    {loading ? 'Salvando...' : 'Abrir Chamado'}
                  </Button>
                </form>
              </Card>
            </div>

            {/* LISTA HISTÓRICO (Right Column on Desktop, Bottom on Mobile) */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                 <Clock className="w-5 h-5 text-slate-500"/> Histórico de Eventos
              </h2>
              
              {maintenances.length === 0 ? (
                <div className="p-8 md:p-12 text-center text-slate-400 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Nenhum registro de manutenção encontrado.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {maintenances.map(maint => {
                    const drone = drones.find(d => d.id === maint.drone_id);
                    const pilot = pilots.find(p => p.id === maint.pilot_id);
                    const isCompleted = maint.status === 'completed';

                    return (
                      <Card key={maint.id} className={`p-4 border-l-4 hover:shadow-md transition-shadow ${isCompleted ? 'border-l-green-500 opacity-90' : 'border-l-amber-500 bg-amber-50/30'}`}>
                        <div className="flex flex-col sm:flex-row justify-between items-start mb-2 gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {isCompleted ? (
                                <Badge variant="success" className="flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Concluída
                                </Badge>
                            ) : (
                                <Badge variant="warning" className="flex items-center gap-1 animate-pulse">
                                    <Clock className="w-3 h-3" /> Pendente
                                </Badge>
                            )}
                            <Badge variant="default" className="border border-slate-200">
                              {maintenanceTypes[maint.maintenance_type]}
                            </Badge>
                            <span className="text-xs text-slate-500 flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded">
                              <Calendar className="w-3 h-3" /> {new Date(maint.maintenance_date).toLocaleDateString()}
                              <span className="mx-1">•</span>
                              <Clock className="w-3 h-3" /> {maint.maintenance_time}
                            </span>
                          </div>
                          {maint.in_flight_incident && (
                            <Badge variant="danger" className="flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Incidente em Voo
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3 mt-3">
                          <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Aeronave</p>
                            <p className="font-bold text-slate-900 text-sm truncate">{drone ? `${drone.prefix} - ${drone.model}` : 'Drone Removido'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Técnico / Responsável</p>
                            <p className="text-slate-900 text-sm truncate">{maint.technician}</p>
                          </div>
                          {pilot && (
                            <div className="sm:col-span-2">
                               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Piloto Solicitante / Relator</p>
                               <p className="text-slate-900 text-sm">{pilot.full_name}</p>
                            </div>
                          )}
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-700 mb-3 border border-slate-100 relative">
                          <p className="font-bold text-[10px] text-slate-500 mb-1 uppercase">Histórico / Descrição</p>
                          <p className="whitespace-pre-wrap">{maint.description}</p>
                        </div>

                        {maint.log_file_url && (
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-bold text-blue-700 uppercase">Log de Voo:</span>
                            <a href={maint.log_file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline font-medium break-all">
                              Baixar Telemetria (KMZ/KML)
                            </a>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}