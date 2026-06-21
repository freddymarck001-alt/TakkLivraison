import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatCFA } from '../../../lib/types';
import { BarChart3, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function DGReportsPage() {
  const [data, setData] = useState({
    totalMotos: 0, activeMotos: 0, totalLocataires: 0,
    totalInvestisseurs: 0, recettesAnnee: 0, impayes: 0,
    capitalPrets: 0,
  });
  const [reinvHistory, setReinvHistory] = useState<{ periode: string; recettes: number; reinvest: number; amort: number }[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const year = new Date().getFullYear().toString();
      const [motosRes, locRes, invRes, recRes, reinvRes, pretsRes] = await Promise.all([
        supabase.from('motos').select('statut'),
        supabase.from('locataires').select('id', { count: 'exact', head: true }).eq('statut', 'actif'),
        supabase.from('investisseurs').select('id', { count: 'exact', head: true }).eq('statut', 'actif'),
        supabase.from('recettes').select('montant_recu,montant_attendu,statut,semaine_debut'),
        supabase.from('reinvestissement').select('*').order('periode'),
        supabase.from('prets').select('capital_restant').eq('statut', 'en_cours'),
      ]);
      const motos = motosRes.data || [];
      const recettes = recRes.data || [];
      const recAnnee = recettes.filter(r => r.semaine_debut?.startsWith(year)).reduce((s, r) => s + Number(r.montant_recu), 0);
      const impayes = recettes.filter(r => r.statut === 'impaye').reduce((s, r) => s + (Number(r.montant_attendu) - Number(r.montant_recu)), 0);
      const capitalPrets = (pretsRes.data || []).reduce((s, p) => s + Number(p.capital_restant), 0);
      setData({
        totalMotos: motos.length,
        activeMotos: motos.filter(m => m.statut === 'active').length,
        totalLocataires: locRes.count ?? 0,
        totalInvestisseurs: invRes.count ?? 0,
        recettesAnnee: recAnnee,
        impayes,
        capitalPrets,
      });
      setReinvHistory((reinvRes.data || []).map(r => ({
        periode: r.periode,
        recettes: Number(r.recettes_brutes),
        reinvest: Number(r.solde_reinvest),
        amort: Number(r.solde_amortissement),
      })));
    };
    fetch();
    const sub = supabase.channel('dg-reports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recettes' }, fetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reinvestissement' }, fetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'motos' }, fetch)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const kpis = [
    { label: 'Flotte totale', value: `${data.totalMotos} motos`, sub: `${data.activeMotos} actives`, bg: 'bg-[#1B2A4A]', txt: 'text-white', subTxt: 'text-blue-200' },
    { label: 'Locataires actifs', value: data.totalLocataires, bg: 'bg-emerald-600', txt: 'text-white', subTxt: 'text-emerald-100' },
    { label: 'Investisseurs', value: data.totalInvestisseurs, bg: 'bg-[#F5821F]', txt: 'text-white', subTxt: 'text-orange-100' },
    { label: 'Recettes annuelles', value: formatCFA(data.recettesAnnee), bg: 'bg-teal-600', txt: 'text-white', subTxt: 'text-teal-100' },
    { label: 'Impayés', value: formatCFA(data.impayes), alert: data.impayes > 0, bg: data.impayes > 0 ? 'bg-red-600' : 'bg-gray-500', txt: 'text-white', subTxt: 'text-red-100' },
    { label: 'Capital prêts restant', value: formatCFA(data.capitalPrets), bg: 'bg-purple-600', txt: 'text-white', subTxt: 'text-purple-100' },
    { label: 'Valeur flotte', value: formatCFA(data.totalMotos * 670000), bg: 'bg-indigo-600', txt: 'text-white', subTxt: 'text-indigo-100' },
    { label: 'Revenu net estimé/mois', value: formatCFA(data.recettesAnnee), bg: 'bg-cyan-600', txt: 'text-white', subTxt: 'text-cyan-100' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition">
          <Download size={16} /> Exporter (PDF / Excel)
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className={`rounded-xl p-4 shadow-sm ${k.bg}`}>
            <p className={`text-xs uppercase tracking-wider mb-1 ${k.subTxt} opacity-90`}>{k.label}</p>
            <p className={`text-xl font-bold ${k.txt} break-words leading-tight`}>{k.value}</p>
            {k.sub && <p className={`text-xs mt-0.5 ${k.subTxt}`}>{k.sub}</p>}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-[#1B2A4A] mb-4 flex items-center gap-2">
          <BarChart3 size={18} className="text-[#F5821F]" /> Recettes vs Réinvestissement mensuel
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={reinvHistory} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="periode" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => formatCFA(v)} />
            <Legend />
            <Bar dataKey="recettes" name="Recettes brutes" fill="#1B2A4A" radius={[4, 4, 0, 0]} />
            <Bar dataKey="reinvest" name="Réinvestissement" fill="#F5821F" radius={[4, 4, 0, 0]} />
            <Bar dataKey="amort" name="Amortissement" fill="#14b8a6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-[#1B2A4A] mb-3">Objectif stratégique 3 ans</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#F7F8FA] rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Démarrage</p>
            <p className="font-bold text-[#1B2A4A]">Mai 2026</p>
            <p className="text-xs text-gray-400">1ère moto acquise</p>
          </div>
          <div className="bg-[#F7F8FA] rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Aujourd'hui</p>
            <p className="font-bold text-[#1B2A4A]">{data.totalMotos} motos</p>
            <p className="text-xs text-gray-400">{((data.totalMotos / 500) * 100).toFixed(1)}% de l'objectif</p>
          </div>
          <div className="bg-[#1B2A4A] rounded-xl p-4 text-white">
            <p className="text-xs opacity-70 mb-1">Objectif</p>
            <p className="font-bold text-2xl">500 motos</p>
            <p className="text-xs opacity-70">Mai 2029</p>
          </div>
        </div>
      </div>
    </div>
  );
}
