
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TacticalMapOp from '../components/maps/TacticalMapOp';
import { Button } from '../components/ui_components';
import { ArrowLeft, Crosshair } from 'lucide-react';

export default function TacticalMapPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="relative h-screen w-full bg-slate-900">
        {/* Floating Header for Tactical Context */}
        <div className="absolute top-4 left-4 z-[1000] flex gap-2">
            <Button onClick={() => navigate('/operations')} className="bg-slate-800 text-white border border-slate-700 hover:bg-slate-700 h-10 w-10 p-0 rounded-full shadow-lg">
                <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="bg-slate-800/90 backdrop-blur text-white px-4 py-2 rounded-lg border border-slate-700 shadow-lg flex items-center gap-3">
                <Crosshair className="w-5 h-5 text-red-500 animate-pulse" />
                <div>
                    <h1 className="text-sm font-bold uppercase leading-none">Mapa Tático (Nível 2)</h1>
                    <p className="text-[10px] text-slate-400 font-mono">Execução de Campo - Op ID: {id?.split('-')[0]}</p>
                </div>
            </div>
        </div>

        <TacticalMapOp operationId={id} />
    </div>
  );
}
