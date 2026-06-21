import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { PieceStock, formatCFA } from '../../../lib/types';
import { Package, Plus, AlertTriangle, Save, X, Edit2 } from 'lucide-react';

export default function StockPage() {
  const [pieces, setPieces] = useState<PieceStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PieceStock | null>(null);
  const [form, setForm] = useState({ reference: '', nom: '', description: '', quantite: 0, quantite_min: 5, prix_unitaire: 0 });
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    const { data } = await supabase.from('pieces_stock').select('*').order('nom');
    if (data) setPieces(data as PieceStock[]);
    setLoading(false);
  };

  useEffect(() => {
    fetch();
    const sub = supabase.channel('stock').on('postgres_changes', { event: '*', schema: 'public', table: 'pieces_stock' }, fetch).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const openEdit = (p: PieceStock) => {
    setEditing(p);
    setForm({ reference: p.reference, nom: p.nom, description: p.description, quantite: p.quantite, quantite_min: p.quantite_min, prix_unitaire: p.prix_unitaire });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editing) {
      await supabase.from('pieces_stock').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id);
    } else {
      await supabase.from('pieces_stock').insert(form);
    }
    setSaving(false);
    setShowForm(false);
    setEditing(null);
    fetch();
  };

  const stockBas = pieces.filter(p => p.quantite <= p.quantite_min);
  const valeurStock = pieces.reduce((s, p) => s + p.quantite * p.prix_unitaire, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1B2A4A] text-white rounded-xl p-4">
          <p className="text-xs opacity-70">Références en stock</p>
          <p className="text-3xl font-bold">{pieces.length}</p>
        </div>
        <div className={`${stockBas.length > 0 ? 'bg-red-600' : 'bg-emerald-600'} text-white rounded-xl p-4`}>
          <p className="text-xs opacity-70">Stocks bas</p>
          <p className="text-3xl font-bold">{stockBas.length}</p>
        </div>
        <div className="bg-[#F5821F] text-white rounded-xl p-4">
          <p className="text-xs opacity-70">Valeur totale stock</p>
          <p className="text-xl font-bold">{formatCFA(valeurStock)}</p>
        </div>
      </div>

      {stockBas.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-500" />
            <h4 className="font-bold text-red-700 text-sm">Stocks insuffisants — Commande recommandée</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {stockBas.map(p => (
              <span key={p.id} className="text-xs bg-white border border-red-200 text-red-700 px-3 py-1 rounded-full font-semibold">
                {p.nom} : {p.quantite}/{p.quantite_min} min.
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={() => { setEditing(null); setForm({ reference: '', nom: '', description: '', quantite: 0, quantite_min: 5, prix_unitaire: 0 }); setShowForm(true); }}
          className="flex items-center gap-2 bg-[#1B2A4A] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#243660]">
          <Plus size={16} /> Nouvelle pièce
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F7F8FA] border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Réf.</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Désignation</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-gray-500 uppercase">Qté</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-gray-500 uppercase">Qté min.</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase">Prix unit.</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase">Valeur</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-gray-500 uppercase">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {pieces.map((p, i) => {
                const isBas = p.quantite <= p.quantite_min;
                return (
                  <tr key={p.id} className={`border-b border-gray-50 ${isBas ? 'bg-red-50/30' : i % 2 ? 'bg-gray-50/20' : ''}`}>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">{p.reference}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-[#1B2A4A]">{p.nom}</p>
                      <p className="text-xs text-gray-400">{p.description}</p>
                    </td>
                    <td className={`px-4 py-3 text-center text-lg font-bold ${isBas ? 'text-red-600' : 'text-[#1B2A4A]'}`}>{p.quantite}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-500">{p.quantite_min}</td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-gray-700">{formatCFA(p.prix_unitaire)}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold font-mono text-[#1B2A4A]">{formatCFA(p.quantite * p.prix_unitaire)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isBas ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {isBas ? 'Stock bas' : 'OK'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                        <Edit2 size={14} className="text-gray-400" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {pieces.length === 0 && !loading && (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Aucune pièce en stock</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-[#1B2A4A] flex items-center gap-2"><Package size={18} className="text-[#F5821F]" /> {editing ? 'Modifier pièce' : 'Nouvelle pièce'}</h3>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Référence</label>
                  <input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Quantité en stock</label>
                  <input type="number" value={form.quantite} onChange={e => setForm({ ...form, quantite: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Désignation *</label>
                <input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Quantité minimum</label>
                  <input type="number" value={form.quantite_min} onChange={e => setForm({ ...form, quantite_min: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Prix unitaire (FCFA)</label>
                  <input type="number" value={form.prix_unitaire} onChange={e => setForm({ ...form, prix_unitaire: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
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
