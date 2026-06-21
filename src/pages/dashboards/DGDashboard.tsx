import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatCFA } from '../../lib/types';
import StatCard from '../../components/StatCard';
import { Bike, DollarSign, Users, TrendingUp, Target, AlertTriangle, CheckCircle, Building2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const TARGET_MOTOS = 500;
const START_DATE = new Date('2026-05-01');

export default function DGDashboard() {
  const [stats, setStats] = useState({
    totalMotos: 0, activeMotos: 0, panneMotos: 0,
    totalLocataires: 0, totalInvestisseurs: 0,
    recettesMois: 0, recettesAnnee: 0,
    impayes: 0, soldeReinvest: 0, revenuNetMois: 0,
  });
  const [revenuData, setRevenuData] = useState<{ mois: string; recettes: number }[]>([]);
  const [motosDistrib, setMotosDistrib] = useState<{ name: string; value: number; color: string }[]>([]);
  const [notifications, setNotifications] = useState<{ id: string; titre: string; type: string; message: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [motosRes, locRes, invRes, recRes, notifRes, reinvRes] = await Promise.all([
          supabase.from('motos').select('statut, proprietaire'),
          supabase.from('locataires').select('id', { count: 'exact', head: true }).eq('statut', 'actif'),
          supabase.from('investisseurs').select('id', { count: 'exact', head: true }).eq('statut', 'actif'),
          supabase.from('recettes').select('montant_recu, montant_attendu, statut, semaine_debut'),
          supabase.from('notifications').select('id, titre, type, message').eq('lue', false).order('created_at', { ascending: false }).limit(5),
          supabase.from('reinvestissement').select('*').order('periode', { ascending: true }),
        ]);

        const motos = motosRes.data || [];
        const recettes = recRes.data || [];
        const reinvData = reinvRes.data || [];

        const now = new Date();
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const thisYear = String(now.getFullYear());

        const recMois = recettes
          .filter(r => r.semaine_debut?.startsWith(thisMonth))
          .reduce((sum, r) => sum + Number(r.montant_recu), 0);
        const recAnnee = recettes
          .filter(r => r.semaine_debut?.startsWith(thisYear))
          .reduce((sum, r) => sum + Number(r.montant_recu), 0);
        const impayes = recettes
          .filter(r => r.statut === 'impaye' || r.statut === 'partiel')
          .reduce((sum, r) => sum + (Number(r.montant_attendu) - Number(r.montant_recu)), 0);

        setStats({
          totalMotos: motos.length,
          activeMotos: motos.filter(m => m.statut === 'active').length,
          panneMotos: motos.filter(m => m.statut === 'en_panne').length,
          totalLocataires: locRes.count ?? 0,
          totalInvestisseurs: invRes.count ?? 0,
          recettesMois: recMois,
          recettesAnnee: recAnnee,
          impayes,
          soldeReinvest: Number(reinvData[reinvData.length - 1]?.solde_reinvest ?? 0),
          revenuNetMois: recMois,
        });

        setRevenuData(reinvData.map(r => ({
          mois: r.periode,
          recettes: Number(r.recettes_brutes),
        })));

        setMotosDistrib([
          { name: 'Actives', value: motos.filter(m => m.statut === 'active').length, color: '#10b981' },
          { name: 'En panne', value: motos.filter(m => m.statut === 'en_panne').length, color: '#ef4444' },
          { name: 'Immobilisées', value: motos.filter(m => m.statut === 'immobilisee').length, color: '#f59e0b' },
          { name: 'Disponibles', value: motos.filter(m => m.statut === 'disponible').length, color: '#3b82f6' },
        ].filter(d => d.value > 0));

        setNotifications(notifRes.data || []);
      } catch (e) {
        console.error('Erreur chargement tableau de bord', e);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();

    const sub = supabase.channel('dg-dash')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'motos' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recettes' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reinvestissement' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const progress = Math.min((stats.totalMotos / TARGET_MOTOS) * 100, 100);
  const monthsElapsed = Math.floor((new Date().getTime() - START_DATE.getTime()) / (1000 * 60 * 60 * 24 * 30));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-[#F5821F] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Flotte totale" value={stats.totalMotos} sub={`${stats.activeMotos} actives, ${stats.panneMotos} en panne`} icon={Bike} color="navy" />
        <StatCard label="Recettes ce mois" value={formatCFA(stats.recettesMois)} sub="Recettes encaissées" icon={DollarSign} color="orange" />
        <StatCard label="Locataires actifs" value={stats.totalLocataires} sub={`${stats.totalInvestisseurs} investisseurs`} icon={Users} color="green" />
        <StatCard label="Impayés en cours" value={formatCFA(stats.impayes)} sub="À recouvrir" icon={AlertTriangle} color={stats.impayes > 0 ? 'red' : 'gray'} />
      </div>

      {/* Progress toward 500 motos */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target size={20} className="text-[#F5821F]" />
            <h3 className="font-bold text-[#1B2A4A]">Objectif 500 motos — Progression</h3>
          </div>
          <span className="text-sm font-bold text-[#F5821F]">{stats.totalMotos} / {TARGET_MOTOS}</span>
        </div>
        <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#1B2A4A] to-[#F5821F] rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow">
            {progress.toFixed(1)}%
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>Démarrage : mai 2026</span>
          <span>Objectif : 3 ans</span>
          <span>{TARGET_MOTOS - stats.totalMotos} motos restantes</span>
          <span>~{monthsElapsed} mois écoulés</span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Revenue trend */}
        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-[#1B2A4A] mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-[#F5821F]" /> Évolution des recettes mensuelles
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenuData}>
              <defs>
                <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F5821F" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F5821F" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatCFA(v)} />
              <Area type="monotone" dataKey="recettes" stroke="#F5821F" strokeWidth={2} fill="url(#colorRec)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Fleet distribution */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-[#1B2A4A] mb-4 flex items-center gap-2">
            <Bike size={18} className="text-[#F5821F]" /> Statut de la flotte
          </h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={motosDistrib} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                {motosDistrib.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {motosDistrib.map(d => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-gray-600">{d.name}</span>
                </div>
                <span className="font-bold text-[#1B2A4A]">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Solde réinvest */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-[#1B2A4A] mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-[#F5821F]" /> Solde de réinvestissement
          </h3>
          <div className="text-3xl font-bold text-[#1B2A4A] mb-2">{formatCFA(stats.soldeReinvest)}</div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#F5821F] to-[#1B2A4A] rounded-full transition-all"
              style={{ width: `${Math.min((stats.soldeReinvest / 670000) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {stats.soldeReinvest >= 670000
              ? <span className="text-emerald-600 font-semibold">✓ Achat d'une moto possible (670 000 FCFA)</span>
              : `${formatCFA(670000 - stats.soldeReinvest)} manquants pour le prochain achat`
            }
          </p>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-[#1B2A4A] mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-[#F5821F]" /> Alertes récentes
          </h3>
          {notifications.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle size={32} className="mx-auto text-emerald-400 mb-2" />
              <p className="text-sm text-gray-500">Aucune alerte en cours</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map(n => (
                <div key={n.id} className={`flex items-start gap-3 p-3 rounded-xl border ${
                  n.type === 'urgence' ? 'border-red-200 bg-red-50' :
                  n.type === 'alerte' ? 'border-orange-200 bg-orange-50' :
                  'border-blue-200 bg-blue-50'
                }`}>
                  <AlertTriangle size={14} className={`flex-shrink-0 mt-0.5 ${
                    n.type === 'urgence' ? 'text-red-500' :
                    n.type === 'alerte' ? 'text-orange-500' : 'text-blue-500'
                  }`} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{n.titre}</p>
                    <p className="text-xs text-gray-500 truncate">{n.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modules rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Recettes annuelles" value={formatCFA(stats.recettesAnnee)} icon={DollarSign} color="navy" />
        <StatCard label="Valeur flotte" value={formatCFA(stats.totalMotos * 670000)} sub="670 000 FCFA/moto" icon={Bike} color="gray" />
        <StatCard label="Investisseurs" value={stats.totalInvestisseurs} sub="Partenaires actifs" icon={Building2} color="orange" />
        <StatCard
          label="Revenu net estimé"
          value={formatCFA(stats.revenuNetMois)}
          sub="Recettes nettes encaissées ce mois"
          icon={TrendingUp}
          color="green"
        />
      </div>
    </div>
  );
}
