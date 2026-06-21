import { useState, useEffect } from 'react';
import { X, Bike, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Moto, Locataire, Investisseur, formatCFA, formatDate } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';

interface MotoModalProps {
  moto: Moto | null;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'en_panne', label: 'En panne' },
  { value: 'immobilisee', label: 'Immobilisée' },
  { value: 'disponible', label: 'Disponible' },
];

export default function MotoModal({ moto, canEdit, onClose, onSaved }: MotoModalProps) {
  const { profile } = useAuth();
  const isNew = !moto;

  const [form, setForm] = useState({
    matricule: moto?.matricule || '',
    marque: moto?.marque || 'Yamaha',
    modele: moto?.modele || 'YBR125',
    annee: moto?.annee || new Date().getFullYear(),
    date_achat: moto?.date_achat || new Date().toISOString().split('T')[0],
    prix_achat: moto?.prix_achat || 670000,
    statut: moto?.statut || 'disponible',
    proprietaire: moto?.proprietaire || 'takk',
    locataire_id: moto?.locataire_id || '',
    investisseur_id: moto?.investisseur_id || '',
    gps_identifiant: moto?.gps_identifiant || '',
    kilometrage: moto?.kilometrage || 0,
    notes: moto?.notes || '',
  });

  const [locataires, setLocataires] = useState<Locataire[]>([]);
  const [investisseurs, setInvestisseurs] = useState<Investisseur[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('locataires').select('id,nom,prenom').eq('statut', 'actif').then(({ data }) => {
      if (data) setLocataires(data as Locataire[]);
    });
    supabase.from('investisseurs').select('id,nom,prenom').eq('statut', 'actif').then(({ data }) => {
      if (data) setInvestisseurs(data as Investisseur[]);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      ...form,
      locataire_id: form.locataire_id || null,
      investisseur_id: form.proprietaire === 'investisseur' ? (form.investisseur_id || null) : null,
      gps_identifiant: form.gps_identifiant || null,
      gps_status: form.gps_identifiant ? 'connecte' : 'non_connecte',
      updated_at: new Date().toISOString(),
    };

    if (isNew) {
      await supabase.from('motos').insert(payload);
      await supabase.from('audit_logs').insert({
        user_email: profile?.email,
        user_role: profile?.role,
        action: 'Ajout moto',
        table_concernee: 'motos',
        details: { matricule: form.matricule },
      });
    } else {
      await supabase.from('motos').update(payload).eq('id', moto!.id);
      await supabase.from('audit_logs').insert({
        user_email: profile?.email,
        user_role: profile?.role,
        action: 'Modification moto',
        table_concernee: 'motos',
        reference_id: moto!.id,
        details: { matricule: form.matricule, statut: form.statut },
      });
    }

    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Bike size={20} className="text-[#F5821F]" />
            <h3 className="font-bold text-[#1B2A4A] text-lg">
              {isNew ? 'Nouvelle moto' : moto.matricule}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!canEdit && moto ? (
            // Read-only view
            <div className="space-y-3">
              {[
                { label: 'Matricule', value: moto.matricule },
                { label: 'Modèle', value: `${moto.marque} ${moto.modele} ${moto.annee}` },
                { label: 'Statut', value: moto.statut },
                { label: 'Propriétaire', value: moto.proprietaire === 'takk' ? 'TAKK' : 'Investisseur' },
                { label: 'Locataire', value: moto.locataires ? `${moto.locataires.prenom} ${moto.locataires.nom}` : 'Non assigné' },
                { label: 'GPS', value: moto.gps_identifiant || 'Non connecté' },
                { label: 'Statut GPS', value: moto.gps_status === 'connecte' ? 'Connecté' : moto.gps_status === 'hors_ligne' ? 'Hors ligne' : 'Non connecté' },
                { label: 'Kilométrage', value: `${moto.kilometrage.toLocaleString('fr-CI')} km` },
                { label: 'Prix achat', value: formatCFA(moto.prix_achat) },
                { label: 'Date achat', value: formatDate(moto.date_achat) },
                { label: 'Notes', value: moto.notes || '—' },
              ].map(r => (
                <div key={r.label} className="flex justify-between items-start py-2 border-b border-gray-50">
                  <span className="text-xs font-semibold text-gray-500">{r.label}</span>
                  <span className="text-sm text-[#1B2A4A] font-medium text-right max-w-[60%]">{r.value}</span>
                </div>
              ))}
            </div>
          ) : (
            // Edit form
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Matricule *</label>
                  <input
                    value={form.matricule}
                    onChange={e => setForm({ ...form, matricule: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]"
                    placeholder="TAKK-XXX"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Statut</label>
                  <select
                    value={form.statut}
                    onChange={e => setForm({ ...form, statut: e.target.value as Moto['statut'] })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]"
                  >
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Marque</label>
                  <input
                    value={form.marque}
                    onChange={e => setForm({ ...form, marque: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Modèle</label>
                  <input
                    value={form.modele}
                    onChange={e => setForm({ ...form, modele: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Année</label>
                  <input
                    type="number"
                    value={form.annee}
                    onChange={e => setForm({ ...form, annee: parseInt(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Propriétaire</label>
                  <select
                    value={form.proprietaire}
                    onChange={e => setForm({ ...form, proprietaire: e.target.value as Moto['proprietaire'] })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]"
                  >
                    <option value="takk">TAKK</option>
                    <option value="investisseur">Investisseur</option>
                  </select>
                </div>
                {form.proprietaire === 'investisseur' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Investisseur</label>
                    <select
                      value={form.investisseur_id}
                      onChange={e => setForm({ ...form, investisseur_id: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]"
                    >
                      <option value="">— Sélectionner —</option>
                      {investisseurs.map(inv => (
                        <option key={inv.id} value={inv.id}>{inv.prenom} {inv.nom}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Locataire assigné</label>
                <select
                  value={form.locataire_id}
                  onChange={e => setForm({ ...form, locataire_id: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]"
                >
                  <option value="">— Non assigné —</option>
                  {locataires.map(l => (
                    <option key={l.id} value={l.id}>{l.prenom} {l.nom}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Identifiant GPS (optionnel)</label>
                <input
                  type="text"
                  value={form.gps_identifiant}
                  onChange={e => setForm({ ...form, gps_identifiant: e.target.value })}
                  placeholder="Ex: TRK-123456"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]"
                />
                <p className="text-xs text-gray-400 mt-1">Renseignez ce champ lorsque vous installez un traceur GPS sur la moto</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Date d'achat</label>
                  <input
                    type="date"
                    value={form.date_achat}
                    onChange={e => setForm({ ...form, date_achat: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Kilométrage</label>
                  <input
                    type="number"
                    value={form.kilometrage}
                    onChange={e => setForm({ ...form, kilometrage: parseInt(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F] resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {canEdit && (
          <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.matricule}
              className="px-5 py-2.5 rounded-xl bg-[#1B2A4A] text-white text-sm font-semibold flex items-center gap-2 hover:bg-[#243660] transition disabled:opacity-50"
            >
              <Save size={15} />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
