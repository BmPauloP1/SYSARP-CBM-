import React from 'react';
import { Hexagon, MoveRight, MapPin } from 'lucide-react';

interface TacticalMapControlsProps {
  onDrawSector: () => void;
  onDrawRoute: () => void;
  onAddPoi: () => void;
  activeMode: 'none' | 'poi' | 'sector' | 'route';
}

const TacticalMapControls: React.FC<TacticalMapControlsProps> = ({
  onDrawSector,
  onDrawRoute,
  onAddPoi,
  activeMode
}) => {
  const buttonClass = (mode: string) => `
    w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-xl border-2
    ${activeMode === mode 
      ? 'bg-amber-500 border-white text-white scale-110' 
      : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'}
    cursor-pointer pointer-events-auto
  `;

  return (
    <div className="absolute bottom-10 right-6 z-[9999] flex flex-col gap-4 pointer-events-none">
      {/* Botão de Setor */}
      <button
        onClick={(e) => { e.stopPropagation(); onDrawSector(); }}
        className={buttonClass('sector')}
        title="Criar Setor"
      >
        <Hexagon size={24} />
      </button>

      {/* Botão de Rota */}
      <button
        onClick={(e) => { e.stopPropagation(); onDrawRoute(); }}
        className={buttonClass('route')}
        title="Criar Rota"
      >
        <MoveRight size={24} />
      </button>

      {/* Botão de POI */}
      <button
        onClick={(e) => { e.stopPropagation(); onAddPoi(); }}
        className={buttonClass('poi')}
        title="Ponto de Interesse"
      >
        <MapPin size={24} />
      </button>

      <style>{`
        .pointer-events-auto { pointer-events: auto !important; }
        .pointer-events-none { pointer-events: none !important; }
      `}</style>
    </div>
  );
};

export default TacticalMapControls;