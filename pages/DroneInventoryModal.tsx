import React, { useState, useEffect } from 'react';
import { inventoryService } from '../services/inventoryService';
import { base44 } from '../services/base44Client';
import { Material, MaterialType, BatteryStats, PropellerStats, MaterialLog } from '../types_inventory';
import { Drone } from '../types';
import { Card, Button, Input, Select, Badge } from '../components/ui_components';
import { X, Battery, Fan, Box, Plus, Trash2, History, AlertTriangle, CheckCircle, Activity, Save, Camera, Plug, Minus, Gamepad2, Pencil, Download, FileText, Search, Loader2 } from 'lucide-react';
// FIX: Removed static imports for jspdf and jspdf-autotable to use dynamic imports, consistent with other files.
// This resolves a TypeScript type inference issue causing the error.

interface DroneInventoryModalProps {
  drone: Drone;
  drones: Drone[];
  onClose: () => void;
}

export default function DroneInventoryModal({ drone, drones, onClose }: DroneInventoryModalProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<MaterialType>('battery');
  
  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Material | null>(null);
  const [isBatchMode, setIsBatchMode] = useState(false);

  const [newItem, setNewItem] = useState<Partial<Material>>({
    type: 'battery',
    status: 'new',
    name: '',
    quantity: 1
  });
  const [newStats, setNewStats] = useState<any>({});

  // Duplicate Scan State
  const [isScanning, setIsScanning] = useState(false);
  const [duplicates, setDuplicates] = useState<Record<string, Material[]> | null>(null);

  // History Modal State
  const [historyItem, setHistoryItem] = useState<Material | null>(null);
  const [historyLogs, setHistoryLogs] = useState<MaterialLog[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  useEffect(() => {
    loadMaterials();
    inventoryService.getAllMaterials().then(setAllMaterials);
  }, [drone.id]);

  const loadMaterials = async () => {
    setLoading(true);
    const data = await inventoryService.getMaterialsByDrone(drone.id);
    setMaterials(data);
    setLoading(false);
  };

  const resetForm = () => {
    setShowAddForm(false);
    setEditingItem(null);
    setNewItem({ status: 'new', name: '', quantity: 1, type: activeTab });
    setNewStats({});
    setIsBatchMode(false);
  };

  const handleScanDuplicates = () => {
    setIsScanning(true);
    
    // Filtra todos os materiais do sistema que possuem um número de série
    const itemsWithSerial = allMaterials.filter(m => m.serial_number && m.serial_number.trim() !== '');
    
    // Agrupa os itens por número de série
    const serialMap: Record<string, Material[]> = {};
    itemsWithSerial.forEach(item => {
      const sn = item.serial_number!;
      if (!serialMap[sn]) {
        serialMap[sn] = [];
      }
      serialMap[sn].push(item);
    });
    
    // Filtra para encontrar apenas os seriais que aparecem mais de uma vez
    const foundDuplicates: Record<string, Material[]> = {};
    for (const sn in serialMap) {
      if (serialMap[sn].length > 1) {
        foundDuplicates[sn] = serialMap[sn];
      }
    }
  
    setDuplicates(foundDuplicates);
    setIsScanning(false);
  };

  const handleBatchModeToggle = () => {
    if (!editingItem) {
        setIsBatchMode(prev => {
            setNewItem(currentItem => ({
                ...currentItem,
                serial_number: '',
                quantity: 1
            }));
            return !prev;
        });
    }
  };

  const handleSerialNumberBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (!value.trim()) return;

    if (isBatchMode) {
        // No editing in batch mode, so no need to check editingItem.id
        const serialsToCheck = new Set(
            value.split(/[\n,;]+/)
                 .map(s => s.trim())
                 .filter(s => s.length > 0)
        );

        if (serialsToCheck.size === 0) return;

        const duplicates = allMaterials.filter(m => 
            m.serial_number && serialsToCheck.has(m.serial_number)
        );
        
        if (duplicates.length > 0) {
            const duplicatesInfo = duplicates.map(d => `${d.serial_number} (Item: ${d.name})`).join('\n- ');
            alert(`Atenção: O(s) seguinte(s) número(s) de série já está(ão) cadastrado(s) no sistema:\n\n- ${duplicatesInfo}`);
        }

    } else {
        const serialToCheck = value.trim();
        // Check if a different item already has this serial number.
        const found = allMaterials.find(m => m.serial_number === serialToCheck && m.id !== editingItem?.id);
        
        if (found) {
            alert(`Atenção: O número de série "${serialToCheck}" já está cadastrado para o item "${found.name}".`);
        }
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setNewItem({ ...newItem, name });

    if (!editingItem) {
        const trimmedName = name.trim().toLowerCase();
        
        if (!trimmedName) {
            setNewStats({});
            return;
        }

        const existing = allMaterials.find(m => m.name.trim().toLowerCase() === trimmedName && m.type === activeTab);
        
        if (existing) {
          if (activeTab === 'battery' && existing.battery_stats) {
            setNewStats({
              capacity_mah: existing.battery_stats.capacity_mah,
              max_cycles: existing.battery_stats.max_cycles,
              cycles: 0,
              health_percent: 100
            });
          } else if (activeTab === 'propeller' && existing.propeller_stats) {
            setNewStats({
              size_inch: existing.propeller_stats.size_inch,
              max_hours: existing.propeller_stats.max_hours,
              hours_flown: 0
            });
          } else {
            setNewStats({});
          }
        } else {
          setNewStats({});
        }
    }
  };

  const handleStartEdit = (mat: Material) => {
    setEditingItem(mat);
    setIsBatchMode(false); // Can't batch edit
    setNewItem({
      name: mat.name,
      serial_number: mat.serial_number,
      quantity: mat.quantity,
      status: mat.status,
      purchase_date: mat.purchase_date,
      notes: mat.notes,
      type: mat.type,
    });
    if (mat.battery_stats) setNewStats(mat.battery_stats);
    else if (mat.propeller_stats) setNewStats(mat.propeller_stats);
    else setNewStats({});
    setShowAddForm(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingItem) {
        await inventoryService.updateMaterial(editingItem.id, { ...newItem, drone_id: drone.id }, newStats);
        await inventoryService.logAction(editingItem.id, 'update', 'Item editado.');
        alert("Item atualizado com sucesso!");
      } else if (isBatchMode) {
        const serialsRaw = newItem.serial_number || '';
        const serials = serialsRaw.split(/[\n,;]+/)
                                .map(s => s.trim())
                                .filter(s => s.length > 0);
        
        if (serials.length === 0) {
            alert("Por favor, insira pelo menos um número de série para o modo em lote.");
            return;
        }

        const createPromises = serials.map(serial => {
            const singleItemPayload = {
                ...newItem,
                drone_id: drone.id,
                type: activeTab,
                serial_number: serial,
                quantity: 1, // Each item with a serial has quantity of 1
            };
            return inventoryService.addMaterial(singleItemPayload, newStats);
        });

        await Promise.all(createPromises);
        alert(`${serials.length} iten(s) adicionados com sucesso!`);
      } else {
        await inventoryService.addMaterial({ ...newItem, drone_id: drone.id, type: activeTab }, newStats);
        alert("Item adicionado com sucesso!");
      }
      resetForm();
      loadMaterials();
    } catch (e) {
      alert("Erro ao salvar item(s). Verifique se todos os campos obrigatórios estão preenchidos.");
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };
  
  const getTabLabel = (type: MaterialType) => {
      switch(type) {
          case 'battery': return 'Baterias';
          case 'propeller': return 'Hélices';
          case 'controller': return 'Controles / RCs';
          case 'payload': return 'Cargas Pagas';
          case 'accessory': return 'Acessórios';
          default: return 'Peças';
      }
  };

  const handleDownloadReport = async () => {
    setIsReportLoading(true);
    try {
        const jsPDFModule = await import('jspdf');
        const jsPDF = jsPDFModule.default || (jsPDFModule as any).jsPDF;
        const autoTableModule = await import('jspdf-autotable');
        const autoTable = autoTableModule.default;
        
        const droneItems = materials; 

        const doc = new jsPDF();
        doc.text(`Relatório de Almoxarifado - ${drone.prefix}`, 14, 15);
        doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 14, 22);

        const grouped = droneItems.reduce<Record<MaterialType, Material[]>>((acc, item) => {
            const key = item.type;
            if (!acc[key]) {
              acc[key] = [];
            }
            acc[key].push(item);
            return acc;
        }, {} as Record<MaterialType, Material[]>);

        let startY = 30;

        // FIX: Using Object.entries provides better type inference for 'items' inside the loop.
        const sortedEntries = Object.entries(grouped).sort(([typeA], [typeB]) => typeA.localeCompare(typeB));
        for (const [type, items] of sortedEntries) {
            if (!items || items.length === 0) continue;

            if (startY > 250) {
                doc.addPage();
                startY = 20;
            }

            doc.setFontSize(12);
            doc.text(getTabLabel(type as MaterialType), 14, startY);
            startY += 2;

            // FIX: Use the correctly typed `items` variable.
            const tableBody = items.map(item => [
                item.name,
                item.quantity,
                item.serial_number || '-'
            ]);

            autoTable(doc, {
                startY,
                head: [['Item', 'Qtd.', 'Serial (SN)']],
                body: tableBody,
                theme: 'grid',
                headStyles: { fillColor: [15, 23, 42] }
            });

            startY = (doc as any).lastAutoTable.finalY + 12;
        }

        doc.save(`Relatorio_Almoxarifado_${drone.prefix.replace(/\s/g, '_')}.pdf`);
    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        alert("Falha ao gerar relatório.");
    } finally {
        setIsReportLoading(false);
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

  const handleShowHistory = async (mat: Material) => {
    setHistoryItem(mat);
    setIsHistoryLoading(true);
    try {
      const logs = await inventoryService.getLogs(mat.id);
      setHistoryLogs(logs);
    } catch (e) {
      console.error("Failed to load history", e);
      setHistoryLogs([]);
    } finally {
      setIsHistoryLoading(false);
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

  return (
    <div className="fixed inset-0 bg-black/70 z-[3000] flex items-center justify-center p-4">
      {/* DUPLICATE SCAN MODAL */}
      {duplicates !== null && (
        <div className="fixed inset-0 bg-black/60 z-[4000] flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl bg-white shadow-xl animate-fade-in">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-600" />
                Resultado da Verificação
              </h3>
              <button onClick={() => setDuplicates(null)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {Object.keys(duplicates).length === 0 ? (
                <div className="text-center p-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="font-semibold text-green-700">Nenhuma duplicidade encontrada!</p>
                  <p className="text-sm text-slate-500">Todos os números de série no sistema são únicos.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-sm text-red-800 flex items-start gap-3">
                     <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
                     <div>
                        <p className="font-bold">Atenção!</p>
                        <p>Foram encontrados os seguintes números de série duplicados no inventário:</p>
                     </div>
                  </div>
                  {Object.entries(duplicates).map(([serial, items]) => (
                    <div key={serial} className="border border-slate-200 rounded-lg p-3">
                      <p className="font-mono text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full inline-block mb-2">
                        SN: {serial}
                      </p>
                      <ul className="space-y-2 text-sm">
                        {items.map(item => {
                          const droneOwner = drones.find(d => d.id === item.drone_id);
                          return (
                            <li key={item.id} className="flex items-center gap-3 bg-slate-50 p-2 rounded">
                               <Box className="w-4 h-4 text-slate-500 shrink-0"/>
                               <div>
                                  <span className="font-semibold text-slate-800">{item.name}</span>
                                  <span className="text-xs text-slate-500 block">
                                    Alocado em: <strong className="text-slate-600">{droneOwner?.prefix || 'Desconhecido'}</strong>
                                  </span>
                               </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-end">
                <Button onClick={() => setDuplicates(null)}>Fechar</Button>
            </div>
          </Card>
        </div>
      )}

      {/* HISTORY MODAL */}
      {historyItem && (
        <div className="fixed inset-0 bg-black/60 z-[4000] flex items-center justify-center p-4">
           <Card className="w-full max-w-lg bg-white shadow-xl animate-fade-in">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                 <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <History className="w-5 h-5 text-blue-600" />
                    Histórico do Item
                 </h3>
                 <button onClick={() => setHistoryItem(null)} className="p-1 hover:bg-slate-100 rounded">
                    <X className="w-5 h-5 text-slate-500" />
                 </button>
              </div>
              <div className="p-4 bg-slate-50 border-b">
                <p className="text-sm font-bold text-slate-900">{historyItem.name}</p>
                <p className="text-xs text-slate-500 font-mono">SN: {historyItem.serial_number || 'N/A'}</p>
              </div>
              <div className="p-4 max-h-[50vh] overflow-y-auto">
                 {isHistoryLoading ? <p>Carregando histórico...</p> : 
                  historyLogs.length === 0 ? <p className="text-sm text-slate-500 italic">Nenhum registro encontrado.</p> :
                  (
                    <ul className="space-y-3">
                       {historyLogs.map(log => (
                         <li key={log.id} className="flex items-start gap-3 text-sm">
                            <div className="mt-1 w-4 h-4 flex items-center justify-center">
                               {log.action === 'create' ? <Plus className="w-3 h-3 text-green-500"/> : 
                                log.action === 'usage' ? <Activity className="w-3 h-3 text-blue-500"/> : 
                                <Pencil className="w-3 h-3 text-amber-500"/>}
                            </div>
                            <div className="flex-1">
                               <p className="text-slate-700">{log.details}</p>
                               <p className="text-xs text-slate-400">{new Date(log.created_at).toLocaleString()}</p>
                            </div>
                         </li>
                       ))}
                    </ul>
                  )
                 }
              </div>
              <div className="p-4 bg-slate-50 border-t flex justify-end">
                 <Button onClick={() => setHistoryItem(null)}>Fechar</Button>
              </div>
           </Card>
        </div>
      )}

      <Card className="w-full max-w-5xl h-[90vh] flex flex-col bg-white overflow-hidden animate-fade-in shadow-2xl">
        {/* Header */}
        <div className="bg-slate-900 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center shrink-0 text-white gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg">
               <Box className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-none">Almoxarifado Técnico</h2>
              <p className="text-xs text-slate-400 mt-1">{drone.prefix} - {drone.model}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button size="sm" onClick={handleScanDuplicates} disabled={isScanning} variant="outline" className="bg-white/10 text-white hover:bg-white/20 border-white/20 flex-1 sm:flex-none">
                {isScanning ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Search className="w-4 h-4 mr-1"/>}
                {isScanning ? 'Verificando...' : 'Verificar Duplicados'}
            </Button>
            <Button size="sm" onClick={handleDownloadReport} disabled={isReportLoading} variant="outline" className="bg-white/10 text-white hover:bg-white/20 border-white/20 flex-1 sm:flex-none">
                <Download className="w-4 h-4 mr-1"/>
                {isReportLoading ? 'Gerando...' : 'Exportar PDF'}
            </Button>
            <button onClick={onClose} className="hover:bg-white/10 p-2 rounded"><X className="w-6 h-6"/></button>
          </div>
        </div>

        {/* Responsive Body */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          
          {/* Responsive Sidebar/Tabs */}
          <div className="w-full md:w-52 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 flex flex-row md:flex-col p-2 gap-2 overflow-x-auto md:overflow-y-auto shrink-0 custom-scrollbar">
             <button onClick={() => { setActiveTab('battery'); resetForm(); }} className={`flex-shrink-0 flex items-center gap-2 p-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'battery' ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Battery className="w-4 h-4"/> Baterias
             </button>
             <button onClick={() => { setActiveTab('propeller'); resetForm(); }} className={`flex-shrink-0 flex items-center gap-2 p-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'propeller' ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Fan className="w-4 h-4"/> Hélices
             </button>
             <button onClick={() => { setActiveTab('controller'); resetForm(); }} className={`flex-shrink-0 flex items-center gap-2 p-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'controller' ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Gamepad2 className="w-4 h-4"/> Controles
             </button>
             <button onClick={() => { setActiveTab('payload'); resetForm(); }} className={`flex-shrink-0 flex items-center gap-2 p-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'payload' ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Camera className="w-4 h-4"/> Payloads
             </button>
             <button onClick={() => { setActiveTab('accessory'); resetForm(); }} className={`flex-shrink-0 flex items-center gap-2 p-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'accessory' ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Plug className="w-4 h-4"/> Acessórios
             </button>
             <button onClick={() => { setActiveTab('component'); resetForm(); }} className={`flex-shrink-0 flex items-center gap-2 p-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'component' ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Box className="w-4 h-4"/> Peças
             </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col p-3 md:p-4 overflow-hidden bg-white">
             
             {/* Toolbar */}
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 shrink-0">
                <h3 className="text-lg font-bold text-slate-800">{getTabLabel(activeTab)}</h3>
                {!showAddForm && (
                    <Button size="sm" onClick={() => setShowAddForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm w-full sm:w-auto">
                       <Plus className="w-4 h-4 mr-1"/> Adicionar Item
                    </Button>
                )}
             </div>

             {/* Add/Edit Form */}
             {showAddForm && (
                <div className="mb-4 p-4 bg-slate-50 border border-blue-200 rounded-xl animate-fade-in shrink-0 shadow-inner">
                   <h4 className="text-sm font-bold text-blue-800 mb-3 uppercase flex items-center gap-2">
                      {editingItem ? <Pencil className="w-4 h-4"/> : <Plus className="w-4 h-4"/>}
                      {editingItem ? `Editando Item: ${editingItem.name}` : `Novo Item em ${getTabLabel(activeTab)}`}
                   </h4>
                   
                   {!editingItem && (
                     <div className="col-span-full mb-3 border-t border-b border-slate-200 py-2">
                         <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
                             <input 
                                 type="checkbox"
                                 checked={isBatchMode}
                                 onChange={handleBatchModeToggle}
                                 className="w-4 h-4 accent-blue-600"
                                 disabled={!!editingItem}
                             />
                             Adicionar em Lote (múltiplos números de série)
                         </label>
                     </div>
                   )}
                   
                   <form onSubmit={handleAddSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div className={isBatchMode ? "sm:col-span-4" : "sm:col-span-2"}>
                         <Input label="Nome / Modelo" required placeholder="Ex: Bateria TB30..." value={newItem.name || ''} onChange={handleNameChange} />
                         <datalist id="material-names">
                           {Array.from(new Set(allMaterials.filter(m => m.type === activeTab).map(m => m.name))).map(name => (
                             <option key={name} value={name} />
                           ))}
                         </datalist>
                      </div>
                      
                      {isBatchMode ? (
                          <div className="sm:col-span-4">
                              <label className="text-sm font-medium text-slate-700">Números de Série</label>
                              <textarea 
                                  placeholder="Cole os seriais, um por linha ou separados por vírgula/ponto e vírgula"
                                  className="w-full p-2 border border-slate-300 rounded-lg text-sm h-24 bg-white"
                                  value={newItem.serial_number || ''} 
                                  onChange={e => setNewItem({...newItem, serial_number: e.target.value})}
                                  onBlur={handleSerialNumberBlur}
                              />
                          </div>
                      ) : (
                          <>
                              <Input 
                                label="Serial (SN)" 
                                placeholder="Opcional" 
                                value={newItem.serial_number || ''} 
                                onChange={e => setNewItem({...newItem, serial_number: e.target.value})}
                                onBlur={handleSerialNumberBlur}
                              />
                              <Input label="Quantidade" type="number" required min="1" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})} />
                          </>
                      )}
                      
                      <Select label="Status" value={newItem.status} onChange={e => setNewItem({...newItem, status: e.target.value as any})}>
                         <option value="new">Novo</option>
                         <option value="active">Em Uso</option>
                         <option value="maintenance">Manutenção</option>
                         <option value="retired">Baixado</option>
                      </Select>
                      
                      {activeTab === 'battery' && (
                         <>
                           <Input label="Capacidade (mAh)" type="number" required value={newStats.capacity_mah || ''} onChange={e => setNewStats({...newStats, capacity_mah: Number(e.target.value)})} />
                           <Input label="Ciclos Atuais" type="number" required value={newStats.cycles || 0} onChange={e => setNewStats({...newStats, cycles: Number(e.target.value)})} />
                           <Input label="Vida Útil (Ciclos)" type="number" required value={newStats.max_cycles || 200} onChange={e => setNewStats({...newStats, max_cycles: Number(e.target.value)})} />
                         </>
                      )}
                      {activeTab === 'propeller' && (
                         <>
                           <Input label="Tamanho/Modelo" placeholder='Ex: 21"' value={newStats.size_inch || ''} onChange={e => setNewStats({...newStats, size_inch: e.target.value})} />
                           <Input label="Posição (CW/CCW)" placeholder="Ex: Front Left" value={newStats.position || ''} onChange={e => setNewStats({...newStats, position: e.target.value})} />
                           <Input label="Vida Útil (Horas)" type="number" value={newStats.max_hours || 100} onChange={e => setNewStats({...newStats, max_hours: Number(e.target.value)})} />
                         </>
                      )}
                      <div className="col-span-1 sm:col-span-2 md:col-span-4 flex justify-end gap-2 mt-2 pt-2 border-t border-slate-200">
                         <Button type="button" variant="outline" size="sm" onClick={resetForm}>Cancelar</Button>
                         <Button type="submit" size="sm" disabled={isSaving} className="bg-green-600 text-white hover:bg-green-700"><Save className="w-4 h-4 mr-1"/> {isSaving ? 'Salvando...' : (editingItem ? 'Atualizar Item' : 'Salvar no Estoque')}</Button>
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
                      <div className="flex items-center gap-3 w-full lg:w-auto lg:min-w-[200px]">
                         <div className={`p-3 rounded-full shrink-0 ${mat.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                            {React.createElement({battery: Battery, propeller: Fan, controller: Gamepad2, payload: Camera, accessory: Plug, component: Box}[activeTab] || Box, {className: "w-6 h-6"})}
                         </div>
                         <div>
                            <h4 className="font-bold text-slate-800 text-sm truncate">{mat.name}</h4>
                            <p className="text-xs text-slate-500 font-mono truncate">SN: {mat.serial_number || 'N/A'}</p>
                         </div>
                      </div>
                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
                         <div className="flex flex-col items-center justify-center bg-slate-50 rounded p-1 border border-slate-100">
                            <span className="text-[9px] text-slate-400 uppercase font-bold">Qtd.</span>
                            <div className="flex items-center gap-2">
                               {['propeller', 'accessory', 'component'].includes(mat.type) && <button onClick={() => handleQuantityChange(mat, -1)} className="text-slate-400 hover:text-red-500"><Minus className="w-3 h-3"/></button>}
                               <span className="font-bold text-slate-700 text-sm">{mat.quantity}</span>
                               {['propeller', 'accessory', 'component'].includes(mat.type) && <button onClick={() => handleQuantityChange(mat, 1)} className="text-slate-400 hover:text-green-500"><Plus className="w-3 h-3"/></button>}
                            </div>
                         </div>
                         <div className="flex flex-col items-center justify-center">{renderHealthBadge(mat)}</div>
                         {mat.type === 'battery' && mat.battery_stats ? (
                            <>
                              <div className="flex flex-col items-center justify-center"><span className="text-[9px] text-slate-400 uppercase font-bold">Ciclos</span><span className="font-bold text-slate-700 text-sm">{mat.battery_stats.cycles} / {mat.battery_stats.max_cycles}</span></div>
                              <div className="flex flex-col items-center justify-center"><span className="text-[9px] text-slate-400 uppercase font-bold">Saúde</span><span className={`font-bold text-sm ${mat.battery_stats.health_percent < 80 ? 'text-red-600' : 'text-green-600'}`}>{mat.battery_stats.health_percent}%</span></div>
                            </>
                         ) : mat.type === 'propeller' && mat.propeller_stats ? (
                            <>
                              <div className="flex flex-col items-center justify-center"><span className="text-[9px] text-slate-400 uppercase font-bold">Horas</span><span className="font-bold text-slate-700 text-sm">{mat.propeller_stats.hours_flown.toFixed(1)}h</span></div>
                              <div className="flex flex-col items-center justify-center"><span className="text-[9px] text-slate-400 uppercase font-bold">Vida Útil</span><span className="font-bold text-slate-700 text-sm">{mat.propeller_stats.max_hours}h</span></div>
                            </>
                         ) : <div className="col-span-2 flex items-center justify-center text-xs text-slate-400 italic">Sem métricas</div>}
                      </div>
                      <div className="flex gap-2 justify-end w-full lg:w-auto border-t lg:border-t-0 border-slate-100 pt-2 lg:pt-0">
                         <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => handleShowHistory(mat)} title="Ver Histórico"><History className="w-4 h-4"/></Button>
                         {(mat.type === 'battery' || mat.type === 'propeller') && <Button size="sm" variant="outline" className="h-8 text-xs bg-slate-50 w-full lg:w-auto" onClick={() => handleRegisterCycle(mat)}><Activity className="w-3 h-3 mr-1"/>{mat.type === 'battery' ? '+ Ciclo' : '+ Hora'}</Button>}
                         <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => handleStartEdit(mat)}><Pencil className="w-4 h-4"/></Button>
                         <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 border-red-100" onClick={() => handleDelete(mat.id)}><Trash2 className="w-4 h-4"/></Button>
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
