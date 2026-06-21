import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Recette, formatCFA, formatDate } from '../../../lib/types';
import { DollarSign, Plus, Search, CheckCircle, AlertTriangle, Clock, Save, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

const STATUT_CONFIG = {
  paye: { label: 'Payé', class: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
  partiel: { label: 'Partiel', class: 'bg-yellow-100 text-yellow-800', icon: Clock },
  en_attente: { label: 'En attente', class: 'bg-blue-100 text-blue-800', icon: Clock },
  impaye: { label: 'Impayé', class: 'bg-red-100 text-red-800', icon: AlertTriangle },
};

export default function RecettesPage() {
  const { profile } = useAuth();
  const [recettes, setRecettes] = useState<Recette[]>([]);
  const [motos, setMotos] = useState<{ id: string; matricule: string }[]>([]);
  const [locataires, setLocataires] = useState<{ id: string; nom: string; prenom: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    moto_id: '', locataire_id: '', semaine_debut: new Date().toISOString().split('T')[0],
    jours_travailles: 5, montant_attendu: 25000, montant_recu: 0, statut: 'en_attente', notes: ''
  });
  const [saving, setSaving] = useState(false);

  const fetchRecettes = async () => {
    const { data } = await supabase
      .from('recettes')
      .select('*, motos(matricule), locataires(nom, prenom)')
      .order('semaine_debut', { ascending: false })
      .limit(100);
    if (data) setRecettes(data as Recette[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchRecettes();
    supabase.from('motos').select('id,matricule').order('matricule').then(({ data }) => setMotos(data || []));
    supabase.from('locataires').select('id,nom,prenom').eq('statut', 'actif').then(({ data }) => setLocataires(data || []));

    const sub = supabase.channel('recettes-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recettes' }, fetchRecettes)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const handleJoursChange = (jours: number) => {
    const montant = jours * 5000;
    setForm({ ...form, jours_travailles: jours, montant_attendu: montant });
  };

  const handleSave = async () => {
    setSaving(true);
    let statut = 'en_attente';
    if (form.montant_recu >= form.montant_attendu) statut = 'paye';
    else if (form.montant_recu > 0) statut = 'partiel';
    else if (form.montant_recu === 0 && form.montant_attendu > 0) statut = 'en_attente';

    await supabase.from('recettes').insert({
      ...form,
      statut,
      locataire_id: form.locataire_id || null,
      date_paiement: form.montant_recu > 0 ? new Date().toISOString() : null,
      created_by: profile?.id,
    });
    await supabase.from('audit_logs').insert({
      user_email: profile?.email, user_role: profile?.role,
      action: 'Saisie recette', table_concernee: 'recettes',
      details: { moto: form.moto_id, montant_recu: form.montant_recu },
    });

    // Déterminer si la moto appartient à TAKK ou à un investisseur
    const { data: motoData } = await supabase
      .from('motos')
      .select('proprietaire')
      .eq('id', form.moto_id)
      .maybeSingle();
    const estInvestisseur = motoData?.proprietaire === 'investisseur';

    // Charges de roulement par moto (10 000 FCFA/mois). On répartit ici sur la recette.
    const CHARGE_ROULEMENT = 10000;
    const net = Math.max(form.montant_recu - CHARGE_ROULEMENT, 0);

    // RÈGLE DE RÉINVESTISSEMENT :
    // - Moto TAKK : 80% du net -> réinvestissement, 20% -> amortissement
    // - Moto investisseur : commission TAKK = 20% du montant reçu, 100% de cette commission -> réinvestissement
    let apportReinvest = 0;
    let apportAmort = 0;
    if (estInvestisseur) {
      apportReinvest = form.montant_recu * 0.2; // commission TAKK 20%, entièrement réinvestie
      apportAmort = 0;
    } else {
      apportReinvest = net * 0.8;
      apportAmort = net * 0.2;
    }

    // Mettre à jour (ou créer) la ligne de réinvestissement du mois
    const periode = form.semaine_debut.slice(0, 7);
    const { data: existing } = await supabase
      .from('reinvestissement')
      .select('*')
      .eq('periode', periode)
      .maybeSingle();

    if (existing) {
      await supabase.from('reinvestissement').update({
        recettes_brutes: Number(existing.recettes_brutes) + form.montant_recu,
        charges_roulement: Number(existing.charges_roulement) + (estInvestisseur ? 0 : CHARGE_ROULEMENT),
        revenu_net: Number(existing.revenu_net) + (estInvestisseur ? 0 : net),
        solde_reinvest: Number(existing.solde_reinvest) + apportReinvest,
        solde_amortissement: Number(existing.solde_amortissement) + apportAmort,
      }).eq('periode', periode);
    } else {
      await supabase.from('reinvestissement').insert({
        periode,
        recettes_brutes: form.montant_recu,
        charges_roulement: estInvestisseur ? 0 : CHARGE_ROULEMENT,
        revenu_net: estInvestisseur ? 0 : net,
        solde_reinvest: apportReinvest,
        solde_amortissement: apportAmort,
        motos_achetees: 0,
      });
    }

    // Si paiement incomplet -> reporter l'impayé sur le locataire + créer une alerte
    const manque = Number(form.montant_attendu) - Number(form.montant_recu);
    if (manque > 0 && form.locataire_id) {
      const { data: loc } = await supabase
        .from('locataires')
        .select('solde_impaye, nom, prenom')
        .eq('id', form.locataire_id)
        .maybeSingle();
      if (loc) {
        await supabase.from('locataires').update({
          solde_impaye: Number(loc.solde_impaye) + manque,
          updated_at: new Date().toISOString(),
        }).eq('id', form.locataire_id);

        await supabase.from('notifications').insert({
          destinataire_role: 'daf',
          titre: 'Impayé détecté',
          message: `${loc.prenom} ${loc.nom} doit ${formatCFA(manque)} (reçu ${formatCFA(form.montant_recu)} sur ${formatCFA(form.montant_attendu)})`,
          type: 'alerte',
        });
      }
    }

    setSaving(false);
    setShowForm(false);
    setForm({ moto_id: '', locataire_id: '', semaine_debut: new Date().toISOString().split('T')[0], jours_travailles: 5, montant_attendu: 25000, montant_recu: 0, statut: 'en_attente', notes: '' });
    fetchRecettes();
  };

  const filtered = recettes.filter(r => {
    const q = search.toLowerCase();
    const moto = (r.motos as unknown as { matricule: string })?.matricule || '';
    const loc = r.locataires ? `${r.locataires.prenom} ${r.locataires.nom}`.toLowerCase() : '';
    return (!search || moto.toLowerCase().includes(q) || loc.includes(q)) &&
      (!filterStatut || r.statut === filterStatut);
  });

  const totalRecu = filtered.reduce((s, r) => s + Number(r.montant_recu), 0);
  const totalAttendu = filtered.reduce((s, r) => s + Number(r.montant_attendu), 0);

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(STATUT_CONFIG).map(([key, cfg]) => {
          const count = recettes.filter(r => r.statut === key).length;
          return (
            <button key={key} onClick={() => setFilterStatut(filterStatut === key ? '' : key)}
              className={`p-3 rounded-xl border text-left transition ${filterStatut === key ? 'border-[#F5821F] bg-orange-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
              <p className="text-2xl font-bold text-[#1B2A4A]">{count}</p>
              <p className="text-xs text-gray-500 mt-0.5">{cfg.label}</p>
            </button>
          );
        })}
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#1B2A4A] text-white rounded-xl p-4">
          <p className="text-xs opacity-70 uppercase tracking-wider">Total attendu</p>
          <p className="text-xl font-bold mt-1">{formatCFA(totalAttendu)}</p>
        </div>
        <div className="bg-[#F5821F] text-white rounded-xl p-4">
          <p className="text-xs opacity-70 uppercase tracking-wider">Total reçu</p>
          <p className="text-xl font-bold mt-1">{formatCFA(totalRecu)}</p>
        </div>
      </div>

      {/* Filters + Add */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Moto, locataire..."
            className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
        </div>
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]">
          <option value="">Tous statuts</option>
          {Object.entries(STATUT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#1B2A4A] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#243660] transition">
          <Plus size={16} /> Saisir recette
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F7F8FA] border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Semaine</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Moto</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Locataire</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Jours</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Attendu</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Reçu</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const cfg = STATUT_CONFIG[r.statut];
                const motoMatricule = (r.motos as unknown as { matricule: string })?.matricule || '—';
                return (
                  <tr key={r.id} className={`border-b border-gray-50 hover:bg-orange-50/30 ${i % 2 ? 'bg-gray-50/20' : ''}`}>
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">{formatDate(r.semaine_debut)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-[#1B2A4A]">{motoMatricule}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {r.locataires ? `${r.locataires.prenom} ${r.locataires.nom}` : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span className="bg-[#1B2A4A] text-white text-xs font-bold px-2 py-1 rounded-full">{r.jours_travailles}/5</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-mono">{formatCFA(Number(r.montant_attendu))}</td>
                    <td className="px-4 py-3 text-sm font-bold text-[#1B2A4A] font-mono">{formatCFA(Number(r.montant_recu))}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.class}`}>{cfg.label}</span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Aucune recette</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-[#1B2A4A] flex items-center gap-2"><DollarSign size={18} className="text-[#F5821F]" /> Saisir une recette</h3>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-500 hover:text-gray-700" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Moto *</label>
                <select value={form.moto_id} onChange={e => setForm({ ...form, moto_id: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]">
                  <option value="">— Sélectionner —</option>
                  {motos.map(m => <option key={m.id} value={m.id}>{m.matricule}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Locataire</label>
                <select value={form.locataire_id} onChange={e => setForm({ ...form, locataire_id: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]">
                  <option value="">— Non assigné —</option>
                  {locataires.map(l => <option key={l.id} value={l.id}>{l.prenom} {l.nom}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Semaine du</label>
                  <input type="date" value={form.semaine_debut} onChange={e => setForm({ ...form, semaine_debut: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Jours travaillés</label>
                  <input type="number" min={0} max={5} value={form.jours_travailles} onChange={e => handleJoursChange(Math.min(parseInt(e.target.value) || 0, 5))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Montant attendu (FCFA)</label>
                  <input type="number" value={form.montant_attendu} onChange={e => setForm({ ...form, montant_attendu: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Montant reçu (FCFA)</label>
                  <input type="number" value={form.montant_recu} onChange={e => setForm({ ...form, montant_recu: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
              </div>
              {form.jours_travailles < 5 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-xs text-orange-800">
                  Règle : {form.jours_travailles} jours travaillés → {formatCFA(form.jours_travailles * 5000)} attendus (au lieu de 25 000)
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
              <button onClick={handleSave} disabled={saving || !form.moto_id}
                className="px-5 py-2.5 rounded-xl bg-[#1B2A4A] text-white text-sm font-semibold flex items-center gap-2 hover:bg-[#243660] disabled:opacity-50">
                <Save size={15} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
