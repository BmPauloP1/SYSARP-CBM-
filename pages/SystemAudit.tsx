
import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '../services/base44Client';
import { SystemAuditLog, Pilot } from '../types';
import { Card, Input, Select, Button, Badge } from '../components/ui_components';
import { Shield, Search, RefreshCw, User, Calendar, Activity, Filter, Database, Download } from 'lucide-react';

export default function SystemAudit() {
  const [logs, setLogs] = useState<SystemAuditLog[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterAction, setFilterAction] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsData, pilotsData] = await Promise.all([
        base44.entities.SystemAudit.list('-timestamp'),
        base44.entities.Pilot.list()
      ]);
      setLogs(logsData);
      setPilots(pilotsData);
    } catch (e) {
      console.error("Erro ao carregar auditoria:", e);
    } finally {
      setLoading(false);
    }
  };

  const getPilotName = (userId: string) => {
    const pilot = pilots.find(p => p.id === userId);
    return pilot ? pilot.full_name : userId === 'admin-local-id' ? 'Administrador Sistema' : 'Usuário Desconhecido';
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchAction = filterAction === 'all' || log.action === filterAction;
      const matchEntity = filterEntity === 'all' || log.entity === filterEntity;
      const matchUser = filterUser === 'all' || log.user_id === filterUser;
      
      let matchDate = true;
      if (dateStart) matchDate = matchDate && new Date(log.timestamp) >= new Date(dateStart);
      if (dateEnd) {
         const end = new Date(dateEnd);
         end.setDate(end.getDate() + 1);
         matchDate = matchDate && new Date(log.timestamp) < end;
      }

      return matchAction && matchEntity && matchUser && matchDate;
    });
  }, [logs, filterAction, filterEntity, filterUser, dateStart, dateEnd]);

  const handleExportPDF = async () => {
    setLoading(true);
    try {
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default || (jsPDFModule as any).jsPDF;
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default;

      const doc = new jsPDF();
      doc.text("Relatório de Auditoria do Sistema - SYSARP", 14, 15);
      doc.setFontSize(10);
      doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 22);

      const tableData = filteredLogs.map(log => [
         new Date(log.timestamp).toLocaleString(),
         getPilotName(log.user_id),
         log.action,
         log.entity,
         log.details
      ]);

      autoTable(doc, {
        startY: 30,
        head: [['Data/Hora', 'Usuário', 'Ação', 'Entidade', 'Detalhes']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [185, 28, 28] }
      });

      doc.save(`Auditoria_SYSARP_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) {
      console.error(e);
      alert("Erro ao exportar PDF.");
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch(action) {
      case 'LOGIN': return 'success';
      case 'LOGOUT': return 'default';
      case 'CREATE': return 'success';
      case 'UPDATE': return 'warning';
      case 'DELETE': return 'danger';
      default: return 'default';
    }
  };

  const uniqueEntities = Array.from(new Set(logs.map(l => l.entity)));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4">
         <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-800 rounded-lg text-white shadow-lg">
               <Shield className="w-6 h-6" />
            </div>
            <div>
               <h1 className="text-2xl font-bold text-slate-900">Auditoria do Sistema</h1>
               <p className="text-sm text-slate-500">Rastreamento de atividades e segurança.</p>
            </div>
         </div>
         <div className="flex gap-2">
            <Button onClick={loadData} variant="outline" className="h-10">
               <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
               Atualizar
            </Button>
            <Button onClick={handleExportPDF} className="h-10 bg-slate-900 hover:bg-black text-white">
               <Download className="w-4 h-4 mr-2" />
               Exportar PDF
            </Button>
         </div>
      </div>

      {/* Filters */}
      <Card className="p-4 bg-white shadow-sm border border-slate-200">
         <div className="flex items-center gap-2 mb-3 text-sm font-bold text-slate-700 uppercase">
            <Filter className="w-4 h-4" /> Filtros de Pesquisa
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-1">
               <Select label="Ação" value={filterAction} onChange={e => setFilterAction(e.target.value)} className="text-sm">
                  <option value="all">Todas</option>
                  <option value="LOGIN">Login</option>
                  <option value="LOGOUT">Logout</option>
                  <option value="CREATE">Criação</option>
                  <option value="UPDATE">Edição</option>
                  <option value="DELETE">Exclusão</option>
               </Select>
            </div>
            <div className="lg:col-span-1">
               <Select label="Entidade" value={filterEntity} onChange={e => setFilterEntity(e.target.value)} className="text-sm">
                  <option value="all">Todas</option>
                  {uniqueEntities.map(e => <option key={e} value={e}>{e}</option>)}
               </Select>
            </div>
             <div className="lg:col-span-1">
               <Select label="Usuário" value={filterUser} onChange={e => setFilterUser(e.target.value)} className="text-sm">
                  <option value="all">Todos</option>
                  {pilots.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
               </Select>
            </div>
            <div className="lg:col-span-2 grid grid-cols-2 gap-2">
               <Input label="De" type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="text-sm" />
               <Input label="Até" type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="text-sm" />
            </div>
         </div>
      </Card>

      {/* Logs Table */}
      <Card className="overflow-hidden shadow-md border-0">
         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
               <thead className="bg-slate-50 text-slate-500 uppercase text-xs border-b border-slate-200">
                  <tr>
                     <th className="px-6 py-4">Data/Hora</th>
                     <th className="px-6 py-4">Usuário</th>
                     <th className="px-6 py-4">Ação</th>
                     <th className="px-6 py-4">Alvo (Entidade)</th>
                     <th className="px-6 py-4">Detalhes</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredLogs.length > 0 ? (
                     filteredLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                           <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-mono text-xs">
                              {new Date(log.timestamp).toLocaleString()}
                           </td>
                           <td className="px-6 py-4">
                              <div className="flex items-center gap-2 font-medium text-slate-800">
                                 <User className="w-3.5 h-3.5 text-slate-400" />
                                 {getPilotName(log.user_id)}
                              </div>
                           </td>
                           <td className="px-6 py-4">
                              <Badge variant={getActionColor(log.action) as any}>
                                 {log.action}
                              </Badge>
                           </td>
                           <td className="px-6 py-4">
                              <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                                 <Database className="w-3.5 h-3.5 text-slate-400" />
                                 {log.entity}
                              </div>
                           </td>
                           <td className="px-6 py-4 text-slate-500 italic max-w-md truncate" title={log.details}>
                              {log.details}
                           </td>
                        </tr>
                     ))
                  ) : (
                     <tr>
                        <td colSpan={5} className="p-12 text-center text-slate-400">
                           <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
                           <p className="italic">Nenhum registro encontrado para os filtros selecionados.</p>
                        </td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
         <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex justify-between">
            <span>Mostrando {filteredLogs.length} registros</span>
            <span>Total no histórico: {logs.length}</span>
         </div>
      </Card>
    </div>
  );
}
