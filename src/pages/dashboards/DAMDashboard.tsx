import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatCFA } from '../../lib/types';
import StatCard from '../../components/StatCard';
import { Wrench, Package, Truck, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export default function DAMDashboard() {
  const [stats, setStats] = useState({
    maintenancesPlanifiees: 0, maintenancesEnCours: 0,
    reparationsEnCours: 0, coutReparations: 0,
    stockBas: 0, totalFournisseurs: 0,
    panneMotos: 0,
  });
  const [urgentMaintenances, setUrgentMaintenances] = useState<{
    id: string; titre: string; statut: string; date_prevue: string | null; moto_matricule: string; cout: number
  }[]>([]);
  const [stockAlerts, setStockAlerts] = useState<{ id: string; nom: string; quantite: number; quantite_min: number }[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const [maintRes, repRes, stockRes, foRes, motosRes] = await Promise.all([
        supabase.from('maintenances').select('id,titre,statut,date_prevue,cout,motos(matricule)').neq('statut', 'annule').order('date_prevue'),
        supabase.from('reparations').select('id,cout,statut').eq('statut', 'en_cours'),
        supabase.from('pieces_stock').select('id,nom,quantite,quantite_min').order('nom'),
        supabase.from('fournisseurs').select('id', { count: 'exact', head: true }).eq('statut', 'actif'),
        supabase.from('motos').select('id', { count: 'exact', head: true }).eq('statut', 'en_panne'),
      ]);

      const maints = maintRes.data || [];
      const reps = repRes.data || [];
      const stock = stockRes.data || [];
      const stockBas = stock.filter(s => s.quantite <= s.quantite_min);

      setStats({
        maintenancesPlanifiees: maints.filter(m => m.statut === 'planifie').length,
        maintenancesEnCours: maints.filter(m => m.statut === 'en_cours').length,
        reparationsEnCours: reps.length,
        coutReparations: reps.reduce((s, r) => s + Number(r.cout), 0),
        stockBas: stockBas.length,
        totalFournisseurs: foRes.count ?? 0,
        panneMotos: motosRes.count ?? 0,
      });

      setUrgentMaintenances(
        maints.filter(m => m.statut !== 'termine').slice(0, 5).map(m => ({
          id: m.id,
          titre: m.titre,
          statut: m.statut,
          date_prevue: m.date_prevue,
          moto_matricule: (m.motos as unknown as { matricule: string })?.matricule || '—',
          cout: Number(m.cout),
        }))
      );

      setStockAlerts(stockBas.slice(0, 5));
    };

    fetch();
    const sub = supabase.channel('dam-dash')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenances' }, fetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pieces_stock' }, fetch)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Motos en panne" value={stats.panneMotos} icon={AlertTriangle} color={stats.panneMotos > 0 ? 'red' : 'gray'} />
        <StatCard label="Maintenances planifiées" value={stats.maintenancesPlanifiees} icon={Clock} color="blue" />
        <StatCard label="Réparations en cours" value={stats.reparationsEnCours} icon={Wrench} color="orange" />
        <StatCard label="Stocks bas" value={stats.stockBas} icon={Package} color={stats.stockBas > 0 ? 'red' : 'green'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Urgent maintenances */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-[#1B2A4A] mb-4 flex items-center gap-2">
            <Wrench size={18} className="text-[#F5821F]" /> Maintenances à venir / en cours
          </h3>
          {urgentMaintenances.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle size={32} className="mx-auto text-emerald-400 mb-2" />
              <p className="text-sm text-gray-500">Aucune maintenance urgente</p>
            </div>
          ) : (
            <div className="space-y-2">
              {urgentMaintenances.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-[#F7F8FA] rounded-xl border border-gray-100">
                  <div>
                    <p className="text-sm font-semibold text-[#1B2A4A]">{m.titre}</p>
                    <p className="text-xs text-gray-500">{m.moto_matricule} · {m.date_prevue || 'Date non fixée'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      m.statut === 'planifie' ? 'bg-blue-100 text-blue-700' :
                      m.statut === 'en_cours' ? 'bg-orange-100 text-orange-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {m.statut}
                    </span>
                    <span className="text-xs font-mono text-gray-500">{formatCFA(m.cout)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stock alerts */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-[#1B2A4A] mb-4 flex items-center gap-2">
            <Package size={18} className="text-[#F5821F]" /> Alertes de stock
          </h3>
          {stockAlerts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle size={32} className="mx-auto text-emerald-400 mb-2" />
              <p className="text-sm text-gray-500">Tous les stocks sont suffisants</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stockAlerts.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                  <div>
                    <p className="text-sm font-semibold text-[#1B2A4A]">{s.nom}</p>
                    <p className="text-xs text-gray-500">Minimum requis : {s.quantite_min} unités</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-red-600">{s.quantite}</span>
                    <p className="text-xs text-red-500">restantes</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Fournisseurs actifs" value={stats.totalFournisseurs} icon={Truck} color="navy" />
        <StatCard label="Coût réparations en cours" value={formatCFA(stats.coutReparations)} icon={Wrench} color="orange" />
        <StatCard label="Maintenances en cours" value={stats.maintenancesEnCours} icon={Clock} color="blue" />
      </div>
    </div>
  );
}
