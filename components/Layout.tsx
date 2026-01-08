
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Wrench, 
  FileText, 
  Sun, 
  Shield, 
  LogOut, 
  Menu, 
  X, 
  Radio, 
  Activity, 
  ChevronDown,
  ChevronRight,
  BarChart3,
  Map as MapIcon,
  Database
} from 'lucide-react';
import { base44 } from '../services/base44Client';
import { Pilot, SYSARP_LOGO } from '../types';
import { DroneIcon } from './ui_components';

interface LayoutProps {
  children?: React.ReactNode;
}

interface NavItem {
  title: string;
  url?: string;
  icon?: any;
  adminOnly?: boolean;
  badgeCount?: number;
  subItems?: NavItem[];
}

export default function Layout({ children }: LayoutProps) {
  const [user, setUser] = useState<Pilot | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [pendingPilots, setPendingPilots] = useState(0);
  
  // Estado para controlar quais menus estão expandidos
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    'OPERAÇÕES': true, // Padrão aberto
    'RELATÓRIOS': true
  });

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(me => {
        setUser(me);
        if (me.role === 'admin') {
            base44.entities.Pilot.list().then(pils => {
                const count = pils.filter(p => p.status === 'pending').length;
                setPendingPilots(count);
            });
        }
    }).catch(() => navigate('/login'));
  }, [navigate, location.pathname]);

  const handleLogout = async () => {
    await base44.auth.logout();
    navigate('/login');
  };

  const toggleMenu = (title: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  // Definição da Nova Estrutura de Menu
  const navigationItems: NavItem[] = [
    { title: "DASHBOARD", url: "/", icon: LayoutDashboard, adminOnly: false },
    { 
      title: "PILOTOS", 
      url: "/pilots", 
      icon: Users, 
      adminOnly: false,
      badgeCount: user?.role === 'admin' ? pendingPilots : 0
    },
    { 
      title: "AERONAVES", 
      icon: DroneIcon,
      adminOnly: false,
      subItems: [
        { title: "GESTÃO DE FROTA", url: "/drones", icon: DroneIcon },
        { title: "MANUTENÇÃO", url: "/maintenance", icon: Wrench },
        { title: "CAUTELAS", url: "/cautela", icon: Shield }
      ]
    },
    { 
      title: "OPERAÇÕES", 
      icon: Radio, 
      adminOnly: false,
      subItems: [
        { title: "CRIAR OPERAÇÕES", url: "/operations", adminOnly: false },
        { title: "PLANO DE VOO", url: "/flight-plan", adminOnly: false },
        { title: "A.R.O.", url: "/aro", adminOnly: false },
      ]
    },
    { title: "TRANSMISSÃO", url: "/transmissions", icon: Activity, adminOnly: false },
    
    // Novo Grupo Unificado de Relatórios
    {
      title: "RELATÓRIOS",
      icon: FileText,
      adminOnly: false,
      subItems: [
        { title: "REL. GERAL", url: "/reports", icon: BarChart3, adminOnly: false },
        { title: "OP. VERÃO", url: "/summer", icon: Sun, adminOnly: false }
      ]
    },

    { 
      title: "ADMINISTRAÇÃO", 
      icon: Shield, 
      adminOnly: true,
      subItems: [
        { title: "AUDITORIA", url: "/audit", adminOnly: true },
        { title: "BANCO DE DADOS", url: "/db-updates", icon: Database, adminOnly: true },
      ]
    },
  ];

  if (!user) return null;

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#7f1d1d] text-white transform transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl border-r border-red-900/30 flex flex-col`}>
        
        {/* HEADER SIDEBAR */}
        <div className="p-6 flex items-center gap-4 border-b border-red-900/50 mb-2 shrink-0">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/20 shrink-0">
                {logoError ? <Shield className="w-7 h-7 text-white" /> : <img src={SYSARP_LOGO} className="w-10 h-10 object-contain" alt="Logo" onError={() => setLogoError(true)} />}
            </div>
            <div className="min-w-0">
                <h1 className="text-2xl font-black tracking-wider leading-none truncate font-mono">SYSARP</h1>
                <p className="text-[10px] text-red-200 font-bold tracking-widest mt-1 opacity-80 uppercase">CBMPR</p>
            </div>
            <button className="lg:hidden ml-auto" onClick={() => setIsSidebarOpen(false)}><X className="w-6 h-6" /></button>
        </div>

        {/* NAVIGATION SCROLL */}
        <nav className="flex-1 overflow-y-auto px-3 space-y-2 py-4 custom-scrollbar">
            {navigationItems.map((item, idx) => {
              if (item.adminOnly && user.role !== 'admin') return null;
              
              // Verifica se algum subitem está ativo para marcar o pai
              const isParentActive = item.subItems?.some(sub => sub.url === location.pathname);
              const isDirectActive = item.url === location.pathname;
              const isExpanded = expandedMenus[item.title] || isParentActive;

              return (
                <div key={idx} className="space-y-1">
                  {item.subItems ? (
                    // --- MENU COM SUBITENS (COLLAPSIBLE) ---
                    <>
                      <button
                        onClick={() => toggleMenu(item.title)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${
                          isParentActive ? 'bg-red-900/40 text-white shadow-inner' : 'hover:bg-white/10 text-red-100 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                           {item.icon && <item.icon className={`w-5 h-5 ${isParentActive ? 'text-white' : 'opacity-70 group-hover:opacity-100'}`} />}
                           <span className="text-sm font-bold tracking-wide">{item.title}</span>
                        </div>
                        {isExpanded ? <ChevronDown className="w-4 h-4 opacity-70" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
                      </button>

                      {/* SUBITENS RENDER */}
                      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="mt-1 space-y-1 bg-black/10 rounded-lg p-1 mx-2">
                          {item.subItems.map((sub, sIdx) => {
                            if (sub.adminOnly && user.role !== 'admin') return null;
                            const isSubActive = sub.url === location.pathname;
                            
                            return (
                              <Link 
                                key={sIdx} 
                                to={sub.url || '#'} 
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-xs font-bold ${
                                  isSubActive 
                                    ? 'bg-white text-red-800 shadow-sm translate-x-1' 
                                    : 'text-red-200/80 hover:text-white hover:bg-white/10 hover:translate-x-1'
                                }`} 
                                onClick={() => setIsSidebarOpen(false)}
                              >
                                {sub.icon ? <sub.icon className="w-3.5 h-3.5" /> : <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />}
                                <span>{sub.title}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    // --- MENU DIRETO (SEM SUBITENS) ---
                    <Link
                      to={item.url || '#'}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${
                        isDirectActive 
                          ? 'bg-white text-red-800 shadow-lg font-black scale-[1.02]' 
                          : 'hover:bg-white/10 text-red-100 hover:text-white'
                      }`}
                      onClick={() => setIsSidebarOpen(false)}
                    >
                      <div className="flex items-center gap-3">
                         {item.icon && <item.icon className={`w-5 h-5 ${isDirectActive ? 'text-red-700' : 'opacity-70 group-hover:opacity-100'}`} />}
                         <span className="text-sm font-bold tracking-wide">{item.title}</span>
                      </div>
                      {item.badgeCount ? (
                         <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse ${isDirectActive ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
                            {item.badgeCount}
                         </span>
                      ) : null}
                    </Link>
                  )}
                </div>
              );
            })}
        </nav>

        {/* FOOTER SIDEBAR */}
        <div className="p-4 border-t border-red-900/50 bg-black/10 shrink-0">
            <div className="flex items-center gap-3 px-3 py-3 mb-2 rounded-xl bg-white/5 border border-white/5">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#7f1d1d] font-bold text-sm border-2 border-red-800 shadow-inner shrink-0">
                {user.full_name[0]}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate uppercase">{user.full_name}</p>
                <p className="text-[9px] text-red-300 truncate uppercase font-black tracking-widest">{user.role}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-red-200 hover:bg-red-950/50 hover:text-white transition-colors text-xs font-black uppercase tracking-wider">
              <LogOut className="w-4 h-4" />
              <span>Sair do Sistema</span>
            </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 lg:hidden shrink-0 z-30 shadow-sm">
          <button onClick={() => setIsSidebarOpen(true)}><Menu className="w-6 h-6 text-slate-600" /></button>
          <div className="flex items-center gap-2 ml-4">
             {logoError ? <Shield className="w-5 h-5 text-[#7f1d1d]" /> : <img src={SYSARP_LOGO} className="w-6 h-6" alt="Mini Logo" onError={() => setLogoError(true)} />}
             <h2 className="font-black text-[#7f1d1d] tracking-widest text-lg">SYSARP</h2>
          </div>
        </header>
        <div className="flex-1 overflow-hidden relative">{children}</div>
      </main>
    </div>
  );
}
