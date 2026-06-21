import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Locataire, formatCFA, formatDate } from '../../../lib/types';
import { Users, Plus, Search, Star, AlertTriangle, Save, X, Edit2 } from 'lucide-react';

const STATUT_COLORS: Record<string, string> = {
  actif: 'bg-emerald-100 text-emerald-800',
  suspendu: 'bg-red-100 text-red-800',
  termine: 'bg-gray-100 text-gray-600',
  en_cours_recrutement: 'bg-blue-100 text-blue-800',
};

const defaultForm = {
  nom: '', prenom: '', telephone: '', adresse: '', date_recrutement: new Date().toISOString().split('T')[0],
  numero_contrat: '', type_contrat: 'hebdomadaire', statut: 'actif', indice_fiabilite: 100, notes: ''
};

// Le type de contrat est stocké au début du champ "notes" sous la forme [contrat:hebdomadaire]
// afin d'éviter une modification de la base de données.
const lireTypeContrat = (notes: string | null | undefined): string => {
  const m = (notes || '').match(/^\[contrat:(hebdomadaire|journalier)\]/);
  return m ? m[1] : 'hebdomadaire';
};
const lireNotesPropres = (notes: string | null | undefined): string => {
  return (notes || '').replace(/^\[contrat:(hebdomadaire|journalier)\]\s*/, '');
};
const composerNotes = (type: string, notes: string): string => {
  return `[contrat:${type}] ${notes || ''}`.trim();
};

export default function LocatairesPage() {
  const [locataires, setLocataires] = useState<Locataire[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Locataire | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    const { data } = await supabase.from('locataires').select('*').order('nom');
    if (data) setLocataires(data as Locataire[]);
    setLoading(false);
  };

  useEffect(() => {
    fetch();
    const sub = supabase.channel('loc-page').on('postgres_changes', { event: '*', schema: 'public', table: 'locataires' }, fetch).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const openEdit = (l: Locataire) => {
    setEditing(l);
    setForm({ nom: l.nom, prenom: l.prenom, telephone: l.telephone, adresse: l.adresse, date_recrutement: l.date_recrutement, numero_contrat: l.numero_contrat || '', type_contrat: lireTypeContrat(l.notes), statut: l.statut, indice_fiabilite: l.indice_fiabilite, notes: lireNotesPropres(l.notes) });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const { type_contrat, notes, ...rest } = form;
    // numero_contrat est UNIQUE en base : une valeur vide doit être envoyée comme null,
    // sinon deux locataires sans numéro provoquent une erreur de doublon.
    const payload = {
      ...rest,
      numero_contrat: rest.numero_contrat?.trim() ? rest.numero_contrat.trim() : null,
      notes: composerNotes(type_contrat, notes),
    };
    let error = null;
    if (editing) {
      const res = await supabase.from('locataires').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id);
      error = res.error;
    } else {
      const res = await supabase.from('locataires').insert(payload);
      error = res.error;
    }
    setSaving(false);
    if (error) {
      alert("Enregistrement impossible : " + (error.message.includes('duplicate') || error.message.includes('unique')
        ? "ce numéro de contrat est déjà utilisé. Choisissez-en un autre ou laissez le champ vide."
        : error.message));
      return;
    }
    setShowForm(false);
    setEditing(null);
    setForm(defaultForm);
    fetch();
  };

  const filtered = locataires.filter(l => {
    const q = search.toLowerCase();
    return (!search || `${l.prenom} ${l.nom} ${l.telephone}`.toLowerCase().includes(q)) &&
      (!filterStatut || l.statut === filterStatut);
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        {Object.entries({ actif: 'Actifs', suspendu: 'Suspendus', termine: 'Terminés', en_cours_recrutement: 'Recrutement' }).map(([k, v]) => (
          <button key={k} onClick={() => setFilterStatut(filterStatut === k ? '' : k)}
            className={`p-3 rounded-xl border text-left transition ${filterStatut === k ? 'border-[#F5821F] bg-orange-50' : 'border-gray-100 bg-white'}`}>
            <p className="text-2xl font-bold text-[#1B2A4A]">{locataires.filter(l => l.statut === k).length}</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_COLORS[k]}`}>{v}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, téléphone..."
            className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
        </div>
        <button onClick={() => { setEditing(null); setForm(defaultForm); setShowForm(true); }}
          className="flex items-center gap-2 bg-[#1B2A4A] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#243660]">
          <Plus size={16} /> Nouveau locataire
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F7F8FA] border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Locataire</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Contrat</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Depuis</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-gray-500 uppercase">Fiabilité</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase">Impayés</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-gray-500 uppercase">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => (
                <tr key={l.id} className={`border-b border-gray-50 hover:bg-orange-50/20 ${i % 2 ? 'bg-gray-50/20' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#1B2A4A]/10 flex items-center justify-center text-xs font-bold text-[#1B2A4A] flex-shrink-0">
                        {l.prenom[0]}{l.nom[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#1B2A4A]">{l.prenom} {l.nom}</p>
                        <p className="text-xs text-gray-500">{l.telephone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${lireTypeContrat(l.notes) === 'journalier' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {lireTypeContrat(l.notes) === 'journalier' ? 'Journalier' : 'Hebdomadaire'}
                      </span>
                      <span className="text-xs font-mono text-gray-400">{l.numero_contrat || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(l.date_recrutement)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Star size={12} className={l.indice_fiabilite >= 90 ? 'text-emerald-500' : l.indice_fiabilite >= 70 ? 'text-yellow-500' : 'text-red-500'} fill="currentColor" />
                      <span className={`text-sm font-bold ${l.indice_fiabilite >= 90 ? 'text-emerald-600' : l.indice_fiabilite >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {l.indice_fiabilite}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {Number(l.solde_impaye) > 0 ? (
                      <span className="text-xs font-bold text-red-600 flex items-center justify-end gap-1">
                        <AlertTriangle size={12} /> {formatCFA(Number(l.solde_impaye))}
                      </span>
                    ) : <span className="text-xs text-emerald-600 font-semibold">Aucun</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUT_COLORS[l.statut]}`}>{l.statut}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => openEdit(l)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Edit2 size={14} className="text-gray-400" /></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400"><Users size={32} className="mx-auto mb-2 opacity-30" /><p>Aucun locataire</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-[#1B2A4A] flex items-center gap-2"><Users size={18} className="text-[#F5821F]" /> {editing ? 'Modifier locataire' : 'Nouveau locataire'}</h3>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Prénom *</label>
                  <input value={form.prenom} onChange={e => setForm({ ...form, prenom: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Nom *</label>
                  <input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Téléphone</label>
                  <input value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">N° Contrat</label>
                  <input value={form.numero_contrat} onChange={e => setForm({ ...form, numero_contrat: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Type de contrat *</label>
                <select value={form.type_contrat} onChange={e => setForm({ ...form, type_contrat: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]">
                  <option value="hebdomadaire">Hebdomadaire (paiement par semaine)</option>
                  <option value="journalier">Journalier (paiement par jour)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Date de recrutement</label>
                  <input type="date" value={form.date_recrutement} onChange={e => setForm({ ...form, date_recrutement: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Statut</label>
                  <select value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]">
                    <option value="actif">Actif</option>
                    <option value="suspendu">Suspendu</option>
                    <option value="termine">Terminé</option>
                    <option value="en_cours_recrutement">En cours de recrutement</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Indice de fiabilité (0-100)</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={0} max={100} value={form.indice_fiabilite} onChange={e => setForm({ ...form, indice_fiabilite: parseInt(e.target.value) })}
                    className="flex-1 accent-[#F5821F]" />
                  <span className="font-bold text-[#1B2A4A] w-8 text-center">{form.indice_fiabilite}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Adresse</label>
                <input value={form.adresse} onChange={e => setForm({ ...form, adresse: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Annuler</button>
              <button onClick={handleSave} disabled={saving || !form.nom || !form.prenom}
                className="px-5 py-2.5 rounded-xl bg-[#1B2A4A] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
                <Save size={15} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
