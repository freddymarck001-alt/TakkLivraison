import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Fournisseur } from '../../../lib/types';
import { Truck, Plus, Save, X, Edit2 } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = { motos: 'Motos', pieces: 'Pièces', services: 'Services', autre: 'Autre' };
const defaultForm = { nom: '', contact: '', telephone: '', email: '', adresse: '', type_fourniture: 'motos', statut: 'actif', notes: '' };

export default function SuppliersPage() {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Fournisseur | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    const { data } = await supabase.from('fournisseurs').select('*').order('nom');
    if (data) setFournisseurs(data as Fournisseur[]);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const openEdit = (f: Fournisseur) => {
    setEditing(f);
    setForm({ nom: f.nom, contact: f.contact, telephone: f.telephone, email: f.email, adresse: f.adresse, type_fourniture: f.type_fourniture, statut: f.statut, notes: f.notes });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editing) await supabase.from('fournisseurs').update(form).eq('id', editing.id);
    else await supabase.from('fournisseurs').insert(form);
    setSaving(false);
    setShowForm(false);
    setEditing(null);
    fetch();
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => { setEditing(null); setForm(defaultForm); setShowForm(true); }}
          className="flex items-center gap-2 bg-[#1B2A4A] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#243660]">
          <Plus size={16} /> Ajouter fournisseur
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fournisseurs.map(f => (
          <div key={f.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-[#1B2A4A]">{f.nom}</h3>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${f.statut === 'actif' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{f.statut}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-[#1B2A4A]/10 text-[#1B2A4A] px-2 py-0.5 rounded-full font-semibold">{TYPE_LABELS[f.type_fourniture]}</span>
                <button onClick={() => openEdit(f)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Edit2 size={14} className="text-gray-400" /></button>
              </div>
            </div>
            <div className="space-y-1 text-xs text-gray-600">
              {f.contact && <p>Contact : {f.contact}</p>}
              {f.telephone && <p>Tél : {f.telephone}</p>}
              {f.email && <p>Email : {f.email}</p>}
            </div>
          </div>
        ))}
        {fournisseurs.length === 0 && !loading && (
          <div className="col-span-2 text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Truck size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400">Aucun fournisseur</p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-[#1B2A4A] flex items-center gap-2"><Truck size={18} className="text-[#F5821F]" /> {editing ? 'Modifier' : 'Nouveau'} fournisseur</h3>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: 'Nom *', key: 'nom' },
                { label: 'Contact', key: 'contact' },
                { label: 'Téléphone', key: 'telephone' },
                { label: 'Email', key: 'email' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{f.label}</label>
                  <input value={(form as Record<string, string>)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Type</label>
                  <select value={form.type_fourniture} onChange={e => setForm({ ...form, type_fourniture: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]">
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Statut</label>
                  <select value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]">
                    <option value="actif">Actif</option>
                    <option value="inactif">Inactif</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Annuler</button>
              <button onClick={handleSave} disabled={saving || !form.nom}
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
