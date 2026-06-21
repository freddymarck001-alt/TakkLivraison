import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatCFA } from '../../lib/types';
import StatCard from '../../components/StatCard';
import { DollarSign, TrendingUp, AlertTriangle, CreditCard, Building2, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function DAFDashboard() {
  const [stats, setStats] = useState({
    recettesMois: 0, recettesHier: 0,
    impayes: 0, nbImpayes: 0,
    soldeReinvest: 0, soldeAmort: 0,
    capitalPrets: 0, nbPrets: 0,
    activeMotos: 0,
  });
  const [revenuWeekly, setRevenuWeekly] = useState<{ sem: string; recu: number; attendu: number }[]>([]);
  const [reinvHistory, setReinvHistory] = useState<{ periode: string; soldeReinvest: number; soldeAmort: number }[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const [recRes, reinvRes, pretsRes, motosRes] = await Promise.all([
        supabase.from('recettes').select('montant_recu, montant_attendu, statut, semaine_debut').order('semaine_debut', { ascending: false }),
        supabase.from('reinvestissement').select('*').order('periode'),
        supabase.from('prets').select('capital_restant, statut').eq('statut', 'en_cours'),
        supabase.from('motos').select('id', { count: 'exact', head: true }).eq('statut', 'active'),
      ]);

      const recettes = recRes.data || [];
      const reinv = reinvRes.data || [];

      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const recMois = recettes.filter(r => r.semaine_debut?.startsWith(thisMonth))
        .reduce((s, r) => s + Number(r.montant_recu), 0);
      const impayes = recettes.filter(r => r.statut === 'impaye' || r.statut === 'partiel')
        .reduce((s, r) => s + (Number(r.montant_attendu) - Number(r.montant_recu)), 0);
      const nbImpayes = recettes.filter(r => r.statut === 'impaye').length;
      const capitalPrets = (pretsRes.data || []).reduce((s, p) => s + Number(p.capital_restant), 0);
      const lastReinv = reinv[reinv.length - 1];

      setStats({
        recettesMois: recMois,
        recettesHier: 0,
        impayes,
        nbImpayes,
        soldeReinvest: lastReinv?.solde_reinvest ?? 0,
        soldeAmort: lastReinv?.solde_amortissement ?? 0,
        capitalPrets,
        nbPrets: pretsRes.data?.length ?? 0,
        activeMotos: motosRes.count ?? 0,
      });

      // Weekly revenue (last 6 weeks)
      const weekMap = new Map<string, { recu: number; attendu: number }>();
      recettes.slice(0, 30).forEach(r => {
        const k = r.semaine_debut?.slice(0, 10) || '';
        if (!weekMap.has(k)) weekMap.set(k, { recu: 0, attendu: 0 });
        const w = weekMap.get(k)!;
        w.recu += Number(r.montant_recu);
        w.attendu += Number(r.montant_attendu);
      });
      setRevenuWeekly(
        Array.from(weekMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-6)
          .map(([k, v]) => ({ sem: k.slice(5), recu: v.recu, attendu: v.attendu }))
      );

      setReinvHistory(reinv.map(r => ({
        periode: r.periode,
        soldeReinvest: Number(r.solde_reinvest),
        soldeAmort: Number(r.solde_amortissement),
      })));
    };

    fetch();
    const sub = supabase.channel('daf-dash')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recettes' }, fetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reinvestissement' }, fetch)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const progressAchat = Math.min((stats.soldeReinvest / 670000) * 100, 100);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Recettes ce mois" value={formatCFA(stats.recettesMois)} icon={DollarSign} color="navy" />
        <StatCard label="Impayés" value={formatCFA(stats.impayes)} sub={`${stats.nbImpayes} dossier(s)`} icon={AlertTriangle} color={stats.impayes > 0 ? 'red' : 'gray'} />
        <StatCard label="Solde réinvest." value={formatCFA(stats.soldeReinvest)} icon={TrendingUp} color="orange" />
        <StatCard label="Capital prêts restant" value={formatCFA(stats.capitalPrets)} sub={`${stats.nbPrets} prêt(s) actif(s)`} icon={CreditCard} color="blue" />
      </div>

      {/* Achat progress */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-[#F5821F]" />
            <h3 className="font-bold text-[#1B2A4A]">Solde d'achat (objectif 670 000 FCFA)</h3>
          </div>
          <span className="text-xs font-semibold text-[#F5821F]">{formatCFA(stats.soldeReinvest)}</span>
        </div>
        <div className="h-4 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-gradient-to-r from-[#F5821F] to-[#1B2A4A] rounded-full transition-all"
            style={{ width: `${progressAchat}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span className="font-semibold text-emerald-600">80% → Achat motos</span>
          <span className="font-semibold text-blue-600">20% → Amortissement ({formatCFA(stats.soldeAmort)})</span>
        </div>
        {stats.soldeReinvest >= 670000 && (
          <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-emerald-700">
            ✓ Solde suffisant pour acheter {Math.floor(stats.soldeReinvest / 670000)} moto(s) !
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Weekly Revenue */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-[#1B2A4A] mb-4 flex items-center gap-2">
            <DollarSign size={18} className="text-[#F5821F]" /> Recettes vs Attendu (par semaine)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenuWeekly} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="sem" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => formatCFA(v)} />
              <Bar dataKey="attendu" name="Attendu" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="recu" name="Reçu" fill="#F5821F" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Reinvestissement history */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-[#1B2A4A] mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-[#F5821F]" /> Évolution des soldes
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={reinvHistory}>
              <defs>
                <linearGradient id="gr1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F5821F" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F5821F" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gr2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1B2A4A" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1B2A4A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="periode" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => formatCFA(v)} />
              <Area type="monotone" dataKey="soldeReinvest" name="Réinvest." stroke="#F5821F" fill="url(#gr1)" strokeWidth={2} />
              <Area type="monotone" dataKey="soldeAmort" name="Amortiss." stroke="#1B2A4A" fill="url(#gr2)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Revenu net/moto/mois" value={formatCFA(100000)} sub="Référence TAKK" icon={DollarSign} color="gray" />
        <StatCard label="Revenu net total estimé" value={formatCFA(stats.activeMotos * 100000)} sub={`${stats.activeMotos} motos actives`} icon={TrendingUp} color="green" />
        <StatCard label="Compte amortissement" value={formatCFA(stats.soldeAmort)} sub="Assurances, vignettes, réparations" icon={Building2} color="navy" />
      </div>
    </div>
  );
}
