import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Incident, formatCFA, formatDate } from '../../../lib/types';
import { AlertTriangle, Plus, Save, X, CheckCircle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

const GRAVITE_COLORS: Record<string, string> = {
  faible: 'bg-blue-100 text-blue-800',
  moyenne: 'bg-yellow-100 text-yellow-800',
  elevee: 'bg-orange-100 text-orange-800',
  critique: 'bg-red-100 text-red-800',
};

const STATUT_COLORS: Record<string, string> = {
  ouvert: 'bg-red-100 text-red-800',
  en_cours: 'bg-yellow-100 text-yellow-800',
  resolu: 'bg-green-100 text-green-800',
  ferme: 'bg-gray-100 text-gray-600',
};

export default function IncidentsPage() {
  const { profile } = useAuth();
  const [incidents, setIncidents] = useState<(Incident & { motos?: { matricule: string }; locataires?: { nom: string; prenom: string } })[]>([]);
  const [motos, setMotos] = useState<{ id: string; matricule: string }[]>([]);
  const [locataires, setLocataires] = useState<{ id: string; nom: string; prenom: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    moto_id: '', locataire_id: '', type_incident: 'panne', titre: '',
    description: '', date_incident: new Date().toISOString().split('T')[0],
    gravite: 'faible', cout_estime: 0,
  });
  const [saving, setSaving] = useState(false);

  const fetchIncidents = async () => {
    const { data } = await supabase.from('incidents')
      .select('*, motos(matricule), locataires(nom,prenom)')
      .order('created_at', { ascending: false });
    if (data) setIncidents(data as typeof incidents);
    setLoading(false);
  };

  useEffect(() => {
    fetchIncidents();
    supabase.from('motos').select('id,matricule').order('matricule').then(({ data }) => setMotos(data || []));
    supabase.from('locataires').select('id,nom,prenom').then(({ data }) => setLocataires(data || []));
    const sub = supabase.channel('incidents-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, fetchIncidents)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('incidents').insert({
      ...form,
      moto_id: form.moto_id || null,
      locataire_id: form.locataire_id || null,
      statut: 'ouvert',
      created_by: profile?.id,
    });
    await supabase.from('notifications').insert({
      destinataire_role: 'dg',
      titre: `Nouvel incident : ${form.titre}`,
      message: `Gravité ${form.gravite} — ${form.type_incident} le ${formatDate(form.date_incident)}`,
      type: form.gravite === 'critique' || form.gravite === 'elevee' ? 'urgence' : 'alerte',
    });
    setSaving(false);
    setShowForm(false);
    fetchIncidents();
  };

  const handleUpdateStatut = async (id: string, statut: string) => {
    await supabase.from('incidents').update({ statut, updated_at: new Date().toISOString() }).eq('id', id);
    fetchIncidents();
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        {(['ouvert', 'en_cours', 'resolu', 'ferme'] as const).map(s => (
          <div key={s} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-2xl font-bold text-[#1B2A4A]">{incidents.filter(i => i.statut === s).length}</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUT_COLORS[s]}`}>{s}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#1B2A4A] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#243660]">
          <Plus size={16} /> Signaler un incident
        </button>
      </div>

      <div className="space-y-3">
        {incidents.map(inc => (
          <div key={inc.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${inc.gravite === 'critique' ? 'border-red-300' : 'border-gray-100'}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-bold text-[#1B2A4A]">{inc.titre}</h3>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${GRAVITE_COLORS[inc.gravite]}`}>{inc.gravite}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUT_COLORS[inc.statut]}`}>{inc.statut}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{inc.type_incident}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                  {inc.motos && <span>Moto : <strong className="text-[#1B2A4A]">{inc.motos.matricule}</strong></span>}
                  {inc.locataires && <span>Locataire : <strong className="text-[#1B2A4A]">{inc.locataires.prenom} {inc.locataires.nom}</strong></span>}
                  <span>Date : {formatDate(inc.date_incident)}</span>
                  {inc.cout_estime > 0 && <span>Coût estimé : <strong className="text-red-600">{formatCFA(Number(inc.cout_estime))}</strong></span>}
                </div>
                {inc.description && <p className="text-xs text-gray-600 mt-2 italic">{inc.description}</p>}
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                {inc.statut === 'ouvert' && (
                  <button onClick={() => handleUpdateStatut(inc.id, 'en_cours')}
                    className="text-xs border border-yellow-300 text-yellow-700 px-2 py-1 rounded-lg hover:bg-yellow-50 transition">
                    Prendre en charge
                  </button>
                )}
                {(inc.statut === 'ouvert' || inc.statut === 'en_cours') && (
                  <button onClick={() => handleUpdateStatut(inc.id, 'resolu')}
                    className="text-xs border border-green-300 text-green-700 px-2 py-1 rounded-lg hover:bg-green-50 transition">
                    Marquer résolu
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {incidents.length === 0 && !loading && (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <CheckCircle size={40} className="mx-auto text-emerald-400 mb-3" />
            <p className="text-gray-500">Aucun incident signalé</p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-[#1B2A4A] flex items-center gap-2"><AlertTriangle size={18} className="text-[#F5821F]" /> Signaler un incident</h3>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Titre *</label>
                <input value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })} placeholder="Description courte de l'incident"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Type</label>
                  <select value={form.type_incident} onChange={e => setForm({ ...form, type_incident: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]">
                    {['accident', 'vol', 'litige', 'infraction', 'panne', 'autre'].map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Gravité</label>
                  <select value={form.gravite} onChange={e => setForm({ ...form, gravite: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]">
                    {['faible', 'moyenne', 'elevee', 'critique'].map(g => <option key={g} value={g} className="capitalize">{g}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Moto concernée</label>
                  <select value={form.moto_id} onChange={e => setForm({ ...form, moto_id: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]">
                    <option value="">— Aucune —</option>
                    {motos.map(m => <option key={m.id} value={m.id}>{m.matricule}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Locataire concerné</label>
                  <select value={form.locataire_id} onChange={e => setForm({ ...form, locataire_id: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]">
                    <option value="">— Aucun —</option>
                    {locataires.map(l => <option key={l.id} value={l.id}>{l.prenom} {l.nom}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Date incident</label>
                  <input type="date" value={form.date_incident} onChange={e => setForm({ ...form, date_incident: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Coût estimé (FCFA)</label>
                  <input type="number" value={form.cout_estime} onChange={e => setForm({ ...form, cout_estime: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F] resize-none" />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Annuler</button>
              <button onClick={handleSave} disabled={saving || !form.titre}
                className="px-5 py-2.5 rounded-xl bg-[#1B2A4A] text-white text-sm font-semibold flex items-center gap-2 hover:bg-[#243660] disabled:opacity-50">
                <Save size={15} /> {saving ? 'Enregistrement...' : 'Signaler'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
