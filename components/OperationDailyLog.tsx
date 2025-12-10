
import React, { useState, useEffect } from "react";
import { base44 } from "../services/base44Client";
import { Operation, OperationDay, Pilot, Drone, FlightLog, OperationDayAsset, OperationDayPilot } from "../types";
import { Card, Button, Input, Select, Badge } from "../components/ui_components";
import { Calendar, Plus, CloudRain, Users, Plane, Clock, Trash2, ChevronDown, ChevronUp, FileText, CheckSquare, Save, Edit3, X, Activity, Database, Copy, AlertTriangle } from "lucide-react";

interface OperationDailyLogProps {
  operationId: string;
  pilots: Pilot[];
  drones: Drone[];
  currentUser: Pilot | null;
}

export default function OperationDailyLog({ operationId, pilots, drones, currentUser }: OperationDailyLogProps) {
  const [days, setDays] = useState<OperationDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null);
  
  // State for new items
  const [newDayDate, setNewDayDate] = useState(new Date().toISOString().split('T')[0]);
  const [newDayResp, setNewDayResp] = useState("");
  const [newDayWeather, setNewDayWeather] = useState("");
  
  // Edit State
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [editDayData, setEditDayData] = useState<{ date: string, responsible_pilot_id: string, weather_summary: string }>({ date: '', responsible_pilot_id: '', weather_summary: '' });

  // State for day details
  const [currentAssets, setCurrentAssets] = useState<OperationDayAsset[]>([]);
  const [currentPilots, setCurrentPilots] = useState<OperationDayPilot[]>([]);
  
  // State for Day Actions Text
  const [dayNotes, setDayNotes] = useState("");
  
  // Forms
  const [selectedAsset, setSelectedAsset] = useState("");
  const [selectedPilot, setSelectedPilot] = useState("");
  const [selectedRole, setSelectedRole] = useState("pic");

  // SQL Error for RLS issues
  const [sqlError, setSqlError] = useState<string | null>(null);

  useEffect(() => {
    loadDays();
  }, [operationId]);

  const loadDays = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.OperationDay.filter({ operation_id: operationId });
      // Sort by date desc
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setDays(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadDayDetails = async (day: OperationDay) => {
    try {
      const [assets, dayPilots] = await Promise.all([
        base44.entities.OperationDayAsset.filter({ operation_day_id: day.id }),
        base44.entities.OperationDayPilot.filter({ operation_day_id: day.id })
      ]);
      setCurrentAssets(assets);
      setCurrentPilots(dayPilots);
      setDayNotes(day.progress_notes || "");
    } catch (e) {
      console.error(e);
    }
  };

  const toggleDay = (day: OperationDay) => {
    if (expandedDayId === day.id) {
      setExpandedDayId(null);
    } else {
      setExpandedDayId(day.id);
      loadDayDetails(day);
    }
  };

  const handleAddDay = async () => {
    if (!newDayResp) { alert("Selecione o piloto responsável pelo dia."); return; }
    
    try {
      await base44.entities.OperationDay.create({
        operation_id: operationId,
        date: newDayDate,
        responsible_pilot_id: newDayResp,
        weather_summary: newDayWeather,
        progress_notes: "",
        status: 'open'
      } as any);
      loadDays();
      alert("Novo dia adicionado ao diário!");
    } catch (e) {
      console.error(e);
      alert("Erro ao criar dia.");
    }
  };

  const handleStartEditDay = (e: React.MouseEvent, day: OperationDay) => {
      e.stopPropagation();
      setEditingDayId(day.id);
      setEditDayData({
          date: day.date,
          responsible_pilot_id: day.responsible_pilot_id,
          weather_summary: day.weather_summary
      });
  };

  const handleSaveEditDay = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if(!editingDayId) return;
      try {
          await base44.entities.OperationDay.update(editingDayId, editDayData);
          setEditingDayId(null);
          loadDays();
          alert("Dados do dia atualizados.");
      } catch(e) {
          console.error(e);
      }
  };

  const handleDeleteDay = async (e: React.MouseEvent, dayId: string) => {
      e.stopPropagation();
      if(confirm("Tem certeza que deseja excluir este dia e todos os registros associados?")) {
          try {
              await base44.entities.OperationDay.delete(dayId);
              loadDays();
          } catch(e) {
              console.error(e);
              alert("Erro ao excluir dia.");
          }
      }
  };

  const handleAddAsset = async (dayId: string) => {
    if (!selectedAsset) return;
    try {
      // 1. Criar vinculo no dia
      await base44.entities.OperationDayAsset.create({
        operation_day_id: dayId,
        drone_id: selectedAsset,
        status: 'active'
      } as any);

      // 2. Automação: Colocar drone em status 'in_operation' globalmente
      try {
        await base44.entities.Drone.update(selectedAsset, { status: 'in_operation' });
      } catch (updateErr: any) {
        console.error("Falha ao atualizar status da aeronave:", updateErr);
        // Se falhar por permissão (RLS), mostrar SQL fix SOMENTE SE ADMIN
        if (updateErr.message && (updateErr.message.includes("policy") || updateErr.message.includes("permission"))) {
           if (currentUser?.role === 'admin') {
               setSqlError(`
-- Permissão para atualizar status do drone durante operação
DROP POLICY IF EXISTS "Pilotos podem atualizar status de drones" ON public.drones;
CREATE POLICY "Pilotos podem atualizar status de drones"
ON public.drones FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
               `);
           }
           alert("Aeronave vinculada, mas o status global não pôde ser atualizado. Notifique o administrador.");
        }
      }

      // Refresh local assets
      const assets = await base44.entities.OperationDayAsset.filter({ operation_day_id: dayId });
      setCurrentAssets(assets);
      setSelectedAsset("");
      
      alert("Aeronave vinculada com sucesso! Status atualizado para 'Em Operação' na gestão de frota.");
    } catch (e) { 
        console.error("Erro ao adicionar aeronave:", e); 
        alert("Erro ao adicionar aeronave. Verifique a conexão.");
    }
  };

  const handleAddPilot = async (dayId: string) => {
    if (!selectedPilot) return;
    try {
      await base44.entities.OperationDayPilot.create({
        operation_day_id: dayId,
        pilot_id: selectedPilot,
        role: selectedRole
      } as any);
      // Refresh local pilots
      const dayPilots = await base44.entities.OperationDayPilot.filter({ operation_day_id: dayId });
      setCurrentPilots(dayPilots);
      setSelectedPilot("");
    } catch (e) { console.error(e); }
  };

  const handleUpdateDayNotes = async (dayId: string) => {
      try {
          await base44.entities.OperationDay.update(dayId, { progress_notes: dayNotes });
          // MENSAGEM CLARA: NÃO LIBERA DRONE
          alert("Informações atualizadas com sucesso.\n\nNOTA: O dia permanece ABERTO e as aeronaves 'EM OPERAÇÃO'. Para liberar os drones, utilize o botão 'Encerrar Dia'.");
      } catch(e) {
          console.error(e);
          alert("Erro ao atualizar descrição.");
      }
  };

  const handleCloseDay = async (dayId: string) => {
      // CONFIRMAÇÃO EXPLÍCITA SOBRE LIBERAÇÃO DE DRONES
      if(!confirm("CONFIRMAÇÃO DE ENCERRAMENTO:\n\nAo encerrar o dia, o sistema tentará liberar todas as aeronaves para 'DISPONÍVEL'.\n\nDeseja continuar?")) return;
      
      setLoading(true);
      try {
          // 1. Buscar aeronaves vinculadas a este dia para liberá-las
          console.log(`Buscando ativos para liberar no dia ${dayId}...`);
          const assetsToRelease = await base44.entities.OperationDayAsset.filter({ operation_day_id: dayId });
          
          let releasedCount = 0;
          let errorsCount = 0;
          
          // Usar loop sequencial para garantir tratamento de erro individual e capturar erro de permissão
          for (const asset of assetsToRelease) {
              try {
                  await base44.entities.Drone.update(asset.drone_id, { status: 'available' });
                  releasedCount++;
                  console.log(`Drone ${asset.drone_id} liberado.`);
              } catch (droneErr: any) {
                  console.error(`Falha ao liberar drone ${asset.drone_id}`, droneErr);
                  errorsCount++;
                  
                  // Se for erro de permissão, INTERROMPE TUDO e mostra o fix
                  if (droneErr.message && (droneErr.message.includes("policy") || droneErr.message.includes("permission"))) {
                      if (currentUser?.role === 'admin') {
                          setSqlError(`
-- CORREÇÃO DE PERMISSÃO (RLS) PARA ATUALIZAR STATUS DO DRONE
DROP POLICY IF EXISTS "Enable update for users based on email" ON "public"."drones";
CREATE POLICY "Enable update for users based on email"
ON "public"."drones"
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
                          `);
                          alert("ERRO DE PERMISSÃO: O sistema foi bloqueado pelo banco de dados ao tentar liberar a aeronave. Execute o código SQL exibido (Admin) e tente novamente.");
                          setLoading(false);
                          return; // Sai da função sem fechar o dia
                      } else {
                          alert("ERRO DE PERMISSÃO: Você não tem permissão para alterar o status da aeronave. Contate o administrador.");
                          setLoading(false);
                          return;
                      }
                  }
              }
          }

          if (errorsCount > 0) {
              if(!confirm(`ATENÇÃO: ${errorsCount} aeronave(s) NÃO puderam ser liberadas automaticamente devido a erros de conexão ou permissão.\n\nDeseja forçar o encerramento do dia mesmo assim? (As aeronaves continuarão 'Em Operação' até ajuste manual).`)) {
                  setLoading(false);
                  return;
              }
          }

          // 2. Encerrar o dia SOMENTE se passou pelos erros ou confirmou força bruta
          await base44.entities.OperationDay.update(dayId, { status: 'closed' });
          
          alert(`Dia encerrado com sucesso!\n${releasedCount} aeronave(s) liberada(s) para novas missões.`);
          setExpandedDayId(null); 
          
          // Forçar recarregamento completo para garantir UI atualizada
          await loadDays(); 
      } catch(e) {
          console.error(e);
          alert("Erro crítico ao encerrar dia. Verifique sua conexão e tente novamente.");
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

  return (
    <div className="space-y-6 relative">
      
      {/* SQL FIX MODAL INSIDE COMPONENT - Only for Admin */}
      {sqlError && currentUser?.role === 'admin' && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in">
           <Card className="w-full max-w-3xl flex flex-col bg-white border-4 border-red-600 shadow-2xl">
              <div className="p-4 bg-red-600 text-white flex justify-between items-center">
                 <h3 className="font-bold text-lg flex items-center gap-2"><Database className="w-6 h-6" /> Correção de Permissões Necessária</h3>
                 <button onClick={() => setSqlError(null)} className="hover:bg-red-700 p-1 rounded"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                 <p className="text-slate-700 font-medium">O sistema não conseguiu atualizar o status da aeronave. Isso geralmente ocorre devido a restrições de segurança do Banco de Dados (RLS).</p>
                 <div className="relative"><pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto font-mono border border-slate-700 max-h-64">{sqlError}</pre>
                 <button onClick={copySqlToClipboard} className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white p-2 rounded"><Copy className="w-4 h-4" /></button></div>
                 <p className="text-xs text-red-600 font-bold">Instrução: Copie o código acima e execute no "SQL Editor" do painel Supabase.</p>
              </div>
              <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
                 <Button variant="outline" onClick={() => setSqlError(null)}>Fechar</Button>
                 <Button onClick={copySqlToClipboard} className="bg-blue-600 text-white hover:bg-blue-700"><Copy className="w-4 h-4 mr-2" /> Copiar SQL</Button>
              </div>
           </Card>
        </div>
      )}

      <div className="flex justify-between items-center">
         <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Diário de Bordo (Multidias)
         </h3>
      </div>

      <Card className="p-4 bg-blue-50 border-blue-200">
         <h4 className="text-sm font-bold text-blue-900 mb-3 uppercase">Registrar Novo Dia</h4>
         <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
               <label className="text-xs font-bold text-slate-500">Data</label>
               <input type="date" className="w-full p-2 rounded border border-slate-300 text-sm" value={newDayDate} onChange={e => setNewDayDate(e.target.value)} />
            </div>
            <div className="md:col-span-2">
               <Select label="Responsável do Dia" value={newDayResp} onChange={e => setNewDayResp(e.target.value)} labelClassName="text-xs font-bold text-slate-500">
                  <option value="">Selecione...</option>
                  {pilots.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
               </Select>
            </div>
            <div>
               <Input label="Clima Geral" placeholder="Ex: Sol, Vento 10kt" value={newDayWeather} onChange={e => setNewDayWeather(e.target.value)} labelClassName="text-xs font-bold text-slate-500" />
            </div>
            <div className="md:col-span-4 mt-2">
               <Button onClick={handleAddDay} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="w-4 h-4 mr-2" /> Iniciar Dia Operacional
               </Button>
            </div>
         </div>
      </Card>

      <div className="space-y-4">
         {days.length === 0 && <p className="text-center text-slate-400 italic py-4">Nenhum dia registrado nesta operação.</p>}
         
         {days.map(day => {
            // FIX: Append time to prevent timezone shift (browser interprets "YYYY-MM-DD" as UTC midnight)
            const displayDate = new Date(day.date + 'T12:00:00').toLocaleDateString();
            
            return (
            <div key={day.id} className={`border rounded-lg bg-white overflow-hidden shadow-sm ${day.status === 'closed' ? 'border-green-200 bg-green-50/30' : 'border-slate-200'}`}>
               
               {/* DAY HEADER */}
               <div 
                  className="p-4 bg-slate-50 flex flex-col md:flex-row justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors gap-3"
                  onClick={() => toggleDay(day)}
               >
                  {editingDayId === day.id ? (
                      // EDIT MODE
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2 w-full" onClick={e => e.stopPropagation()}>
                          <input type="date" className="p-1 border rounded text-sm" value={editDayData.date} onChange={e => setEditDayData({...editDayData, date: e.target.value})} />
                          <select className="p-1 border rounded text-sm" value={editDayData.responsible_pilot_id} onChange={e => setEditDayData({...editDayData, responsible_pilot_id: e.target.value})}>
                              {pilots.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                          </select>
                          <div className="flex gap-2">
                              <input className="p-1 border rounded text-sm flex-1" placeholder="Clima" value={editDayData.weather_summary} onChange={e => setEditDayData({...editDayData, weather_summary: e.target.value})} />
                              <Button size="sm" onClick={handleSaveEditDay} className="bg-green-600 text-white"><Save className="w-4 h-4"/></Button>
                              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setEditingDayId(null); }}><X className="w-4 h-4"/></Button>
                          </div>
                      </div>
                  ) : (
                      // VIEW MODE
                      <>
                        <div className="flex items-center gap-4 flex-1">
                            <div className={`text-white p-2 rounded-lg shrink-0 ${day.status === 'closed' ? 'bg-green-600' : 'bg-blue-600'}`}>
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                    {displayDate}
                                    {day.status === 'closed' && <Badge variant="success">Fechado</Badge>}
                                </h4>
                                <p className="text-xs text-slate-500">Resp: {pilots.find(p => p.id === day.responsible_pilot_id)?.full_name}</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <span className="text-xs bg-white border px-2 py-1 rounded text-slate-600 flex items-center gap-1">
                                <CloudRain className="w-3 h-3" /> {day.weather_summary}
                            </span>
                            
                            {/* Action Buttons (Updated Design) */}
                            <div className="flex gap-2 mr-2" onClick={e => e.stopPropagation()}>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-8 w-8 p-0 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all shadow-sm" 
                                    onClick={(e) => handleStartEditDay(e, day)}
                                    title="Editar informações do dia"
                                >
                                    <Edit3 className="w-4 h-4" />
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-8 w-8 p-0 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-all shadow-sm" 
                                    onClick={(e) => handleDeleteDay(e, day.id)}
                                    title="Excluir dia"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>

                            {expandedDayId === day.id ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                        </div>
                      </>
                  )}
               </div>

               {expandedDayId === day.id && (
                  <div className="p-4 border-t border-slate-200 bg-white animate-fade-in space-y-6">
                     
                     {/* RESOURCES GRID */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* ASSETS */}
                        <div className="space-y-3">
                           <h5 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 border-b pb-1">
                              <Plane className="w-3 h-3" /> Aeronaves do Dia
                           </h5>
                           <div className="flex gap-2">
                              <Select value={selectedAsset} onChange={e => setSelectedAsset(e.target.value)} className="text-xs">
                                 <option value="">Adicionar Drone...</option>
                                 {drones.map(d => <option key={d.id} value={d.id}>{d.prefix} - {d.model}</option>)}
                              </Select>
                              <Button size="sm" onClick={() => handleAddAsset(day.id)} className="bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200">
                                 <Plus className="w-3 h-3" />
                              </Button>
                           </div>
                           <div className="space-y-1">
                              {currentAssets.map(a => (
                                 <div key={a.id} className="flex justify-between items-center text-sm bg-slate-50 p-2 rounded">
                                    <span>{drones.find(d => d.id === a.drone_id)?.prefix}</span>
                                    <Badge variant="success">Em Operação</Badge>
                                 </div>
                              ))}
                              {currentAssets.length === 0 && <span className="text-xs text-slate-400 italic">Nenhuma aeronave alocada.</span>}
                           </div>
                        </div>

                        {/* PILOTS */}
                        <div className="space-y-3">
                           <h5 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 border-b pb-1">
                              <Users className="w-3 h-3" /> Equipe do Dia
                           </h5>
                           <div className="flex gap-2">
                              <Select value={selectedPilot} onChange={e => setSelectedPilot(e.target.value)} className="text-xs">
                                 <option value="">Adicionar Piloto...</option>
                                 {pilots.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                              </Select>
                              <Select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} className="text-xs w-24">
                                 <option value="pic">PIC</option>
                                 <option value="obs">OBS</option>
                              </Select>
                              <Button size="sm" onClick={() => handleAddPilot(day.id)} className="bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200">
                                 <Plus className="w-3 h-3" />
                              </Button>
                           </div>
                           <div className="space-y-1">
                              {currentPilots.map(p => (
                                 <div key={p.id} className="flex justify-between items-center text-sm bg-slate-50 p-2 rounded">
                                    <span>{pilots.find(x => x.id === p.pilot_id)?.full_name}</span>
                                    <span className="text-xs font-mono bg-white px-1 rounded border">{p.role.toUpperCase()}</span>
                                 </div>
                              ))}
                              {currentPilots.length === 0 && <span className="text-xs text-slate-400 italic">Nenhum piloto alocado.</span>}
                           </div>
                        </div>
                     </div>

                     {/* ACTIONS / DESCRIPTION */}
                     <div className="space-y-3 pt-2">
                        <h5 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 border-b pb-1">
                           <Activity className="w-3 h-3" /> Ações Realizadas / Descrição
                        </h5>
                        <textarea 
                            className="w-full h-32 p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            placeholder="Descreva as atividades, voos e acontecimentos deste dia..."
                            value={dayNotes}
                            onChange={e => setDayNotes(e.target.value)}
                        />
                        
                        <div className="flex justify-end gap-3 pt-2">
                            <Button 
                                onClick={() => handleUpdateDayNotes(day.id)} 
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9"
                            >
                                <Save className="w-3 h-3 mr-2" /> Atualizar Informações
                            </Button>
                            {day.status !== 'closed' && (
                                <Button 
                                    onClick={() => handleCloseDay(day.id)} 
                                    disabled={loading}
                                    className="bg-slate-800 hover:bg-black text-white text-xs h-9"
                                >
                                    <CheckSquare className={`w-3 h-3 mr-2 ${loading ? 'animate-spin' : ''}`} /> 
                                    {loading ? 'Processando...' : 'Encerrar Dia e Liberar Drones'}
                                </Button>
                            )}
                        </div>
                        {day.status !== 'closed' && (
                            <div className="text-[10px] text-right text-slate-400 italic">
                                * O botão "Atualizar" apenas salva o texto. Use "Encerrar" para liberar os drones.
                            </div>
                        )}
                     </div>

                  </div>
               )}
            </div>
         )})}
      </div>
    </div>
  );
}
