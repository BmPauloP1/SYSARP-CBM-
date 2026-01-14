
import React from 'react';
import { 
  MapPin, 
  Radio, 
  Users, 
  Plane, 
  Clock, 
  Activity, 
  AlertTriangle 
} from 'lucide-react';

interface OperationalInfoTickerProps {
  totalOps: number;
  activeOpsCount: number;
  pilotsCount: number;
  dronesCount: number;
  totalFlightHours: number;
  activeTransmissions: number;
  alertsCount: number;
}

interface TickerItem {
  id: number;
  icon: React.ElementType;
  title: string;
  value: string | number;
  color: string;
  bgColor: string;
  animate?: boolean;
  isAlert?: boolean;
}

const CardItem: React.FC<{ item: TickerItem }> = ({ item }) => (
  <div className="flex items-center gap-3 px-6 py-3 mx-2 bg-white border border-slate-200 rounded-xl shadow-sm min-w-[240px] h-[80px] hover:shadow-md transition-shadow">
    <div className={`p-3 rounded-full ${item.bgColor} ${item.color}`}>
      <item.icon className={`w-6 h-6 ${item.animate ? 'animate-pulse' : ''}`} />
    </div>
    <div className="flex flex-col">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        {item.title}
      </span>
      <span className={`font-bold ${item.isAlert && typeof item.value === 'string' ? 'text-xs text-slate-500' : 'text-xl text-slate-800'}`}>
        {item.value}
      </span>
    </div>
  </div>
);

export const OperationalInfoTicker: React.FC<OperationalInfoTickerProps> = ({
  totalOps,
  activeOpsCount,
  pilotsCount,
  dronesCount,
  totalFlightHours,
  activeTransmissions,
  alertsCount
}) => {
  
  const items: TickerItem[] = [
    {
      id: 1,
      icon: MapPin,
      title: "TOTAL DE OCORRÊNCIAS",
      value: totalOps,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      id: 2,
      icon: Radio,
      title: "OCORRÊNCIAS ATIVAS",
      value: activeOpsCount,
      color: "text-red-600",
      bgColor: "bg-red-50",
      animate: true
    },
    {
      id: 3,
      icon: Users,
      title: "PILOTOS CADASTRADOS",
      value: pilotsCount,
      color: "text-slate-600",
      bgColor: "bg-slate-100"
    },
    {
      id: 4,
      icon: Plane,
      title: "AERONAVES",
      value: dronesCount,
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    },
    {
      id: 5,
      icon: Clock,
      title: "HORAS DE VOO",
      value: `${totalFlightHours.toFixed(1)}h`,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      id: 6,
      icon: Activity,
      title: "TRANSMISSÕES",
      value: activeTransmissions,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      id: 7,
      icon: AlertTriangle,
      title: "ALERTAS",
      value: alertsCount > 0 ? alertsCount : "Nenhum alerta no momento",
      color: alertsCount > 0 ? "text-amber-600" : "text-slate-400",
      bgColor: alertsCount > 0 ? "bg-amber-50" : "bg-slate-50",
      isAlert: true
    }
  ];

  // Inline styles for the ticker animation
  const tickerStyle = `
    @keyframes ticker-scroll {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    .ticker-track {
      display: flex;
      width: max-content;
      animation: ticker-scroll 60s linear infinite;
    }
    .ticker-track:hover {
      animation-play-state: paused;
    }
  `;

  return (
    <div className="w-full bg-slate-50 border-b border-slate-200 overflow-hidden relative py-4 z-0">
      <style>{tickerStyle}</style>
      
      {/* Gradient Masks for smooth fade out */}
      <div className="absolute top-0 left-0 h-full w-20 bg-gradient-to-r from-slate-100 to-transparent z-10 pointer-events-none" />
      <div className="absolute top-0 right-0 h-full w-20 bg-gradient-to-l from-slate-100 to-transparent z-10 pointer-events-none" />

      <div className="ticker-track">
        {/* Original Set */}
        {items.map((item) => (
          <CardItem key={`orig-${item.id}`} item={item} />
        ))}
        {/* Duplicate Set for Loop */}
        {items.map((item) => (
          <CardItem key={`dup-${item.id}`} item={item} />
        ))}
        {/* Triplicate Set for Safety on wide screens */}
        {items.map((item) => (
          <CardItem key={`trip-${item.id}`} item={item} />
        ))}
      </div>
    </div>
  );
};
