
import React, { useState, useEffect } from 'react';
import { inventoryService } from '../services/inventoryService';
import { Material, MaterialType, BatteryStats, PropellerStats } from '../types_inventory';
import { Drone } from '../types';
import { Card, Button, Input, Select, Badge } from '../components/ui_components';
import { X, Battery, Fan, Box, Plus, Trash2, History, AlertTriangle, CheckCircle, Activity, Save, Camera, Plug, Minus } from 'lucide-react';

interface DroneInventoryModalProps {
  drone: Drone;
  onClose: () => void;
}

export default function DroneInventoryModal({ drone, onClose }: DroneInventoryModalProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<MaterialType>('battery');
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const [newItem, setNewItem] = useState<Partial<Material>>({
    type: 'battery',
    status: 'new',
    name: '',
    quantity: 1
  });
  const [newStats, setNewStats] = useState<any>({});

  useEffect(() => {
    loadMaterials();
  }, [drone.id]);

  const loadMaterials = async () => {
    setLoading(true);
    const data = await inventoryService.getMaterialsByDrone(drone.id);
    setMaterials(data);
    setLoading(false);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inventoryService.addMaterial(
        { ...newItem, drone_id: drone.id, type: activeTab },
        newStats
      );
      setShowAddForm(false);
      // Reset form
      setNewItem({ status: 'new', name: '', quantity: 1 });
      setNewStats({});
      loadMaterials();
    } catch (e) {
      alert("Erro ao adicionar item.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja remover este item do inventário?")) {
      await inventoryService.deleteMaterial(id);
      loadMaterials();
    }
  };

  const handleQuantityChange = async (mat: Material, delta: number) => {
     await inventoryService.adjustQuantity(mat, delta);
     loadMaterials();
  };

  const handleRegisterCycle = async (mat: Material) => {
    const amount = prompt(mat.type === 'battery' ? "Quantos ciclos adicionar?" : "Quantas horas adicionar?");
    if (amount && !isNaN(Number(amount))) {
      await inventoryService.registerUsage(mat.id, mat.type, Number(amount), "Registro Manual");
      loadMaterials();
    }
  };

  const renderHealthBadge = (mat: Material) => {
    const { status, message } = inventoryService.calculateHealthStatus(mat);
    const colors = {
      'OK': 'bg-green-100 text-green-700',
      'WARNING': 'bg-yellow-100 text-yellow-800',
      'CRITICAL': 'bg-red-100 text-red-700'
    };
    return (
      <span className={`text-[10px] px-2 py-1 rounded font-bold flex items-center gap-1 ${colors[status]}`}>
        {status === 'OK' ? <CheckCircle className="w-3 h-3"/> : <AlertTriangle className="w-3 h-3"/>}
        {message}
      </span>
    );
  };

  const filteredMaterials = materials.filter(m => m.type === activeTab);

  const getTabLabel = (type: MaterialType) => {
      switch(type) {
          case 'battery': return 'Baterias';
          case 'propeller': return 'Hélices';
          case 'payload': return 'Cargas Pagas';
          case 'accessory': return 'Acessórios';
          default: return 'Componentes';
      }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[3000] flex items-center justify-center p-4">
      <Card className="w-full max-w-5xl h-[90vh] flex flex-col bg-white overflow-hidden animate-fade-in shadow-2xl">
        
        {/* Header */}
        <div className="bg-slate-900 p-4 flex justify-between items-center shrink-0 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg">
               <Box className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-none">Almoxarifado Técnico</h2>
              <p className="text-xs text-slate-400 mt-1">{drone.prefix} - {drone.model}</p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 p-1 rounded"><X className="w-6 h-6"/></button>
        </div>

        {/* Responsive Body */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          
          {/* Responsive Sidebar/Tabs */}
          <div className="w-full md:w-52 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 flex flex-row md:flex-col p-2 gap-2 overflow-x-auto md:overflow-y-auto shrink-0 custom-scrollbar">
             <button onClick={() => { setActiveTab('battery'); setShowAddForm(false); }} className={`flex-shrink-0 flex items-center gap-2 p-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'battery' ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Battery className="w-4 h-4"/> Baterias
             </button>
             <button onClick={() => { setActiveTab('propeller'); setShowAddForm(false); }} className={`flex-shrink-0 flex items-center gap-2 p-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'propeller' ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Fan className="w-4 h-4"/> Hélices
             </button>
             <button onClick={() => { setActiveTab('payload'); setShowAddForm(false); }} className={`flex-shrink-0 flex items-center gap-2 p-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'payload' ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Camera className="w-4 h-4"/> Payloads
             </button>
             <button onClick={() => { setActiveTab('accessory'); setShowAddForm(false); }} className={`flex-shrink-0 flex items-center gap-2 p-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'accessory' ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Plug className="w-4 h-4"/> Acessórios
             </button>
             <button onClick={() => { setActiveTab('component'); setShowAddForm(false); }} className={`flex-shrink-0 flex items-center gap-2 p-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'component' ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Box className="w-4 h-4"/> Peças
             </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col p-3 md:p-4 overflow-hidden bg-white">
             
             {/* Toolbar */}
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 shrink-0">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                   {activeTab === 'battery' && 'Gestão de Baterias (TB30/Lipo)'}
                   {activeTab === 'propeller' && 'Gestão de Hélices'}
                   {activeTab === 'payload' && 'Câmeras e Sensores'}
                   {activeTab === 'accessory' && 'Cabos, Cases e Acessórios'}
                   {activeTab === 'component' && 'Peças de Reposição'}
                </h3>
                <Button size="sm" onClick={() => setShowAddForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm w-full sm:w-auto">
                   <Plus className="w-4 h-4 mr-1"/> Adicionar Item
                </Button>
             </div>

             {/* Add Form */}
             {showAddForm && (
                <div className="mb-4 p-4 bg-slate-50 border border-blue-200 rounded-xl animate-fade-in shrink-0 shadow-inner">
                   <h4 className="text-sm font-bold text-blue-800 mb-3 uppercase flex items-center gap-2">
                      <Plus className="w-4 h-4"/> Novo Item em {getTabLabel(activeTab)}
                   </h4>
                   <form onSubmit={handleAddSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="sm:col-span-2">
                         <Input label="Nome / Modelo" required placeholder="Ex: Bateria TB30 ou Câmera H20T" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
                      </div>
                      
                      <div className="sm:col-span-1">
                         <Input label="Serial (SN)" placeholder="Opcional" value={newItem.serial_number || ''} onChange={e => setNewItem({...newItem, serial_number: e.target.value})} />
                      </div>

                      <div className="sm:col-span-1">
                         <Input 
                            label="Quantidade" 
                            type="number" 
                            required 
                            min="1"
                            value={newItem.quantity} 
                            onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})} 
                         />
                      </div>
                      
                      <div className="sm:col-span-1">
                         <Select label="Status Inicial" value={newItem.status} onChange={e => setNewItem({...newItem, status: e.target.value as any})}>
                            <option value="new">Novo</option>
                            <option value="active">Em Uso</option>
                            <option value="maintenance">Manutenção</option>
                         </Select>
                      </div>

                      {/* Battery Specifics */}
                      {activeTab === 'battery' && (
                         <>
                           <div className="sm:col-span-1"><Input label="Capacidade (mAh)" type="number" required value={newStats.capacity_mah || ''} onChange={e => setNewStats({...newStats, capacity_mah: Number(e.target.value)})} /></div>
                           <div className="sm:col-span-1"><Input label="Ciclos Atuais" type="number" required value={newStats.cycles || 0} onChange={e => setNewStats({...newStats, cycles: Number(e.target.value)})} /></div>
                           <div className="sm:col-span-1"><Input label="Vida Útil (Max Ciclos)" type="number" required value={newStats.max_cycles || 200} onChange={e => setNewStats({...newStats, max_cycles: Number(e.target.value)})} /></div>
                         </>
                      )}

                      {/* Propeller Specifics */}
                      {activeTab === 'propeller' && (
                         <>
                           <div className="sm:col-span-1"><Input label="Tamanho/Modelo" placeholder='Ex: 21"' value={newStats.size_inch || ''} onChange={e => setNewStats({...newStats, size_inch: e.target.value})} /></div>
                           <div className="sm:col-span-1"><Input label="Posição (CW/CCW)" placeholder="Ex: Front Left" value={newStats.position || ''} onChange={e => setNewStats({...newStats, position: e.target.value})} /></div>
                           <div className="sm:col-span-1"><Input label="Vida Útil (Max Horas)" type="number" value={newStats.max_hours || 100} onChange={e => setNewStats({...newStats, max_hours: Number(e.target.value)})} /></div>
                         </>
                      )}

                      <div className="col-span-1 sm:col-span-2 md:col-span-4 flex justify-end gap-2 mt-2 pt-2 border-t border-slate-200">
                         <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(false)}>Cancelar</Button>
                         <Button type="submit" size="sm" className="bg-green-600 text-white hover:bg-green-700"><Save className="w-4 h-4 mr-1"/> Salvar no Estoque</Button>
                      </div>
                   </form>
                </div>
             )}

             {/* List */}
             <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {loading ? <div className="text-center p-8 text-slate-400">Carregando estoque...</div> : 
                 filteredMaterials.length === 0 ? <div className="text-center p-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed">Nenhum item cadastrado nesta categoria.</div> :
                 filteredMaterials.map(mat => (
                   <div key={mat.id} className="border border-slate-200 rounded-lg p-3 hover:shadow-md transition-shadow bg-white flex flex-col lg:flex-row gap-4 items-start lg:items-center">
                      
                      {/* Icon & Qty */}
                      <div className="flex items-center gap-3 w-full lg:w-auto lg:min-w-[200px]">
                         <div className={`p-3 rounded-full shrink-0 ${mat.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                            {activeTab === 'battery' ? <Battery className="w-6 h-6"/> : 
                             activeTab === 'propeller' ? <Fan className="w-6 h-6"/> : 
                             activeTab === 'payload' ? <Camera className="w-6 h-6"/> :
                             activeTab === 'accessory' ? <Plug className="w-6 h-6"/> :
                             <Box className="w-6 h-6"/>}
                         </div>
                         <div className="min-w-0">
                            <h4 className="font-bold text-slate-800 text-sm truncate">{mat.name}</h4>
                            <p className="text-xs text-slate-500 font-mono truncate">SN: {mat.serial_number || 'N/A'}</p>
                         </div>
                      </div>

                      {/* Stats & Status */}
                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
                         
                         {/* Quantidade Control */}
                         <div className="flex flex-col items-center justify-center bg-slate-50 rounded p-1 border border-slate-100">
                            <span className="text-[9px] text-slate-400 uppercase font-bold">Qtd.</span>
                            <div className="flex items-center gap-2">
                               {['propeller', 'accessory', 'component'].includes(mat.type) && (
                                  <button onClick={() => handleQuantityChange(mat, -1)} className="text-slate-400 hover:text-red-500"><Minus className="w-3 h-3"/></button>
                               )}
                               <span className="font-bold text-slate-700 text-sm">{mat.quantity}</span>
                               {['propeller', 'accessory', 'component'].includes(mat.type) && (
                                  <button onClick={() => handleQuantityChange(mat, 1)} className="text-slate-400 hover:text-green-500"><Plus className="w-3 h-3"/></button>
                               )}
                            </div>
                         </div>

                         <div className="flex flex-col items-center justify-center">
                            <span className="text-[9px] text-slate-400 uppercase font-bold">Status</span>
                            {renderHealthBadge(mat)}
                         </div>

                         {/* Specific Stats */}
                         {mat.type === 'battery' && mat.battery_stats ? (
                            <>
                              <div className="flex flex-col items-center justify-center">
                                 <span className="text-[9px] text-slate-400 uppercase font-bold">Ciclos</span>
                                 <span className="font-bold text-slate-700 text-sm">{mat.battery_stats.cycles} / {mat.battery_stats.max_cycles}</span>
                              </div>
                              <div className="flex flex-col items-center justify-center">
                                 <span className="text-[9px] text-slate-400 uppercase font-bold">Saúde</span>
                                 <span className={`font-bold text-sm ${mat.battery_stats.health_percent < 80 ? 'text-red-600' : 'text-green-600'}`}>
                                    {mat.battery_stats.health_percent}%
                                 </span>
                              </div>
                            </>
                         ) : mat.type === 'propeller' && mat.propeller_stats ? (
                            <>
                              <div className="flex flex-col items-center justify-center">
                                 <span className="text-[9px] text-slate-400 uppercase font-bold">Horas</span>
                                 <span className="font-bold text-slate-700 text-sm">{mat.propeller_stats.hours_flown.toFixed(1)}h</span>
                              </div>
                              <div className="flex flex-col items-center justify-center">
                                 <span className="text-[9px] text-slate-400 uppercase font-bold">Vida Útil</span>
                                 <span className="font-bold text-slate-700 text-sm">{mat.propeller_stats.max_hours}h</span>
                              </div>
                            </>
                         ) : (
                            <div className="col-span-2 flex items-center justify-center text-xs text-slate-400 italic">
                               Sem métricas avançadas
                            </div>
                         )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 justify-end w-full lg:w-auto border-t lg:border-t-0 border-slate-100 pt-2 lg:pt-0">
                         {(mat.type === 'battery' || mat.type === 'propeller') && (
                            <Button size="sm" variant="outline" className="h-8 text-xs bg-slate-50 w-full lg:w-auto" onClick={() => handleRegisterCycle(mat)}>
                               <Activity className="w-3 h-3 mr-1"/> 
                               {mat.type === 'battery' ? '+ Ciclo' : '+ Hora'}
                            </Button>
                         )}
                         <Button size="sm" variant="outline" className="h-8 text-xs text-red-600 hover:bg-red-50 border-red-100" onClick={() => handleDelete(mat.id)}>
                            <Trash2 className="w-3 h-3"/>
                         </Button>
                      </div>
                   </div>
                 ))
                }
             </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
