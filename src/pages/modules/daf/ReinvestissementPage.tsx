import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Reinvestissement, formatCFA } from '../../../lib/types';
import { TrendingUp, Target, Bike } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function ReinvestissementPage() {
  const [data, setData] = useState<Reinvestissement[]>([]);
  const [totalMotos, setTotalMotos] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [reinvRes, motosRes] = await Promise.all([
        supabase.from('reinvestissement').select('*').order('periode'),
        supabase.from('motos').select('id', { count: 'exact', head: true }),
      ]);
      if (reinvRes.data) setData(reinvRes.data as Reinvestissement[]);
      setTotalMotos(motosRes.count ?? 0);
      setLoading(false);
    };
    fetch();
    const sub = supabase.channel('reinvest')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reinvestissement' }, fetch)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const last = data[data.length - 1];
  const totalReinvest = data.reduce((s, r) => s + Number(r.solde_reinvest), 0);
  const totalAmort = data.reduce((s, r) => s + Number(r.solde_amortissement), 0);
  const totalMotosAchetes = data.reduce((s, r) => s + r.motos_achetees, 0);
  const progressAchat = last ? Math.min((Number(last.solde_reinvest) / 670000) * 100, 100) : 0;

  const chartData = data.map(r => ({
    periode: r.periode,
    recettes: Number(r.recettes_brutes),
    reinvest: Number(r.solde_reinvest),
    amort: Number(r.solde_amortissement),
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1B2A4A] text-white rounded-xl p-4">
          <p className="text-xs opacity-70 uppercase tracking-wider">Solde réinvest. actuel</p>
          <p className="text-2xl font-bold mt-1">{formatCFA(last ? Number(last.solde_reinvest) : 0)}</p>
          <p className="text-xs opacity-60 mt-1">80% du revenu net</p>
        </div>
        <div className="bg-[#F5821F] text-white rounded-xl p-4">
          <p className="text-xs opacity-70 uppercase tracking-wider">Compte amortissement</p>
          <p className="text-2xl font-bold mt-1">{formatCFA(last ? Number(last.solde_amortissement) : 0)}</p>
          <p className="text-xs opacity-60 mt-1">20% du revenu net</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Motos achetées via réinvest.</p>
          <p className="text-2xl font-bold text-[#1B2A4A] mt-1">{totalMotosAchetes}</p>
          <p className="text-xs text-gray-400 mt-1">depuis le début</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Flotte totale</p>
          <p className="text-2xl font-bold text-[#1B2A4A] mt-1">{totalMotos}</p>
          <p className="text-xs text-gray-400 mt-1">/ 500 objectif</p>
        </div>
      </div>

      {/* Achat progress */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[#1B2A4A] flex items-center gap-2">
            <Target size={18} className="text-[#F5821F]" /> Solde d'achat — Prochain achat de moto
          </h3>
          <span className="text-sm text-[#F5821F] font-bold">{formatCFA(last ? Number(last.solde_reinvest) : 0)} / 670 000 FCFA</span>
        </div>
        <div className="h-6 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-[#F5821F] to-[#1B2A4A] rounded-full transition-all duration-700"
            style={{ width: `${progressAchat}%` }}
          />
        </div>
        {last && Number(last.solde_reinvest) >= 670000 ? (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-4 py-2.5 rounded-xl text-sm font-semibold border border-emerald-200">
            <Bike size={16} />
            Solde suffisant ! Achat de {Math.floor(Number(last.solde_reinvest) / 670000)} moto(s) possible.
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            {formatCFA(670000 - (last ? Number(last.solde_reinvest) : 0))} manquants pour le prochain achat
          </p>
        )}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-[#1B2A4A] mb-4 flex items-center gap-2">
          <TrendingUp size={18} className="text-[#F5821F]" /> Historique mensuel (Recettes · Réinvest. · Amortissement)
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="periode" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => formatCFA(v)} />
            <Legend />
            <Bar dataKey="recettes" name="Recettes brutes" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
            <Bar dataKey="reinvest" name="Solde réinvest. (80%)" fill="#F5821F" radius={[4, 4, 0, 0]} />
            <Bar dataKey="amort" name="Amortissement (20%)" fill="#1B2A4A" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#1B2A4A]">Tableau de réinvestissement mensuel</h3>
          <p className="text-xs text-gray-500 mt-0.5">Répartition 80% achat · 20% amortissement du revenu net (recettes − charges)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F7F8FA] border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500">Période</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-500">Recettes brutes</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-500">Charges roulement</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-500">Revenu net</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-500">Solde réinvest. (80%)</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-500">Amortissement (20%)</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-gray-500">Motos achetées</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((r, i) => (
                <tr key={r.id} className={`border-b border-gray-50 ${i % 2 ? 'bg-gray-50/20' : ''}`}>
                  <td className="px-4 py-3 font-bold text-[#1B2A4A]">{r.periode}</td>
                  <td className="px-4 py-3 text-right text-sm font-mono text-gray-700">{formatCFA(Number(r.recettes_brutes))}</td>
                  <td className="px-4 py-3 text-right text-sm font-mono text-red-600">−{formatCFA(Number(r.charges_roulement))}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold font-mono text-[#1B2A4A]">{formatCFA(Number(r.revenu_net))}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold font-mono text-[#F5821F]">{formatCFA(Number(r.solde_reinvest))}</td>
                  <td className="px-4 py-3 text-right text-sm font-mono text-blue-700">{formatCFA(Number(r.solde_amortissement))}</td>
                  <td className="px-4 py-3 text-center">
                    {r.motos_achetees > 0 ? (
                      <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded-full">+{r.motos_achetees} moto(s)</span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
              {data.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-gray-400">Aucune donnée</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
