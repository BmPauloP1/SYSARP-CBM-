import React, { useState, useEffect } from "react";
import { base44 } from "../services/base44Client";
import { Card } from "../components/ui_components";
import { Badge } from "../components/ui_components";
import { Video, Play, Radio as RadioIcon, Users, Calendar, MapPin, Signal, Wifi, Activity, Maximize2, MoreHorizontal, UsersRound, Share2 } from "lucide-react";
import { Operation, Pilot, Drone, MISSION_LABELS } from "../types";

const extractVideoId = (url: string) => {
  if (!url) return null;
  
  const liveMatch = url.match(/youtube\.com\/live\/([^?&/]{11})/);
  if (liveMatch) return { type: 'youtube', id: liveMatch[1] };

  const youtubeMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  if (youtubeMatch) return { type: 'youtube', id: youtubeMatch[1] };
  
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return { type: 'vimeo', id: vimeoMatch[1] };
  
  const twitchMatch = url.match(/twitch\.tv\/([^\/\?]+)/);
  if (twitchMatch) return { type: 'twitch', channel: twitchMatch[1] };
  
  return { type: 'iframe', url };
};

const VideoPlayer = ({ videoData, isMain }: { videoData: any, isMain: boolean }) => {
  if (!videoData) return null;
  
  const containerClass = isMain 
    ? "w-full h-full absolute inset-0 bg-black" 
    : "w-full aspect-video bg-black";
  
  const origin = window.location.origin && window.location.origin !== 'null' 
    ? `&origin=${encodeURIComponent(window.location.origin)}` 
    : '';

  if (videoData.type === 'youtube') {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${videoData.id}?rel=0&modestbranding=1&autoplay=1${origin}`}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className={containerClass}
      />
    );
  }
  
  if (videoData.type === 'vimeo') {
    return (
      <iframe
        src={`https://player.vimeo.com/video/${videoData.id}?autoplay=1`}
        frameBorder="0"
        allow="fullscreen; picture-in-picture"
        allowFullScreen
        className={containerClass}
      />
    );
  }
  
  if (videoData.type === 'twitch') {
    return (
      <iframe
        src={`https://player.twitch.tv/?channel=${videoData.channel}&parent=${window.location.hostname}`}
        frameBorder="0"
        allowFullScreen
        className={containerClass}
      />
    );
  }
  
  return (
    <iframe
      src={videoData.url}
      frameBorder="0"
      allowFullScreen
      className={containerClass}
    />
  );
};

export default function Transmissions() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [mainStream, setMainStream] = useState<Operation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [ops, pil, drn] = await Promise.all([
        base44.entities.Operation.filter({ status: "active" }),
        base44.entities.Pilot.list(),
        base44.entities.Drone.list()
      ]);
      
      const activeWithStreams = ops.filter(op => op.stream_url && op.stream_url.length > 5);
      
      setOperations(activeWithStreams);
      setPilots(pil);
      setDrones(drn);
      
      setMainStream((currentSelection) => {
        if (currentSelection) {
            const stillActive = activeWithStreams.find(op => op.id === currentSelection.id);
            if (stillActive) return stillActive;
        }
        if (activeWithStreams.length > 0) return activeWithStreams[0];
        return null;
      });

    } catch (e) {
      console.error("Failed to load transmission data", e);
    } finally {
      setLoading(false);
    }
  };

  const otherStreams = operations.filter(op => op.id !== mainStream?.id);

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-slate-950 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" />
        <p className="mt-4 text-slate-400 font-mono text-xs uppercase tracking-widest">Estabelecendo Link Seguro...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden text-slate-200 font-sans">
      
      <div className="flex-shrink-0 bg-slate-900 border-b border-slate-800 px-6 py-4 shadow-md z-10 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-3 tracking-wide">
            <div className="relative">
                <Video className="w-6 h-6 text-red-600" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full animate-ping"></span>
            </div>
            SALA DE SITUAÇÃO
          </h1>
          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mt-1">
             Transmissão de Dados e Vídeo em Tempo Real - CCO SYSARP
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-800 px-3 py-1.5 rounded border border-slate-700">
              <Signal className="w-3 h-3 text-green-500" />
              <span>SINAL ESTÁVEL</span>
           </div>
           <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                {operations.length > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${operations.length > 0 ? 'bg-red-500' : 'bg-slate-600'}`}></span>
              </span>
              <span className="text-xs font-bold text-white tracking-wider">
                  {operations.length > 0 ? `${operations.length} LINKS ATIVOS` : 'OFFLINE'}
              </span>
           </div>
        </div>
      </div>

      {operations.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-600">
          <div className="bg-slate-900 p-8 rounded-full mb-6 border border-slate-800 shadow-2xl relative">
             <div className="absolute inset-0 rounded-full border border-red-900/30 animate-ping"></div>
             <RadioIcon className="w-16 h-16 text-slate-700" />
          </div>
          <h3 className="text-xl font-bold text-slate-400 mb-2 tracking-widest uppercase">Aguardando Sinal</h3>
          <p className="text-center max-w-md text-sm font-mono text-slate-500">
            Nenhuma transmissão de vídeo detectada no momento. O sistema entrará em modo de monitoramento automático assim que um link for estabelecido.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          
          <div className="flex-1 overflow-y-auto lg:overflow-hidden p-4 md:p-6 flex flex-col min-h-0">
             {mainStream && (
                <div className="flex flex-col h-full gap-4">
                   
                   <div className="flex-1 bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800 relative group min-h-[300px]">
                      <VideoPlayer videoData={extractVideoId(mainStream.stream_url || '')} isMain={true} />
                      
                      <div className="absolute top-4 left-4 flex gap-2">
                          <span className="bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest animate-pulse shadow-lg">
                              AO VIVO
                          </span>
                          <span className="bg-black/60 backdrop-blur text-white text-[10px] font-mono px-2 py-1 rounded border border-white/10 uppercase">
                              REC: {mainStream.occurrence_number}
                          </span>
                      </div>
                      
                      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="flex justify-between items-end">
                              <div>
                                  <h2 className="text-white font-bold text-lg shadow-black drop-shadow-md">{mainStream.name}</h2>
                                  <p className="text-slate-300 text-xs shadow-black drop-shadow-md">{MISSION_LABELS[mainStream.mission_type]}</p>
                              </div>
                              <Maximize2 className="w-5 h-5 text-white cursor-pointer hover:text-red-500 transition-colors" />
                          </div>
                      </div>
                   </div>

                   <div className="h-auto shrink-0 grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
                      
                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4 shadow-lg border-l-4 border-l-blue-600">
                          <div className="p-3 bg-blue-900/20 rounded-lg text-blue-500 border border-blue-900/30">
                              <Users className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">PIC</p>
                              <p className="text-sm font-bold text-slate-200 truncate">{pilots.find(p => p.id === mainStream.pilot_id)?.full_name || 'N/A'}</p>
                          </div>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4 shadow-lg">
                          <div className="p-3 bg-orange-900/20 rounded-lg text-orange-500 border border-orange-900/30">
                              <Wifi className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Vetor</p>
                              <p className="text-sm font-bold text-slate-200 truncate">
                                  {drones.find(d => d.id === mainStream.drone_id)?.model || 'Desconhecido'}
                              </p>
                          </div>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4 shadow-lg">
                          <div className="p-3 bg-green-900/20 rounded-lg text-green-500 border border-green-900/30">
                              <Calendar className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Início</p>
                              <p className="text-sm font-bold text-slate-200 font-mono">
                                  {new Date(mainStream.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </p>
                          </div>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4 shadow-lg">
                          <div className="p-3 bg-red-900/20 rounded-lg text-red-500 border border-red-900/30">
                              <MapPin className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Coords</p>
                              <p className="text-sm font-bold text-slate-200 font-mono truncate">
                                  {mainStream.latitude.toFixed(4)}, {mainStream.longitude.toFixed(4)}
                              </p>
                          </div>
                      </div>
                   </div>
                   
                   <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-sm text-slate-400 flex items-start gap-3 shadow-lg">
                        <Activity className="w-5 h-5 text-slate-600 mt-0.5 shrink-0" />
                        <div>
                            <span className="font-bold text-slate-500 uppercase text-xs block mb-1">Notas Operacionais</span>
                            {mainStream.description || "Nenhuma observação registrada para esta transmissão."}
                        </div>
                   </div>

                </div>
             )}
          </div>

          <div className="w-full lg:w-80 flex-shrink-0 bg-slate-900 border-l border-slate-800 overflow-y-auto h-auto lg:h-full z-10 custom-scrollbar">
             <div className="p-4 border-b border-slate-800 sticky top-0 z-10 bg-slate-900/95 backdrop-blur">
                <h3 className="font-bold text-slate-200 text-xs uppercase tracking-widest flex items-center gap-2">
                   <Play className="w-3 h-3 text-red-500 fill-red-500" /> Canais Disponíveis
                </h3>
             </div>
             
             <div className="p-3 space-y-3">
                {otherStreams.length === 0 && (
                   <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl mt-4">
                        <MoreHorizontal className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                        <p className="text-xs text-slate-500 font-mono">Nenhum outro canal</p>
                   </div>
                )}
                
                {otherStreams.map((op) => {
                   const pilot = pilots.find(p => p.id === op.pilot_id);
                   return (
                      <div 
                        key={op.id}
                        onClick={() => setMainStream(op)}
                        className="group cursor-pointer bg-black/40 border border-slate-800 rounded-lg overflow-hidden hover:border-red-600/50 hover:bg-slate-800 transition-all relative"
                      >
                         <div className="relative aspect-video bg-black w-full opacity-80 group-hover:opacity-100 transition-opacity">
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                               <VideoPlayer videoData={extractVideoId(op.stream_url || '')} isMain={false} />
                            </div>
                            <div className="absolute inset-0 bg-transparent z-20"></div>
                            
                            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded border border-white/10 z-30">
                               {new Date(op.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                            </div>
                         </div>
                         
                         <div className="p-3 relative">
                            <div className="absolute top-0 left-0 bottom-0 w-1 bg-slate-700 group-hover:bg-red-600 transition-colors"></div>
                            <h4 className="font-bold text-xs text-slate-200 line-clamp-1 pl-2 mb-1">{op.name}</h4>
                            <div className="pl-2 flex justify-between items-center">
                               <span className="text-[10px] text-slate-500 truncate max-w-[120px] font-mono uppercase">{pilot?.full_name?.split(' ')[0] || 'N/A'}</span>
                               <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 rounded text-slate-400 border border-slate-700">
                                  {MISSION_LABELS[op.mission_type].split(' ')[0]}
                               </span>
                            </div>
                         </div>
                      </div>
                   )
                })}
             </div>
          </div>

        </div>
      )}
    </div>
  );
}
