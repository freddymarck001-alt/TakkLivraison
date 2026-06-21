import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatCFA } from '../../lib/types';
import StatCard from '../../components/StatCard';
import { Bike, Users, AlertTriangle, MapPin, CheckCircle, Clock } from 'lucide-react';

export default function DODashboard() {
  const [stats, setStats] = useState({
    activeMotos: 0, panneMotos: 0, totalLocataires: 0,
    absencesAujourdHui: 0, incidentsOuverts: 0,
    recettesJour: 0,
  });
  const [motos, setMotos] = useState<{ id: string; matricule: string; statut: string; gps_lat: number; gps_lng: number; locataires?: { nom: string; prenom: string } }[]>([]);
  const [incidents, setIncidents] = useState<{ id: string; titre: string; gravite: string; statut: string; type_incident: string; date_incident: string }[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const today = new Date().toISOString().split('T')[0];
      const [motosRes, absRes, incRes, recRes] = await Promise.all([
        supabase.from('motos').select('id,matricule,statut,gps_lat,gps_lng,locataires(nom,prenom)').order('matricule'),
        supabase.from('absences').select('id', { count: 'exact', head: true }).eq('date_absence', today),
        supabase.from('incidents').select('id,titre,gravite,statut,type_incident,date_incident').neq('statut', 'ferme').order('created_at', { ascending: false }).limit(5),
        supabase.from('recettes').select('montant_recu').eq('semaine_debut', today).limit(100),
      ]);

      const motosData = motosRes.data || [];
      setMotos(motosData as typeof motos);
      setIncidents(incRes.data || []);
      setStats({
        activeMotos: motosData.filter(m => m.statut === 'active').length,
        panneMotos: motosData.filter(m => m.statut === 'en_panne').length,
        totalLocataires: motosData.filter(m => m.locataires).length,
        absencesAujourdHui: absRes.count ?? 0,
        incidentsOuverts: (incRes.data || []).filter(i => i.statut !== 'resolu').length,
        recettesJour: (recRes.data || []).reduce((s, r) => s + Number(r.montant_recu), 0),
      });
    };
    fetch();
    const sub = supabase.channel('do-dash')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'motos' }, fetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'absences' }, fetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, fetch)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const graviteColor: Record<string, string> = {
    faible: 'bg-blue-100 text-blue-800',
    moyenne: 'bg-yellow-100 text-yellow-800',
    elevee: 'bg-orange-100 text-orange-800',
    critique: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Motos actives" value={stats.activeMotos} icon={Bike} color="green" />
        <StatCard label="En panne" value={stats.panneMotos} icon={AlertTriangle} color={stats.panneMotos > 0 ? 'red' : 'gray'} />
        <StatCard label="Absences aujourd'hui" value={stats.absencesAujourdHui} icon={Users} color={stats.absencesAujourdHui > 0 ? 'orange' : 'gray'} />
        <StatCard label="Incidents ouverts" value={stats.incidentsOuverts} icon={AlertTriangle} color={stats.incidentsOuverts > 0 ? 'red' : 'gray'} />
        <StatCard label="Locataires assignés" value={stats.totalLocataires} icon={Users} color="navy" />
        <StatCard label="Recettes saisies" value={formatCFA(stats.recettesJour)} icon={CheckCircle} color="blue" />
      </div>

      {/* GPS Overview */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-[#1B2A4A] mb-4 flex items-center gap-2">
          <MapPin size={18} className="text-[#F5821F]" /> Positions GPS — Flotte en temps réel
        </h3>
        <div className="relative bg-[#E8F0E8] rounded-xl h-56 overflow-hidden">
          {/* Simulated map background */}
          <div className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `repeating-linear-gradient(0deg, #ccc, #ccc 1px, transparent 1px, transparent 40px),
                                repeating-linear-gradient(90deg, #ccc, #ccc 1px, transparent 1px, transparent 40px)`
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-gray-600 font-semibold bg-white/70 px-3 py-1.5 rounded-full">
              Zone : Abidjan, Côte d'Ivoire
            </p>
          </div>
          {/* Moto dots */}
          {motos.map((m, i) => {
            const x = ((m.gps_lng + 4.03) / 0.08) * 100;
            const y = ((5.38 - m.gps_lat) / 0.06) * 100;
            const clampedX = Math.max(5, Math.min(95, x));
            const clampedY = Math.max(5, Math.min(95, y));
            return (
              <div
                key={m.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                style={{ left: `${clampedX}%`, top: `${clampedY}%` }}
              >
                <div className={`w-3 h-3 rounded-full border-2 border-white shadow-lg ${
                  m.statut === 'active' ? 'bg-emerald-500' :
                  m.statut === 'en_panne' ? 'bg-red-500' :
                  m.statut === 'immobilisee' ? 'bg-yellow-500' : 'bg-blue-500'
                }`} />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#1B2A4A] text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition z-10">
                  {m.matricule}
                  {m.locataires && ` — ${m.locataires.prenom}`}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          {[
            { color: 'bg-emerald-500', label: 'Active' },
            { color: 'bg-red-500', label: 'En panne' },
            { color: 'bg-yellow-500', label: 'Immobilisée' },
            { color: 'bg-blue-500', label: 'Disponible' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5 text-xs text-gray-600">
              <div className={`w-3 h-3 rounded-full ${item.color}`} />
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* Incidents */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-[#1B2A4A] mb-4 flex items-center gap-2">
          <AlertTriangle size={18} className="text-[#F5821F]" /> Incidents en cours
        </h3>
        {incidents.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle size={32} className="mx-auto text-emerald-400 mb-2" />
            <p className="text-sm text-gray-500">Aucun incident en cours</p>
          </div>
        ) : (
          <div className="space-y-2">
            {incidents.map(inc => (
              <div key={inc.id} className="flex items-center justify-between p-3 bg-[#F7F8FA] rounded-xl border border-gray-100">
                <div>
                  <p className="text-sm font-semibold text-[#1B2A4A]">{inc.titre}</p>
                  <p className="text-xs text-gray-500 capitalize">{inc.type_incident} · {inc.date_incident}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${graviteColor[inc.gravite]}`}>
                    {inc.gravite}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    inc.statut === 'ouvert' ? 'bg-red-100 text-red-700' :
                    inc.statut === 'en_cours' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {inc.statut}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
