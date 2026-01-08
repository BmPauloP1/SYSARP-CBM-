import React, { useState, useEffect } from 'react';
import { operationSummerService } from '../services/operationSummerService';
import { base44 } from '../services/base44Client';
import { SummerFlight, SUMMER_LOCATIONS } from '../types_summer';
import { Pilot, Drone, MISSION_HIERARCHY, MissionType } from '../types';
import { Card, Badge, Button, Input, Select } from '../components/ui_components';
import { Sun, Clock, MapPin, User, Trash2, CheckSquare, Square, Pencil, X, Save } from 'lucide-react';

export default function OperationSummerFlights() {
  const [flights, setFlights] = useState<SummerFlight[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Pilot | null>(null);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState<SummerFlight | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<SummerFlight>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
        const [f, p, d, me] = await Promise.all([
        operationSummerService.list(),
        base44.entities.Pilot.list(),
        base44.entities.Drone.list(),
        base44.auth.me()
        ]);
        setFlights(f);
        setPilots(p.sort((a,b) => a.full_name.localeCompare(b.full_name)));
        setDrones(d);
        setCurrentUser(me);
    } catch (e: any) {
        if (e.message !== "Não autenticado" && !e.message?.includes("Failed to fetch")) {
           console.error("Erro ao carregar dados", e);
        }
    } finally {
        setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === flights.length && flights.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(flights.map(f => f.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    
    if (!currentUser || currentUser.role !== 'admin') {
      alert("Apenas administradores podem excluir registros.");
      return;
    }

    if (window.confirm(`Tem certeza que deseja excluir ${selectedIds.size} registro(s)?`)) {
      setLoading(true);
      try {
        await operationSummerService.delete(Array.from(selectedIds), currentUser.id);
        setSelectedIds(new Set());
        await loadData();
      } catch (e: any) {
        console.error("Delete failed:", e);
        const msg = e.message || 'Erro desconhecido.';
        alert(`Falha na exclusão: ${msg}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEdit = (flight: SummerFlight, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingFlight(flight);
      setEditFormData({ ...flight });
      setIsEditModalOpen(true);
  };

  const handleTimeChange = (field: 'start_time' | 'end_time', value: string) => {
      const newData = { ...editFormData, [field]: value };
      
      // Auto-calculate duration
      if (newData.start_time && newData.end_time) {
          const dummyDate = '2024-01-01';
          const start = new Date(`${dummyDate}T${newData.start_time}`);
          const end = new Date(`${dummyDate}T${newData.end_time}`);
          
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
              let diff = Math.round((end.getTime() - start.getTime()) / 60000);
              if (diff < 0) diff += 1440; // Handle day crossover
              newData.flight_duration = diff;
          }
      }
      setEditFormData(newData);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingFlight || !currentUser) return;
      
      setLoading(true);
      try {
          await operationSummerService.update(
              editingFlight.id, 
              editFormData, 
              currentUser.id
          );
          alert("Registro atualizado com sucesso!");
          setIsEditModalOpen(false);
          setEditingFlight(null);
          loadData();
      } catch (err: any) {
          alert(`Erro ao atualizar: ${err.message}`);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative">
      {/* Header Fixed */}
      <div className="flex-shrink-0 bg-white border-b border-orange-200 p-4 md:p-6 shadow-sm z-20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 md:p-3 bg-orange-100 rounded-full text-orange-600">
            <Sun className="w-6 h-6 md:w-8 md:h-8" />
          </div>
          <div>
            <h1 className="text-lg md:text-2xl font-bold text-slate-900 leading-tight">Diário de Voos - Op. Verão</h1>
            <p className="text-xs md:text-sm text-slate-500">Registro automático via Centro de Comando.</p>
          </div>
        </div>
        
        {/* Admin Actions */}
        {currentUser?.role === 'admin' && (
          <div className="flex items-center gap-2 w-full md:w-auto">
             {selectedIds.size > 0 ? (
               <Button 
                 onClick={handleDeleteSelected} 
                 className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white shadow-md text-sm h-10 flex items-center justify-center gap-2"
               >
                 <Trash2 className="w-4 h-4" />
                 Excluir ({selectedIds.size})
               </Button>
             ) : (
                <div className="hidden md:block text-xs text-slate-400 italic">
                    Selecione registros para opções
                </div>
             )}
          </div>
        )}
      </div>

      {/* Content Area - Flex 1 with overflow hidden to contain the internal scroll */}
      <div className="flex-1 overflow-hidden p-2 md:p-6 flex flex-col min-h-0">
        <Card className="flex-1 flex flex-col overflow-hidden shadow-md border-0 bg-white w-full">
          {/* List Header */}
          <div className="flex-shrink-0 p-3 md:p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center z-10">
            <div className="flex items-center gap-3">
               {currentUser?.role === 'admin' && (
                 <button 
                    onClick={toggleSelectAll} 
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 px-3 py-1.5 rounded text-xs font-bold shadow-sm transition-colors"
                    title={selectedIds.size === flights.length ? "Desmarcar Todos" : "Selecionar Todos"}
                 >
                    {selectedIds.size === flights.length && flights.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">Selecionar Todos</span>
                 </button>
               )}
               <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm md:text-base ml-2">
                 <Clock className="w-4 h-4 text-slate-500" /> 
                 <span className="hidden sm:inline">Últimos Registros</span>
                 <Badge className="bg-orange-100 text-orange-800 border-orange-200">{flights.length}</Badge>
               </h3>
            </div>
            {selectedIds.size > 0 && <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100">{selectedIds.size} marcado(s)</span>}
          </div>
          
          {/* Scrollable List Container */}
          <div className="flex-1 overflow-auto bg-slate-50/50 w-full relative">
            {loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-20">
                   <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-2"></div>
                   <span className="text-slate-500 text-xs uppercase font-bold">Carregando dados...</span>
                </div>
            ) : (
                <>
                  {/* DESKTOP TABLE VIEW (> 768px) */}
                  <div className="hidden md:block min-w-full inline-block align-middle">
                    <table className="min-w-full text-sm text-left">
                      <thead className="bg-slate-100 text-slate-500 uppercase text-xs sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="px-4 py-3 w-12 text-center bg-slate-100"></th>
                          <th className="px-4 py-3 bg-slate-100">Data</th>
                          <th className="px-4 py-3 bg-slate-100">Local</th>
                          <th className="px-4 py-3 bg-slate-100">Missão</th>
                          <th className="px-4 py-3 bg-slate-100">Piloto / Drone</th>
                          <th className="px-4 py-3 bg-slate-100">Duração</th>
                          <th className="px-4 py-3 bg-slate-100">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {flights.map(f => {
                          const pilot = pilots.find(p => p.id === f.pilot_id);
                          const drone = drones.find(d => d.id === f.drone_id);
                          const isSelected = selectedIds.has(f.id);
                          
                          return (
                            <tr key={f.id} className={`hover:bg-orange-50/50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>
                              <td className="px-4 py-3 text-center">
                                 {currentUser?.role === 'admin' && (
                                   <button onClick={() => toggleSelect(f.id)} className="text-slate-400 hover:text-blue-600 align-middle">
                                      {isSelected ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5" />}
                                   </button>
                                 )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="font-bold text-slate-700">{new Date(f.date + 'T12:00:00').toLocaleDateString()}</div>
                                <div className="text-xs text-slate-500">{f.start_time} - {f.end_time}</div>
                              </td>
                              <td className="px-4 py-3 font-medium text-orange-700 whitespace-nowrap max-w-[180px] truncate" title={f.location}>{f.location}</td>
                              <td className="px-4 py-3">
                                <Badge variant="default" className="whitespace-nowrap">{MISSION_HIERARCHY[f.mission_type as MissionType]?.label || f.mission_type}</Badge>
                              </td>
                              <td className="px-4 py-3 text-xs whitespace-nowrap">
                                <div className="font-bold text-slate-800">{pilot?.full_name || 'N/A'}</div>
                                <div className="text-slate-400">{drone?.prefix || 'N/A'}</div>
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-600 font-bold">{f.flight_duration} min</td>
                              <td className="px-4 py-3">
                                {currentUser?.role === 'admin' && (
                                    <button 
                                        onClick={(e) => handleEdit(f, e)} 
                                        className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                                        title="Editar Registro"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {flights.length === 0 && (
                          <tr><td colSpan={7} className="p-8 text-center text-slate-400 italic">Nenhum voo registrado.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* MOBILE CARD VIEW (< 768px) */}
                  <div className="md:hidden p-2 space-y-3 pb-8">
                     {flights.length === 0 && (
                        <div className="p-8 text-center text-slate-400 italic bg-white rounded-lg border border-slate-200">
                           Nenhum voo registrado.
                        </div>
                     )}
                     {flights.map(f => {
                        const pilot = pilots.find(p => p.id === f.pilot_id);
                        const drone = drones.find(d => d.id === f.drone_id);
                        const isSelected = selectedIds.has(f.id);

                        return (
                           <div 
                             key={f.id} 
                             className={`bg-white border rounded-xl p-4 shadow-sm flex flex-col gap-3 transition-all relative overflow-hidden
                               ${isSelected ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200'}
                             `}
                             onClick={() => currentUser?.role === 'admin' && toggleSelect(f.id)}
                           >
                              {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500"></div>}

                              <div className="flex justify-between items-start">
                                 <div className="flex flex-col">
                                    <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                                       <Clock className="w-3.5 h-3.5 text-orange-500" />
                                       {new Date(f.date + 'T12:00:00').toLocaleDateString()}
                                    </div>
                                    <span className="text-xs text-slate-400 ml-5">{f.start_time} - {f.end_time}</span>
                                 </div>
                                 
                                 <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono font-bold bg-slate-100 px-2 py-1 rounded text-slate-600 border border-slate-200">
                                       {f.flight_duration} min
                                    </span>
                                    {currentUser?.role === 'admin' && (
                                       <div className={isSelected ? "text-blue-600" : "text-slate-300"}>
                                          {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                       </div>
                                    )}
                                 </div>
                              </div>

                              <div className="flex items-center gap-2 bg-orange-50 p-2 rounded-lg border border-orange-100">
                                 <MapPin className="w-4 h-4 text-orange-600 shrink-0" />
                                 <span className="text-sm font-bold text-orange-900 leading-tight truncate">{f.location}</span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                 <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Missão</span>
                                    <span className="text-slate-700 font-medium">{MISSION_HIERARCHY[f.mission_type as MissionType]?.label}</span>
                                 </div>
                                 <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Aeronave</span>
                                    <span className="text-slate-700 font-medium">{drone?.prefix || 'N/A'}</span>
                                 </div>
                              </div>

                              <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-100">
                                 <div className="flex items-center gap-2">
                                     <User className="w-3 h-3" />
                                     <span className="font-semibold">{pilot?.full_name || 'Piloto N/A'}</span>
                                 </div>
                                 {currentUser?.role === 'admin' && (
                                     <button 
                                        onClick={(e) => handleEdit(f, e)} 
                                        className="p-2 bg-blue-50 text-blue-600 rounded-full border border-blue-100 hover:bg-blue-100"
                                     >
                                         <Pencil className="w-4 h-4" />
                                     </button>
                                 )}
                              </div>
                           </div>
                        );
                     })}
                  </div>
                </>
            )}
          </div>
        </Card>
      </div>

      {/* EDIT MODAL */}
      {isEditModalOpen && editingFlight && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
              <Card className="w-full max-w-lg bg-white shadow-2xl p-6">
                  <div className="flex justify-between items-center mb-6 border-b pb-3">
                      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                          <Pencil className="w-5 h-5 text-blue-600" /> Editar Registro de Voo
                      </h2>
                      <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <form onSubmit={handleSaveEdit} className="space-y-4">
                      
                      <div className="grid grid-cols-2 gap-4">
                          <Input 
                              label="Data" 
                              type="date" 
                              value={editFormData.date} 
                              onChange={e => setEditFormData({...editFormData, date: e.target.value})} 
                              required 
                          />
                          <Select 
                              label="Localidade Base" 
                              value={Object.keys(SUMMER_LOCATIONS).find(key => editFormData.location?.includes(key)) ? editFormData.location : 'Outro'}
                              onChange={e => setEditFormData({...editFormData, location: e.target.value === 'Outro' ? '' : e.target.value})}
                          >
                              {Object.keys(SUMMER_LOCATIONS).map(city => <option key={city} value={city}>{city}</option>)}
                              <option value="Outro">Outro / Manual</option>
                          </Select>
                      </div>

                      <Input 
                          label="Local Específico" 
                          value={editFormData.location} 
                          onChange={e => setEditFormData({...editFormData, location: e.target.value})} 
                          required 
                      />

                      <div className="grid grid-cols-2 gap-4">
                          <Select 
                              label="Piloto" 
                              value={editFormData.pilot_id} 
                              onChange={e => setEditFormData({...editFormData, pilot_id: e.target.value})} 
                              required
                          >
                              {pilots.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                          </Select>
                          <Select 
                              label="Aeronave" 
                              value={editFormData.drone_id} 
                              onChange={e => setEditFormData({...editFormData, drone_id: e.target.value})} 
                              required
                          >
                              {drones.map(d => <option key={d.id} value={d.id}>{d.prefix}</option>)}
                          </Select>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-3 gap-3">
                          <Input 
                              label="Início" 
                              type="time" 
                              value={editFormData.start_time} 
                              onChange={e => handleTimeChange('start_time', e.target.value)} 
                              required 
                          />
                          <Input 
                              label="Término" 
                              type="time" 
                              value={editFormData.end_time} 
                              onChange={e => handleTimeChange('end_time', e.target.value)} 
                              required 
                          />
                          <div className="bg-white p-1 rounded border border-slate-200">
                              <label className="text-xs font-bold text-slate-500 block mb-1">Duração (min)</label>
                              <input 
                                  type="number" 
                                  className="w-full font-mono font-bold text-lg text-center outline-none text-blue-600"
                                  value={editFormData.flight_duration} 
                                  onChange={e => setEditFormData({...editFormData, flight_duration: Number(e.target.value)})}
                              />
                          </div>
                      </div>

                      <div>
                          <label className="text-sm font-medium text-slate-700 mb-1 block">Natureza da Missão</label>
                          <select 
                              className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white"
                              value={editFormData.mission_type} 
                              onChange={e => setEditFormData({...editFormData, mission_type: e.target.value as any})}
                          >
                              {Object.entries(MISSION_HIERARCHY).map(([key, val]) => (
                                  <option key={key} value={key}>{val.label}</option>
                              ))}
                          </select>
                      </div>

                      <div>
                          <label className="text-sm font-medium text-slate-700 mb-1 block">Observações</label>
                          <textarea 
                              className="w-full p-2 border border-slate-300 rounded-lg text-sm h-20 resize-none"
                              value={editFormData.notes || ''}
                              onChange={e => setEditFormData({...editFormData, notes: e.target.value})}
                          />
                      </div>

                      <div className="flex justify-end gap-3 pt-2">
                          <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
                          <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                              <Save className="w-4 h-4 mr-2" /> Salvar Alterações
                          </Button>
                      </div>
                  </form>
              </Card>
          </div>
      )}
    </div>
  );
}