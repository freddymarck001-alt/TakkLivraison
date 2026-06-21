import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Maintenance, formatCFA, formatDate } from '../../../lib/types';
import { Wrench, Plus, Save, X, CheckCircle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

const STATUT_COLORS: Record<string, string> = {
  planifie: 'bg-blue-100 text-blue-800',
  en_cours: 'bg-orange-100 text-orange-800',
  termine: 'bg-green-100 text-green-800',
  annule: 'bg-gray-100 text-gray-600',
};

const TYPE_COLORS: Record<string, string> = {
  preventive: 'bg-blue-50 border-blue-200',
  corrective: 'bg-red-50 border-red-200',
  revision: 'bg-purple-50 border-purple-200',
};

export default function MaintenancePage() {
  const { profile } = useAuth();
  const [maintenances, setMaintenances] = useState<(Maintenance & { motos?: { matricule: string } })[]>([]);
  const [motos, setMotos] = useState<{ id: string; matricule: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStatut, setFilterStatut] = useState('');
  const [form, setForm] = useState({
    moto_id: '', type_maintenance: 'preventive', titre: '',
    description: '', date_prevue: '', cout: 0, technicien: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchMaintenances = async () => {
    let q = supabase.from('maintenances').select('*, motos(matricule)').order('date_prevue');
    if (filterStatut) q = q.eq('statut', filterStatut);
    const { data } = await q;
    if (data) setMaintenances(data as typeof maintenances);
    setLoading(false);
  };

  useEffect(() => {
    fetchMaintenances();
    supabase.from('motos').select('id,matricule').order('matricule').then(({ data }) => setMotos(data || []));
    const sub = supabase.channel('maint-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenances' }, fetchMaintenances)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [filterStatut]);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('maintenances').insert({
      ...form, moto_id: form.moto_id, statut: 'planifie',
      date_prevue: form.date_prevue || null, cout: form.cout,
    });
    await supabase.from('audit_logs').insert({
      user_email: profile?.email, user_role: profile?.role,
      action: 'Planification maintenance', table_concernee: 'maintenances',
      details: { moto: form.moto_id, titre: form.titre },
    });
    setSaving(false);
    setShowForm(false);
    fetchMaintenances();
  };

  const handleUpdateStatut = async (id: string, statut: string) => {
    const update: Record<string, string> = { statut, updated_at: new Date().toISOString() };
    if (statut === 'termine') update.date_realisation = new Date().toISOString().split('T')[0];
    await supabase.from('maintenances').update(update).eq('id', id);
    fetchMaintenances();
  };

  const totalCout = maintenances.filter(m => m.statut !== 'annule').reduce((s, m) => s + Number(m.cout), 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        {Object.entries({ planifie: 'Planifiées', en_cours: 'En cours', termine: 'Terminées', annule: 'Annulées' }).map(([k, v]) => (
          <button key={k} onClick={() => setFilterStatut(filterStatut === k ? '' : k)}
            className={`p-3 rounded-xl border text-left transition ${filterStatut === k ? 'border-[#F5821F] bg-orange-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
            <p className="text-2xl font-bold text-[#1B2A4A]">{maintenances.filter(m => m.statut === k).length}</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_COLORS[k]}`}>{v}</span>
          </button>
        ))}
      </div>

      <div className="bg-[#F5821F]/10 border border-[#F5821F]/30 rounded-xl px-4 py-3 flex justify-between items-center">
        <p className="text-sm font-semibold text-[#1B2A4A]">Coût total prévu : <span className="text-[#F5821F]">{formatCFA(totalCout)}</span></p>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#1B2A4A] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#243660]">
          <Plus size={15} /> Planifier
        </button>
      </div>

      <div className="space-y-3">
        {maintenances.map(m => {
          const moto = (m.motos as unknown as { matricule: string })?.matricule || '—';
          return (
            <div key={m.id} className={`bg-white rounded-2xl border p-4 shadow-sm ${TYPE_COLORS[m.type_maintenance]}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-[#1B2A4A]">{m.titre}</h3>
                    <span className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded-full capitalize text-gray-600">{m.type_maintenance}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_COLORS[m.statut]}`}>{m.statut}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    <span>Moto : <strong className="text-[#1B2A4A]">{moto}</strong></span>
                    {m.date_prevue && <span>Date prévue : {formatDate(m.date_prevue)}</span>}
                    {m.technicien && <span>Technicien : {m.technicien}</span>}
                    <span>Coût : <strong className="text-[#1B2A4A]">{formatCFA(Number(m.cout))}</strong></span>
                  </div>
                  {m.description && <p className="text-xs text-gray-600 mt-1.5 italic">{m.description}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {m.statut === 'planifie' && (
                    <button onClick={() => handleUpdateStatut(m.id, 'en_cours')}
                      className="text-xs border border-orange-300 text-orange-700 px-2 py-1 rounded-lg hover:bg-orange-50 transition">
                      Démarrer
                    </button>
                  )}
                  {m.statut === 'en_cours' && (
                    <button onClick={() => handleUpdateStatut(m.id, 'termine')}
                      className="text-xs border border-green-300 text-green-700 px-2 py-1 rounded-lg hover:bg-green-50 transition flex items-center gap-1">
                      <CheckCircle size={12} /> Terminer
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {maintenances.length === 0 && !loading && (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Wrench size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400">Aucune maintenance</p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-[#1B2A4A] flex items-center gap-2"><Wrench size={18} className="text-[#F5821F]" /> Planifier une maintenance</h3>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Type</label>
                  <select value={form.type_maintenance} onChange={e => setForm({ ...form, type_maintenance: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]">
                    <option value="preventive">Préventive</option>
                    <option value="corrective">Corrective</option>
                    <option value="revision">Révision</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Date prévue</label>
                  <input type="date" value={form.date_prevue} onChange={e => setForm({ ...form, date_prevue: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Titre *</label>
                <input value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Technicien</label>
                  <input value={form.technicien} onChange={e => setForm({ ...form, technicien: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Coût estimé (FCFA)</label>
                  <input type="number" value={form.cout} onChange={e => setForm({ ...form, cout: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F] resize-none" />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Annuler</button>
              <button onClick={handleSave} disabled={saving || !form.moto_id || !form.titre}
                className="px-5 py-2.5 rounded-xl bg-[#1B2A4A] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
                <Save size={15} /> {saving ? 'Enregistrement...' : 'Planifier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
