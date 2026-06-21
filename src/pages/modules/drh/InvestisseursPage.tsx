import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Investisseur, Moto, formatCFA, formatDate } from '../../../lib/types';
import { Building2, Plus, Search, Save, X, Edit2, Bike } from 'lucide-react';

interface InvWithMotos extends Investisseur { nb_motos: number; motos_list: string }

const STATUT_COLORS: Record<string, string> = {
  actif: 'bg-emerald-100 text-emerald-800',
  inactif: 'bg-gray-100 text-gray-600',
  prospect: 'bg-blue-100 text-blue-800',
};

const defaultForm = { nom: '', prenom: '', telephone: '', email: '', adresse: '', date_entree: new Date().toISOString().split('T')[0], statut: 'actif', notes: '' };

export default function InvestisseursPage() {
  const [investisseurs, setInvestisseurs] = useState<InvWithMotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Investisseur | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    const [invRes, motosRes] = await Promise.all([
      supabase.from('investisseurs').select('*').order('nom'),
      supabase.from('motos').select('investisseur_id,matricule').eq('proprietaire', 'investisseur'),
    ]);
    const motos = motosRes.data || [];
    const motoMap = new Map<string, string[]>();
    motos.forEach(m => {
      if (m.investisseur_id) {
        if (!motoMap.has(m.investisseur_id)) motoMap.set(m.investisseur_id, []);
        motoMap.get(m.investisseur_id)!.push(m.matricule);
      }
    });
    const result: InvWithMotos[] = (invRes.data || []).map(inv => ({
      ...inv as Investisseur,
      nb_motos: motoMap.get(inv.id)?.length || 0,
      motos_list: motoMap.get(inv.id)?.join(', ') || 'Aucune',
    }));
    setInvestisseurs(result);
    setLoading(false);
  };

  useEffect(() => {
    fetch();
    const sub = supabase.channel('inv-page').on('postgres_changes', { event: '*', schema: 'public', table: 'investisseurs' }, fetch).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const openEdit = (inv: InvWithMotos) => {
    setEditing(inv);
    setForm({ nom: inv.nom, prenom: inv.prenom, telephone: inv.telephone, email: inv.email, adresse: inv.adresse, date_entree: inv.date_entree, statut: inv.statut, notes: inv.notes });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editing) {
      await supabase.from('investisseurs').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id);
    } else {
      await supabase.from('investisseurs').insert(form);
      await supabase.from('notifications').insert({ destinataire_role: 'dg', titre: 'Nouvel investisseur', message: `${form.prenom} ${form.nom} — à valider`, type: 'info' });
    }
    setSaving(false);
    setShowForm(false);
    setEditing(null);
    fetch();
  };

  const filtered = investisseurs.filter(i => {
    const q = search.toLowerCase();
    return !search || `${i.prenom} ${i.nom} ${i.telephone} ${i.email}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        {[{ label: 'Actifs', key: 'actif', color: 'bg-emerald-600' }, { label: 'Prospects', key: 'prospect', color: 'bg-[#F5821F]' }, { label: 'Inactifs', key: 'inactif', color: 'bg-gray-500' }].map(s => (
          <div key={s.key} className={`${s.color} text-white rounded-xl p-4`}>
            <p className="text-3xl font-bold">{investisseurs.filter(i => i.statut === s.key).length}</p>
            <p className="text-xs opacity-70">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3 items-center justify-between">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, téléphone, email..."
            className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
        </div>
        <button onClick={() => { setEditing(null); setForm(defaultForm); setShowForm(true); }}
          className="flex items-center gap-2 bg-[#1B2A4A] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#243660]">
          <Plus size={16} /> Ajouter investisseur
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(inv => (
          <div key={inv.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1B2A4A] flex items-center justify-center text-white font-bold">
                  {inv.prenom[0]}{inv.nom[0]}
                </div>
                <div>
                  <h3 className="font-bold text-[#1B2A4A]">{inv.prenom} {inv.nom}</h3>
                  <p className="text-xs text-gray-500">{inv.telephone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_COLORS[inv.statut]}`}>{inv.statut}</span>
                <button onClick={() => openEdit(inv)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Edit2 size={14} className="text-gray-400" /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#F7F8FA] rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1"><Bike size={14} className="text-[#F5821F]" /><p className="text-xs text-gray-500">Motos confiées</p></div>
                <p className="font-bold text-[#1B2A4A]">{inv.nb_motos}</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{inv.motos_list}</p>
              </div>
              <div className="bg-[#F7F8FA] rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Commissions versées</p>
                <p className="font-bold text-emerald-700">{formatCFA(Number(inv.total_commissions_versees))}</p>
                <p className="text-xs text-gray-400 mt-0.5">depuis {formatDate(inv.date_entree)}</p>
              </div>
            </div>
            {inv.email && <p className="text-xs text-gray-400 mt-2">{inv.email}</p>}
          </div>
        ))}
        {filtered.length === 0 && !loading && (
          <div className="col-span-2 text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400">Aucun investisseur</p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-[#1B2A4A] flex items-center gap-2"><Building2 size={18} className="text-[#F5821F]" /> {editing ? 'Modifier investisseur' : 'Nouvel investisseur'}</h3>
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
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Date d'entrée</label>
                  <input type="date" value={form.date_entree} onChange={e => setForm({ ...form, date_entree: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Statut</label>
                  <select value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]">
                    <option value="actif">Actif</option>
                    <option value="prospect">Prospect</option>
                    <option value="inactif">Inactif</option>
                  </select>
                </div>
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
