import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Moto } from '../../../lib/types';
import { MapPin, Bike, RefreshCw } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500', en_panne: 'bg-red-500', immobilisee: 'bg-yellow-500', disponible: 'bg-blue-500'
};
const STATUS_LABELS: Record<string, string> = {
  active: 'Active', en_panne: 'En panne', immobilisee: 'Immobilisée', disponible: 'Disponible'
};

export default function GPSMapPage() {
  const [motos, setMotos] = useState<(Moto & { locataires?: { nom: string; prenom: string } })[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [filterStatut, setFilterStatut] = useState('');

  const fetchMotos = async () => {
    const { data } = await supabase.from('motos').select('*, locataires(nom,prenom)').order('matricule');
    if (data) {
      setMotos(data as typeof motos);
      setLastUpdate(new Date());
    }
  };

  useEffect(() => {
    fetchMotos();
    const sub = supabase.channel('gps-map')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'motos' }, fetchMotos)
      .subscribe();
    const interval = setInterval(fetchMotos, 30000);
    return () => { supabase.removeChannel(sub); clearInterval(interval); };
  }, []);

  const filtered = motos.filter(m => !filterStatut || m.statut === filterStatut);
  const selectedMoto = motos.find(m => m.id === selected);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {['', 'active', 'en_panne', 'immobilisee', 'disponible'].map(s => (
            <button key={s} onClick={() => setFilterStatut(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${filterStatut === s ? 'border-[#F5821F] bg-orange-50 text-[#F5821F]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              {s === '' ? 'Toutes' : STATUS_LABELS[s]}
              <span className="ml-1.5 font-normal">({s === '' ? motos.length : motos.filter(m => m.statut === s).length})</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <RefreshCw size={13} className="text-[#F5821F]" />
          Mis à jour : {lastUpdate.toLocaleTimeString('fr-CI')}
          <button onClick={fetchMotos} className="text-[#F5821F] font-semibold hover:underline">Actualiser</button>
        </div>
      </div>

      {/* Map + List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Map */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <MapPin size={16} className="text-[#F5821F]" />
            <h3 className="font-bold text-[#1B2A4A] text-sm">Carte GPS — Abidjan, Côte d'Ivoire</h3>
          </div>
          <div className="relative bg-[#E8F2E8] h-80 md:h-[500px]">
            {/* Grid pattern simulating map */}
            <div className="absolute inset-0" style={{
              backgroundImage: `
                repeating-linear-gradient(0deg, rgba(0,0,0,0.05), rgba(0,0,0,0.05) 1px, transparent 1px, transparent 50px),
                repeating-linear-gradient(90deg, rgba(0,0,0,0.05), rgba(0,0,0,0.05) 1px, transparent 1px, transparent 50px)
              `
            }} />
            {/* Simulated roads */}
            <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
              <line x1="0" y1="50" x2="100" y2="50" stroke="#1B2A4A" strokeWidth="0.5" />
              <line x1="50" y1="0" x2="50" y2="100" stroke="#1B2A4A" strokeWidth="0.5" />
              <line x1="0" y1="30" x2="100" y2="70" stroke="#1B2A4A" strokeWidth="0.3" />
              <line x1="20" y1="0" x2="80" y2="100" stroke="#1B2A4A" strokeWidth="0.3" />
            </svg>

            <div className="absolute top-2 left-2 bg-white/90 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 shadow-sm">
              Zone : Abidjan · {filtered.length} véhicule(s)
            </div>

            {/* Moto markers */}
            {filtered.map(m => {
              const x = ((m.gps_lng + 4.03) / 0.08) * 100;
              const y = ((5.38 - m.gps_lat) / 0.06) * 100;
              const cx = Math.max(3, Math.min(97, x));
              const cy = Math.max(3, Math.min(97, y));
              const isSelected = selected === m.id;
              return (
                <div
                  key={m.id}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-10"
                  style={{ left: `${cx}%`, top: `${cy}%` }}
                  onClick={() => setSelected(isSelected ? null : m.id)}
                >
                  {m.statut === 'active' && (
                    <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-30 scale-150" />
                  )}
                  <div className={`w-5 h-5 rounded-full border-2 border-white shadow-lg transition-transform ${STATUS_COLORS[m.statut]} ${isSelected ? 'scale-150' : 'group-hover:scale-125'}`} />
                  <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-[#1B2A4A] text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap shadow-lg z-20 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition`}>
                    <p className="font-bold">{m.matricule}</p>
                    {m.locataires && <p>{m.locataires.prenom} {m.locataires.nom}</p>}
                    <p className="capitalize">{STATUS_LABELS[m.statut]}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap gap-4">
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5 text-xs text-gray-600">
                <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[k]}`} />
                {v} ({motos.filter(m => m.statut === k).length})
              </div>
            ))}
          </div>
        </div>

        {/* Moto list */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-bold text-[#1B2A4A] text-sm flex items-center gap-2"><Bike size={15} className="text-[#F5821F]" /> Détail flotte ({filtered.length})</h3>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {filtered.map(m => (
              <div key={m.id}
                className={`px-4 py-3 cursor-pointer transition ${selected === m.id ? 'bg-orange-50 border-l-2 border-l-[#F5821F]' : 'hover:bg-gray-50'}`}
                onClick={() => setSelected(selected === m.id ? null : m.id)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-sm font-bold text-[#1B2A4A]">{m.matricule}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full text-white ${STATUS_COLORS[m.statut]}`}>{STATUS_LABELS[m.statut]}</span>
                </div>
                {m.locataires ? (
                  <p className="text-xs text-gray-600">{m.locataires.prenom} {m.locataires.nom}</p>
                ) : <p className="text-xs text-gray-400 italic">Non assigné</p>}
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                  <MapPin size={10} className="text-[#F5821F]" />
                  {m.gps_lat.toFixed(4)}, {m.gps_lng.toFixed(4)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
