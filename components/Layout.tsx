
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Radio, Activity, 
  BarChart3, Shield, LogOut, Menu, X, ChevronDown, Plane, 
  Database, ShieldAlert, Settings
} from 'lucide-react';
import { base44 } from '../services/base44Client';
import { Pilot, SYSARP_LOGO } from '../types';

export default function Layout({ children }: { children?: React.ReactNode }) {
  // Evita o flicker: Busca o usuário do localStorage primeiro (cache rápido)
  const [user, setUser] = useState<Pilot | null>(() => {
    const cached = localStorage.getItem('sysarp_user_session');
    return cached ? JSON.parse(cached) : null;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Verifica sessão real em segundo plano
    base44.auth.me().then(me => {
      setUser(me);
      localStorage.setItem('sysarp_user_session', JSON.stringify(me));
    }).catch(() => {
      if (!user) navigate('/login');
    });
  }, [location.pathname]);

  const navItems = [
    { title: "DASHBOARD", url: "/", icon: LayoutDashboard },
    { title: "PILOTOS", url: "/pilots", icon: Users },
    { 
      title: "AERONAVES", 
      url: "/drones", 
      icon: Plane, 
      subItems: [
        { title: "GESTÃO DE FROTA", url: "/drones" },
        { title: "MANUTENÇÃO", url: "/maintenance" },
        { title: "CAUTELAS", url: "/cautela" }
      ]
    },
    { 
      title: "OPERAÇÕES", 
      url: "/operations", 
      icon: Radio, 
      subItems: [
        { title: "CRIAR OPERAÇÕES", url: "/operations?create=true" },
        { title: "PLANO DE VOO", url: "/flight-plan" },
        { title: "A.R.O.", url: "/aro" }
      ]
    },
    { title: "TRANSMISSÃO", url: "/transmissions", icon: Activity },
    { 
      title: "RELATÓRIOS", 
      url: "/reports", 
      icon: BarChart3, 
      subItems: [
        { title: "REL. GERAL", url: "/reports" },
        { title: "OP. VERÃO", url: "/summer" }
      ]
    },
    { 
      title: "ADMINISTRAÇÃO", 
      url: "/audit", 
      icon: Shield, 
      adminOnly: true,
      subItems: [
        { title: "AUDITORIA", url: "/audit" },
        { title: "ESTRUTURA DB", url: "/db-updates" }
      ]
    },
  ];

  const checkActive = (item: any) => {
    if (location.pathname === item.url) return true;
    if (item.url.includes('?') && location.pathname + location.search === item.url) return true;
    if (item.subItems?.some((s: any) => location.pathname === s.url || (s.url.includes('?') && location.pathname + location.search === s.url))) return true;
    return false;
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {/* Sidebar Mobile Overlay */}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#7f1d1d] text-white transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col shadow-2xl`}>
        
        {/* Logo Section */}
        <div className="p-8 flex items-center gap-4 shrink-0">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
            <img src={SYSARP_LOGO} className="w-10 h-10 object-contain" alt="Logo" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter leading-none text-white">SYSARP</h1>
            <p className="text-[11px] text-red-200 font-bold opacity-80 mt-1 uppercase tracking-widest">CBMPR</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-2 custom-scrollbar">
          {navItems.map((item, idx) => {
            if (item.adminOnly && user?.role !== 'admin') return null;
            
            const isActive = checkActive(item);
            
            return (
              <div key={idx} className="space-y-1">
                <Link 
                  to={item.subItems ? (location.pathname.startsWith(item.url) ? item.subItems[0].url : item.url) : item.url} 
                  className={`flex items-center justify-between px-5 py-4 rounded-2xl transition-all duration-200 ${isActive ? 'bg-white text-[#7f1d1d] shadow-xl scale-[1.02]' : 'text-red-100 hover:bg-white/10'}`}
                  onClick={() => !item.subItems && setIsSidebarOpen(false)}
                >
                  <div className="flex items-center gap-4">
                    <item.icon className={`w-6 h-6 ${isActive ? 'text-[#7f1d1d]' : 'text-red-200'}`} />
                    <span className="text-[11px] uppercase tracking-[0.1em] font-black">{item.title}</span>
                  </div>
                  {item.subItems && (
                    <ChevronDown className={`w-4 h-4 opacity-50 transition-transform duration-300 ${isActive ? 'rotate-180' : ''}`} />
                  )}
                </Link>

                {/* Sub-items (Auto-expand if parent is active) */}
                {isActive && item.subItems && (
                  <div className="mt-2 mb-4 space-y-1 bg-black/10 rounded-2xl py-3 px-2 animate-fade-in">
                    {item.subItems.map(sub => {
                      const isSubActive = location.pathname === sub.url || (sub.url.includes('?') && location.pathname + location.search === sub.url);
                      return (
                        <Link 
                          key={sub.url} 
                          to={sub.url} 
                          onClick={() => setIsSidebarOpen(false)}
                          className={`flex items-center gap-3 px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${isSubActive ? 'bg-white/10 text-white' : 'text-red-300/80 hover:text-white hover:translate-x-1'}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isSubActive ? 'bg-red-400' : 'bg-red-900/50'}`}></span>
                          {sub.title}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer: Profile & Logout */}
        <div className="p-4 bg-black/10 border-t border-red-900/30 shrink-0">
          {user && (
            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-[2rem] border border-white/5 mb-4 shadow-inner">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-[#7f1d1d] font-black text-lg shadow-xl border-2 border-red-900/20">
                {user.full_name[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black text-white truncate uppercase leading-tight">{user.full_name}</p>
                <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest mt-1 opacity-80">{user.role}</p>
              </div>
            </div>
          )}
          
          <button 
            onClick={() => base44.auth.logout().then(() => navigate('/login'))} 
            className="flex items-center gap-3 w-full px-6 py-4 rounded-2xl text-red-200 hover:bg-red-600 hover:text-white transition-all text-[11px] font-black uppercase tracking-widest group"
          >
            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> 
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-white">
        {/* Mobile Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:hidden shrink-0 z-50 shadow-sm">
           <div className="flex items-center gap-3">
              <img src={SYSARP_LOGO} className="w-8 h-8 object-contain" alt="Logo" />
              <h2 className="font-black text-[#7f1d1d] tracking-tighter text-xl uppercase leading-none">SYSARP</h2>
           </div>
           <button 
             onClick={() => setIsSidebarOpen(true)} 
             className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
           >
              <Menu className="w-7 h-7" />
           </button>
        </header>
        
        {/* Page Container */}
        <div className="flex-1 relative overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
