import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatCFA } from '../../lib/types';
import StatCard from '../../components/StatCard';
import { Users, Building2, UserPlus, AlertTriangle, Star, CheckCircle } from 'lucide-react';

export default function DRHDashboard() {
  const [stats, setStats] = useState({
    locatairesActifs: 0, locatairesSuspendus: 0,
    locatairesRecrutement: 0, investisseursActifs: 0,
    investisseursProspects: 0, totalImpayes: 0,
  });
  const [topLocataires, setTopLocataires] = useState<{
    id: string; nom: string; prenom: string; indice_fiabilite: number; solde_impaye: number; statut: string
  }[]>([]);
  const [investisseurs, setInvestisseurs] = useState<{
    id: string; nom: string; prenom: string; statut: string; total_commissions_versees: number; nb_motos: number
  }[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const [locRes, invRes, motosRes] = await Promise.all([
        supabase.from('locataires').select('id,nom,prenom,indice_fiabilite,solde_impaye,statut').order('indice_fiabilite', { ascending: false }),
        supabase.from('investisseurs').select('id,nom,prenom,statut,total_commissions_versees').order('total_commissions_versees', { ascending: false }),
        supabase.from('motos').select('investisseur_id').not('investisseur_id', 'is', null),
      ]);

      const locs = locRes.data || [];
      const invs = invRes.data || [];
      const motosByInv = (motosRes.data || []).reduce((acc: Record<string, number>, m) => {
        if (m.investisseur_id) acc[m.investisseur_id] = (acc[m.investisseur_id] || 0) + 1;
        return acc;
      }, {});

      setStats({
        locatairesActifs: locs.filter(l => l.statut === 'actif').length,
        locatairesSuspendus: locs.filter(l => l.statut === 'suspendu').length,
        locatairesRecrutement: locs.filter(l => l.statut === 'en_cours_recrutement').length,
        investisseursActifs: invs.filter(i => i.statut === 'actif').length,
        investisseursProspects: invs.filter(i => i.statut === 'prospect').length,
        totalImpayes: locs.reduce((s, l) => s + Number(l.solde_impaye), 0),
      });

      setTopLocataires(locs.slice(0, 6));
      setInvestisseurs(invs.slice(0, 5).map(inv => ({
        ...inv,
        nb_motos: motosByInv[inv.id] || 0,
      })));
    };

    fetch();
    const sub = supabase.channel('drh-dash')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locataires' }, fetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investisseurs' }, fetch)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const reliabilityColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Locataires actifs" value={stats.locatairesActifs} icon={Users} color="green" />
        <StatCard label="Suspendus" value={stats.locatairesSuspendus} icon={AlertTriangle} color={stats.locatairesSuspendus > 0 ? 'red' : 'gray'} />
        <StatCard label="En recrutement" value={stats.locatairesRecrutement} icon={UserPlus} color="blue" />
        <StatCard label="Investisseurs actifs" value={stats.investisseursActifs} icon={Building2} color="navy" />
        <StatCard label="Prospects" value={stats.investisseursProspects} icon={UserPlus} color="orange" />
        <StatCard label="Total impayés locataires" value={formatCFA(stats.totalImpayes)} icon={AlertTriangle} color={stats.totalImpayes > 0 ? 'red' : 'gray'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Locataires par fiabilité */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-[#1B2A4A] mb-4 flex items-center gap-2">
            <Star size={18} className="text-[#F5821F]" /> Locataires — Indice de fiabilité
          </h3>
          <div className="space-y-3">
            {topLocataires.map(l => (
              <div key={l.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#1B2A4A]/10 flex items-center justify-center text-xs font-bold text-[#1B2A4A] flex-shrink-0">
                    {l.prenom[0]}{l.nom[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1B2A4A] truncate">{l.prenom} {l.nom}</p>
                    {l.solde_impaye > 0 && (
                      <p className="text-xs text-red-500">Impayé : {formatCFA(Number(l.solde_impaye))}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${l.indice_fiabilite >= 90 ? 'bg-emerald-500' : l.indice_fiabilite >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${l.indice_fiabilite}%` }}
                    />
                  </div>
                  <span className={`text-sm font-bold ${reliabilityColor(l.indice_fiabilite)}`}>{l.indice_fiabilite}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Investisseurs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-[#1B2A4A] mb-4 flex items-center gap-2">
            <Building2 size={18} className="text-[#F5821F]" /> Investisseurs partenaires
          </h3>
          <div className="space-y-2">
            {investisseurs.map(inv => (
              <div key={inv.id} className="flex items-center justify-between p-3 bg-[#F7F8FA] rounded-xl border border-gray-100">
                <div>
                  <p className="text-sm font-semibold text-[#1B2A4A]">{inv.prenom} {inv.nom}</p>
                  <p className="text-xs text-gray-500">{inv.nb_motos} moto(s) confiée(s)</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-emerald-600">{formatCFA(Number(inv.total_commissions_versees))}</p>
                  <p className="text-xs text-gray-400">commissions versées</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    inv.statut === 'actif' ? 'bg-green-100 text-green-700' :
                    inv.statut === 'prospect' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {inv.statut}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
