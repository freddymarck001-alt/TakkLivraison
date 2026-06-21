import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Reparation, formatCFA, formatDate } from '../../../lib/types';
import { WrenchIcon as Wrench, Plus, Save, X, CheckCircle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

const STATUT_COLORS: Record<string, string> = {
  en_cours: 'bg-orange-100 text-orange-800',
  termine: 'bg-green-100 text-green-800',
  en_attente_pieces: 'bg-yellow-100 text-yellow-800',
};

// L'imputation de la réparation est stockée dans "notes" sous la forme [imputation:amortissement]
// pour éviter de modifier la base de données.
const lireImputation = (notes: string | null | undefined): string => {
  const m = (notes || '').match(/^\[imputation:(amortissement|ca_brut)\]/);
  return m ? m[1] : 'ca_brut';
};
const composerNotesRep = (imputation: string, notes: string): string => {
  return `[imputation:${imputation}] ${notes || ''}`.trim();
};

export default function RepairsPage() {
  const { profile } = useAuth();
  const [reps, setReps] = useState<(Reparation & { motos?: { matricule: string } })[]>([]);
  const [motos, setMotos] = useState<{ id: string; matricule: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ moto_id: '', description: '', date_debut: new Date().toISOString().split('T')[0], cout: 0, imputation: 'ca_brut', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    const { data } = await supabase.from('reparations').select('*, motos(matricule)').order('date_debut', { ascending: false });
    if (data) setReps(data as typeof reps);
    setLoading(false);
  };

  useEffect(() => {
    fetch();
    supabase.from('motos').select('id,matricule').order('matricule').then(({ data }) => setMotos(data || []));
    const sub = supabase.channel('reps').on('postgres_changes', { event: '*', schema: 'public', table: 'reparations' }, fetch).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { imputation, notes, ...rest } = form;
    const { data: newRep } = await supabase.from('reparations').insert({ ...rest, notes: composerNotesRep(imputation, notes), statut: 'en_cours' }).select().single();
    if (newRep) {
      await supabase.from('motos').update({ statut: 'en_panne' }).eq('id', form.moto_id);
      await supabase.from('audit_logs').insert({
        user_email: profile?.email, user_role: profile?.role,
        action: 'Ouverture réparation', table_concernee: 'reparations',
        details: { moto: form.moto_id, cout: form.cout, imputation },
      });
    }
    setSaving(false);
    setShowForm(false);
    setForm({ moto_id: '', description: '', date_debut: new Date().toISOString().split('T')[0], cout: 0, imputation: 'ca_brut', notes: '' });
    fetch();
  };

  const handleTerminer = async (rep: Reparation & { motos?: { matricule: string } }) => {
    await supabase.from('reparations').update({ statut: 'termine', date_fin: new Date().toISOString().split('T')[0] }).eq('id', rep.id);
    if (rep.moto_id) await supabase.from('motos').update({ statut: 'active' }).eq('id', rep.moto_id);

    // Déduction du coût selon l'imputation choisie, sur la période de la réparation
    const cout = Number(rep.cout);
    const imputation = lireImputation(rep.notes);
    if (cout > 0) {
      const periode = (rep.date_debut || new Date().toISOString()).slice(0, 7);
      const { data: reinv } = await supabase.from('reinvestissement').select('*').eq('periode', periode).maybeSingle();
      if (reinv) {
        if (imputation === 'amortissement') {
          // Déduction directe du compte d'amortissement déjà constitué (20%)
          await supabase.from('reinvestissement').update({
            solde_amortissement: Math.max(Number(reinv.solde_amortissement) - cout, 0),
          }).eq('periode', periode);
        } else {
          // Sur CA brut : la dépense réduit le revenu NET, puis on recalcule 80% / 20% sur ce nouveau net.
          // Ordre : recettes brutes − charges − réparations = revenu net → 80% réinvest, 20% amortissement.
          const nouvellesCharges = Number(reinv.charges_roulement) + cout;
          const nouveauNet = Math.max(Number(reinv.recettes_brutes) - nouvellesCharges, 0);
          await supabase.from('reinvestissement').update({
            charges_roulement: nouvellesCharges,
            revenu_net: nouveauNet,
            solde_reinvest: nouveauNet * 0.8,
            solde_amortissement: nouveauNet * 0.2,
          }).eq('periode', periode);
        }
      }
      await supabase.from('audit_logs').insert({
        user_email: profile?.email, user_role: profile?.role,
        action: 'Clôture réparation', table_concernee: 'reparations',
        reference_id: rep.id,
        details: { cout, imputation },
      });
    }
    fetch();
  };

  const totalCout = reps.filter(r => r.statut !== 'termine').reduce((s, r) => s + Number(r.cout), 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-orange-600 text-white rounded-xl p-4">
          <p className="text-xs opacity-70">En cours</p>
          <p className="text-3xl font-bold">{reps.filter(r => r.statut === 'en_cours').length}</p>
        </div>
        <div className="bg-yellow-600 text-white rounded-xl p-4">
          <p className="text-xs opacity-70">Attente pièces</p>
          <p className="text-3xl font-bold">{reps.filter(r => r.statut === 'en_attente_pieces').length}</p>
        </div>
        <div className="bg-[#F5821F] text-white rounded-xl p-4">
          <p className="text-xs opacity-70">Coût total en cours</p>
          <p className="text-xl font-bold">{formatCFA(totalCout)}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#1B2A4A] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#243660]">
          <Plus size={16} /> Ouvrir une réparation
        </button>
      </div>

      <div className="space-y-3">
        {reps.map(r => {
          const moto = (r.motos as unknown as { matricule: string })?.matricule || '—';
          return (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-sm font-bold text-[#1B2A4A]">{moto}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_COLORS[r.statut]}`}>{r.statut.replace('_', ' ')}</span>
                </div>
                <p className="text-sm text-gray-700">{r.description}</p>
                <div className="flex gap-4 text-xs text-gray-500 mt-1 flex-wrap">
                  <span>Début : {formatDate(r.date_debut)}</span>
                  {r.date_fin && <span>Fin : {formatDate(r.date_fin)}</span>}
                  <span>Coût : <strong>{formatCFA(Number(r.cout))}</strong></span>
                  <span className={`font-semibold px-2 py-0.5 rounded-full ${lireImputation(r.notes) === 'amortissement' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {lireImputation(r.notes) === 'amortissement' ? 'Sur amortissement (20%)' : 'Sur CA brut'}
                  </span>
                </div>
              </div>
              {r.statut !== 'termine' && (
                <button onClick={() => handleTerminer(r)}
                  className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-emerald-700 transition flex-shrink-0">
                  <CheckCircle size={14} /> Terminer
                </button>
              )}
            </div>
          );
        })}
        {reps.length === 0 && !loading && (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <CheckCircle size={40} className="mx-auto text-emerald-400 mb-3" />
            <p className="text-gray-400">Aucune réparation en cours</p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-[#1B2A4A] flex items-center gap-2"><Wrench size={18} className="text-[#F5821F]" /> Ouvrir une réparation</h3>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-500" /></button>
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
                <label className="block text-xs font-semibold text-gray-500 mb-1">Description *</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Date début</label>
                  <input type="date" value={form.date_debut} onChange={e => setForm({ ...form, date_debut: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Coût estimé (FCFA)</label>
                  <input type="number" value={form.cout} onChange={e => setForm({ ...form, cout: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Imputation du coût *</label>
                <select value={form.imputation} onChange={e => setForm({ ...form, imputation: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]">
                  <option value="ca_brut">Déduire du chiffre d'affaires brut</option>
                  <option value="amortissement">Déduire des 20% d'amortissement</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">La déduction sera appliquée à la clôture de la réparation.</p>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Annuler</button>
              <button onClick={handleSave} disabled={saving || !form.moto_id || !form.description}
                className="px-5 py-2.5 rounded-xl bg-[#1B2A4A] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
                <Save size={15} /> {saving ? 'Enregistrement...' : 'Ouvrir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
