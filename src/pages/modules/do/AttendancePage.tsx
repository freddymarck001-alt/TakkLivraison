import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Absence, Locataire, formatDate } from '../../../lib/types';
import { Users, Plus, CheckCircle, AlertTriangle, Save, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

export default function AttendancePage() {
  const { profile } = useAuth();
  const [absences, setAbsences] = useState<(Absence & { locataires?: { nom: string; prenom: string } })[]>([]);
  const [locataires, setLocataires] = useState<Locataire[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    locataire_id: '', date_absence: new Date().toISOString().split('T')[0],
    motif: '', justifie: false
  });
  const [saving, setSaving] = useState(false);
  const [filterDate, setFilterDate] = useState('');

  const fetchAbsences = async () => {
    let q = supabase.from('absences').select('*, locataires(nom,prenom)').order('date_absence', { ascending: false });
    if (filterDate) q = q.eq('date_absence', filterDate);
    const { data } = await q.limit(100);
    if (data) setAbsences(data as typeof absences);
    setLoading(false);
  };

  useEffect(() => {
    fetchAbsences();
    supabase.from('locataires').select('id,nom,prenom').eq('statut', 'actif').then(({ data }) => setLocataires(data || []));
    const sub = supabase.channel('absences')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'absences' }, fetchAbsences)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [filterDate]);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('absences').insert({ ...form, locataire_id: form.locataire_id });
    if (form.justifie) {
      await supabase.from('notifications').insert({
        destinataire_role: 'daf',
        titre: 'Absence justifiée',
        message: `${locataires.find(l => l.id === form.locataire_id)?.prenom} — absence du ${formatDate(form.date_absence)} (justifiée)`,
        type: 'info',
      });
    } else {
      await supabase.from('notifications').insert({
        destinataire_role: 'daf',
        titre: 'Absence non justifiée',
        message: `Absence non justifiée à déduire du paiement — ${formatDate(form.date_absence)}`,
        type: 'alerte',
      });
    }
    await supabase.from('audit_logs').insert({
      user_email: profile?.email, user_role: profile?.role,
      action: 'Enregistrement absence', table_concernee: 'absences',
      details: { locataire: form.locataire_id, date: form.date_absence, justifie: form.justifie },
    });

    // Absence NON justifiée -> impayé automatique (un jour = 5 000 FCFA)
    if (!form.justifie && form.locataire_id) {
      const MONTANT_JOUR = 5000;
      const { data: loc } = await supabase
        .from('locataires')
        .select('solde_impaye, nom, prenom')
        .eq('id', form.locataire_id)
        .maybeSingle();
      if (loc) {
        await supabase.from('locataires').update({
          solde_impaye: Number(loc.solde_impaye) + MONTANT_JOUR,
          updated_at: new Date().toISOString(),
        }).eq('id', form.locataire_id);

        await supabase.from('notifications').insert({
          destinataire_role: 'daf',
          titre: 'Impayé — absence non justifiée',
          message: `${loc.prenom} ${loc.nom} : absence non justifiée du ${formatDate(form.date_absence)} → ${MONTANT_JOUR.toLocaleString('fr-FR')} FCFA ajoutés aux impayés`,
          type: 'alerte',
        });
      }
    }

    setSaving(false);
    setShowForm(false);
    fetchAbsences();
  };

  const handleValider = async (absenceId: string) => {
    // Retrouver l'absence pour annuler l'impayé si elle devient justifiée
    const { data: abs } = await supabase
      .from('absences')
      .select('locataire_id, justifie')
      .eq('id', absenceId)
      .maybeSingle();

    await supabase.from('absences').update({
      justifie: true, valide_par: profile?.id, valide_le: new Date().toISOString()
    }).eq('id', absenceId);

    // Si l'absence était non justifiée, on retire l'impayé correspondant
    if (abs && !abs.justifie && abs.locataire_id) {
      const MONTANT_JOUR = 5000;
      const { data: loc } = await supabase
        .from('locataires')
        .select('solde_impaye')
        .eq('id', abs.locataire_id)
        .maybeSingle();
      if (loc) {
        await supabase.from('locataires').update({
          solde_impaye: Math.max(Number(loc.solde_impaye) - MONTANT_JOUR, 0),
          updated_at: new Date().toISOString(),
        }).eq('id', abs.locataire_id);
      }
    }
    fetchAbsences();
  };

  const today = new Date().toISOString().split('T')[0];
  const todayAbsences = absences.filter(a => a.date_absence === today);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1B2A4A] text-white rounded-xl p-4">
          <p className="text-xs opacity-70">Absences aujourd'hui</p>
          <p className="text-3xl font-bold">{todayAbsences.length}</p>
        </div>
        <div className="bg-[#F5821F] text-white rounded-xl p-4">
          <p className="text-xs opacity-70">Non justifiées</p>
          <p className="text-3xl font-bold">{absences.filter(a => !a.justifie).length}</p>
        </div>
        <div className="bg-emerald-600 text-white rounded-xl p-4">
          <p className="text-xs opacity-70">Justifiées / validées</p>
          <p className="text-3xl font-bold">{absences.filter(a => a.justifie).length}</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        <strong>Règle :</strong> Un jour non travaillé non justifié est déduit de la recette hebdomadaire. 5 jours = 25 000 FCFA. 4 jours = 20 000 FCFA.
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3 flex-wrap items-center">
          <label className="text-xs font-semibold text-gray-500">Filtrer par date :</label>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
          {filterDate && <button onClick={() => setFilterDate('')} className="text-xs text-gray-400 hover:text-gray-600">Effacer</button>}
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#1B2A4A] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#243660]">
          <Plus size={16} /> Enregistrer une absence
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F7F8FA] border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Locataire</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Motif</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-gray-500 uppercase">Statut</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {absences.map((a, i) => (
                <tr key={a.id} className={`border-b border-gray-50 hover:bg-orange-50/20 ${i % 2 ? 'bg-gray-50/20' : ''}`}>
                  <td className="px-4 py-3 text-sm font-mono text-gray-700">{formatDate(a.date_absence)}</td>
                  <td className="px-4 py-3 text-sm text-[#1B2A4A] font-semibold">
                    {a.locataires ? `${a.locataires.prenom} ${a.locataires.nom}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{a.motif || <span className="text-gray-400 italic">Non précisé</span>}</td>
                  <td className="px-4 py-3 text-center">
                    {a.justifie ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                        <CheckCircle size={12} /> Justifiée
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700">
                        <AlertTriangle size={12} /> Non justifiée
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {!a.justifie && (
                      <button onClick={() => handleValider(a.id)}
                        className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold border border-emerald-200 px-2 py-1 rounded-lg hover:bg-emerald-50 transition">
                        Valider
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {absences.length === 0 && !loading && (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">Aucune absence enregistrée</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-[#1B2A4A] flex items-center gap-2"><Users size={18} className="text-[#F5821F]" /> Enregistrer une absence</h3>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Locataire *</label>
                <select value={form.locataire_id} onChange={e => setForm({ ...form, locataire_id: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]">
                  <option value="">— Sélectionner —</option>
                  {locataires.map(l => <option key={l.id} value={l.id}>{l.prenom} {l.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Date d'absence</label>
                <input type="date" value={form.date_absence} onChange={e => setForm({ ...form, date_absence: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Motif</label>
                <input value={form.motif} onChange={e => setForm({ ...form, motif: e.target.value })} placeholder="Maladie, raison personnelle..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.justifie} onChange={e => setForm({ ...form, justifie: e.target.checked })}
                  className="w-4 h-4 rounded accent-[#F5821F]" />
                <span className="text-sm font-semibold text-[#1B2A4A]">Absence justifiée (ne pas déduire)</span>
              </label>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Annuler</button>
              <button onClick={handleSave} disabled={saving || !form.locataire_id}
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
