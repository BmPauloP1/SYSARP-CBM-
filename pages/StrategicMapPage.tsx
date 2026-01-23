
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StrategicMapOp from '../components/maps/StrategicMapOp';
import { Button } from '../components/ui_components';
import { ArrowLeft, Map as MapIcon } from 'lucide-react';

export default function StrategicMapPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="relative h-screen w-full bg-slate-50">
        {/* Floating Header for Strategic Context */}
        <div className="absolute top-4 left-4 z-[1000] flex gap-2">
            <Button onClick={() => navigate('/operations')} className="bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 h-10 w-10 p-0 rounded-full shadow-lg">
                <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="bg-white/90 backdrop-blur text-slate-800 px-4 py-2 rounded-lg border border-slate-200 shadow-lg flex items-center gap-3">
                <MapIcon className="w-5 h-5 text-blue-600" />
                <div>
                    <h1 className="text-sm font-bold uppercase leading-none">Mapa Estratégico (Nível 1)</h1>
                    <p className="text-[10px] text-slate-500 font-mono">Planejamento Operacional - Op ID: {id?.split('-')[0]}</p>
                </div>
            </div>
        </div>

        <StrategicMapOp operationId={id} />
    </div>
  );
}
