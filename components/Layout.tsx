import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Map, 
  Users, 
  Wrench, 
  FileText, 
  Video, 
  Sun, 
  History, 
  Navigation, 
  ShieldAlert, 
  ShieldCheck,
  Shield,
  LogOut,
  Menu,
  X,
  Database,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Radio,
  Activity
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
  subItems?: NavItem[];
}

const navigationItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, adminOnly: false },
  { title: "Pilotos", url: "/pilots", icon: Users, adminOnly: false },
  { 
    title: "Aeronaves", 
    url: "/drones", 
    icon: DroneIcon, // Ícone alterado para Drone
    adminOnly: false,
    subItems: [
      { title: "Cautelas", url: "/cautela", adminOnly: false },
    ]
  },
  { 
    title: "Op. Verão 2025/2026", 
    icon: Sun, 
    adminOnly: false,
    subItems: [
      { title: "Diário de Voos", url: "/summer/flights", adminOnly: false },
      { title: "Estatísticas", url: "/summer/stats", adminOnly: false },
      { title: "Relatórios", url: "/summer/report", adminOnly: false },
      { title: "Auditoria", url: "/summer/audit", adminOnly: true },
    ]
  },
  { 
    title: "Operações", 
    icon: Radio, 
    adminOnly: false,
    subItems: [
      { title: "Criar Operações", url: "/operations", adminOnly: false },
      { title: "Plano de Voo", url: "/flight-plan", adminOnly: false },
      { title: "A.R.O.", url: "/aro", adminOnly: false },
    ]
  },
  { title: "Transmissão", url: "/transmissions", icon: Activity, adminOnly: false },
  { title: "Manutenção", url: "/maintenance", icon: Wrench, adminOnly: false },
  { title: "Relatórios", url: "/reports", icon: FileText, adminOnly: false },
  
  { 
    title: "Administração", 
    icon: Shield, 
    adminOnly: true,
    subItems: [
      { title: "Auditoria", url: "/audit", adminOnly: true },
      { title: "Scripts SQL", url: "/db-updates", adminOnly: true },
    ]
  },
];

export default function Layout({ children }: LayoutProps) {
  const [user, setUser] = useState<Pilot | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => navigate('/login'));
  }, [navigate]);

  const handleLogout = async () => {
    await base44.auth.logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-[#7f1d1d] text-white transform transition-transform duration-300 lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        shadow-2xl border-r border-red-900/30
      `}>
        <div className="flex flex-col h-full">
          {/* Header Sidebar - Com tratamento de erro na logo igual ao Login */}
          <div className="p-6 flex items-center gap-4 border-b border-red-900/50 mb-2">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/20 shrink-0">
                {logoError ? (
                  <Shield className="w-7 h-7 text-white" />
                ) : (
                  <img 
                    src={SYSARP_LOGO} 
                    className="w-10 h-10 object-contain" 
                    alt="Logo" 
                    onError={() => setLogoError(true)}
                  />
                )}
            </div>
            <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-wider leading-none truncate">SYSARP</h1>
                <p className="text-[10px] text-red-200 font-bold tracking-widest mt-1 opacity-80 uppercase">CBMPR</p>
            </div>
            <button className="lg:hidden ml-auto" onClick={() => setIsSidebarOpen(false)}>
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar pb-10">
            {navigationItems.map((item, idx) => {
              if (item.adminOnly && user.role !== 'admin') return null;
              
              const isActive = item.url === location.pathname;
              const hasSubItems = item.subItems && item.subItems.length > 0;

              return (
                <div key={idx} className="space-y-1">
                  {item.url ? (
                    <Link
                      to={item.url}
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                        ${isActive 
                          ? 'bg-white/15 text-white shadow-inner font-bold border-l-4 border-white' 
                          : 'hover:bg-white/5 text-red-100 hover:text-white'}
                      `}
                      onClick={() => setIsSidebarOpen(false)}
                    >
                      {item.icon && <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'opacity-70'}`} />}
                      <span className="text-sm">{item.title}</span>
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between px-4 py-3 text-red-100/90 font-semibold cursor-default mt-2 group">
                       <div className="flex items-center gap-3">
                          {item.icon && <item.icon className="w-5 h-5 opacity-70" />}
                          <span className="text-sm uppercase tracking-tight">{item.title}</span>
                       </div>
                       <ChevronDown className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}

                  {hasSubItems && (
                    <div className="space-y-1 ml-6 border-l border-red-800/40">
                      {item.subItems?.map((sub, sIdx) => {
                        if (sub.adminOnly && user.role !== 'admin') return null;
                        const isSubActive = sub.url === location.pathname;
                        
                        return (
                          <Link
                            key={sIdx}
                            to={sub.url || '#'}
                            className={`
                              flex items-center gap-3 px-4 py-2 rounded-lg transition-all text-xs
                              ${isSubActive ? 'text-white font-bold bg-white/10' : 'text-red-200 hover:text-white hover:bg-white/5'}
                            `}
                            onClick={() => setIsSidebarOpen(false)}
                          >
                            <span className={`text-lg leading-none ${isSubActive ? 'text-white' : 'text-red-400'}`}>•</span>
                            <span>{sub.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* User Profile Area */}
          <div className="p-4 border-t border-red-900/50 bg-black/10">
            <div className="flex items-center gap-3 px-3 py-3 mb-2 rounded-xl bg-white/5">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#7f1d1d] font-bold text-sm border-2 border-red-800 shadow-inner">
                {user.full_name[0]}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{user.full_name}</p>
                <p className="text-[9px] text-red-300 truncate uppercase font-black tracking-widest">{user.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-red-200 hover:bg-red-800 hover:text-white transition-colors text-xs font-bold"
            >
              <LogOut className="w-4 h-4" />
              <span>SAIR DO SISTEMA</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 lg:hidden shrink-0 z-30 shadow-sm">
          <button onClick={() => setIsSidebarOpen(true)}>
            <Menu className="w-6 h-6 text-slate-600" />
          </button>
          <div className="flex items-center gap-2 ml-4">
             {logoError ? <Shield className="w-5 h-5 text-[#7f1d1d]" /> : <img src={SYSARP_LOGO} className="w-6 h-6" alt="Mini Logo" onError={() => setLogoError(true)} />}
             <h2 className="font-bold text-[#7f1d1d] tracking-widest">SYSARP</h2>
          </div>
        </header>
        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>
      </main>
    </div>
  );
}
