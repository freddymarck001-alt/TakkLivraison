import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Locataire, Investisseur, formatDate } from '../../../lib/types';
import { UserPlus, Users, Building2, ArrowRight, Plus, X, FileText } from 'lucide-react';

export default function RecruitmentPage() {
  const [locPipeline, setLocPipeline] = useState<Locataire[]>([]);
  const [invProspects, setInvProspects] = useState<Investisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLocForm, setShowLocForm] = useState(false);
  const [showInvForm, setShowInvForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [locForm, setLocForm] = useState({ nom: '', prenom: '', telephone: '', adresse: '', documents: '', notes: '' });
  const [invForm, setInvForm] = useState({ nom: '', prenom: '', telephone: '', email: '', adresse: '', documents: '', notes: '' });

  const fetchData = async () => {
    const [locRes, invRes] = await Promise.all([
      supabase.from('locataires').select('*').eq('statut', 'en_cours_recrutement').order('date_recrutement', { ascending: false }),
      supabase.from('investisseurs').select('*').eq('statut', 'prospect').order('date_entree', { ascending: false }),
    ]);
    if (locRes.data) setLocPipeline(locRes.data as Locataire[]);
    if (invRes.data) setInvProspects(invRes.data as Investisseur[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const sub = supabase.channel('recruitment')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locataires' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investisseurs' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  // Les documents sont stockés dans le champ "notes" pour éviter de modifier la base.
  const composerNotes = (documents: string, notes: string) => {
    const docPart = documents ? `[documents: ${documents}]` : '';
    return `${docPart} ${notes || ''}`.trim();
  };

  const ajouterCandidatLocataire = async () => {
    if (!locForm.nom || !locForm.prenom) return;
    setSaving(true);
    await supabase.from('locataires').insert({
      nom: locForm.nom, prenom: locForm.prenom, telephone: locForm.telephone, adresse: locForm.adresse,
      statut: 'en_cours_recrutement',
      notes: composerNotes(locForm.documents, locForm.notes),
    });
    setSaving(false);
    setShowLocForm(false);
    setLocForm({ nom: '', prenom: '', telephone: '', adresse: '', documents: '', notes: '' });
    fetchData();
  };

  const ajouterProspectInvestisseur = async () => {
    if (!invForm.nom || !invForm.prenom) return;
    setSaving(true);
    await supabase.from('investisseurs').insert({
      nom: invForm.nom, prenom: invForm.prenom, telephone: invForm.telephone, email: invForm.email, adresse: invForm.adresse,
      statut: 'prospect',
      notes: composerNotes(invForm.documents, invForm.notes),
    });
    setSaving(false);
    setShowInvForm(false);
    setInvForm({ nom: '', prenom: '', telephone: '', email: '', adresse: '', documents: '', notes: '' });
    fetchData();
  };

  const activerLocataire = async (id: string) => {
    await supabase.from('locataires').update({ statut: 'actif', updated_at: new Date().toISOString() }).eq('id', id);
    setLocPipeline(prev => prev.filter(l => l.id !== id));
  };

  const activerInvestisseur = async (id: string) => {
    await supabase.from('investisseurs').update({ statut: 'actif', updated_at: new Date().toISOString() }).eq('id', id);
    await supabase.from('notifications').insert({ destinataire_role: 'dg', titre: 'Investisseur validé', message: 'Nouveau partenaire investisseur activé', type: 'succes' });
    setInvProspects(prev => prev.filter(i => i.id !== id));
  };

  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1B2A4A] text-white rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Users size={18} /><p className="text-xs opacity-70">Locataires en cours de recrutement</p></div>
          <p className="text-3xl font-bold">{locPipeline.length}</p>
        </div>
        <div className="bg-[#F5821F] text-white rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Building2 size={18} /><p className="text-xs opacity-70">Investisseurs prospects</p></div>
          <p className="text-3xl font-bold">{invProspects.length}</p>
        </div>
      </div>

      {/* Locataires pipeline */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-[#1B2A4A] flex items-center gap-2"><UserPlus size={18} className="text-[#F5821F]" /> Pipeline locataires</h3>
          <button onClick={() => setShowLocForm(true)} className="flex items-center gap-1.5 bg-[#1B2A4A] text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-[#24375d] transition">
            <Plus size={14} /> Ajouter un candidat
          </button>
        </div>
        {locPipeline.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">Aucun candidat en cours de recrutement</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {locPipeline.map(l => (
              <div key={l.id} className="flex items-center justify-between p-4 gap-4 flex-wrap">
                <div>
                  <p className="font-bold text-[#1B2A4A]">{l.prenom} {l.nom}</p>
                  <p className="text-xs text-gray-500">{l.telephone} · Depuis {formatDate(l.date_recrutement)}</p>
                </div>
                <button onClick={() => activerLocataire(l.id)}
                  className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-emerald-700 transition">
                  Activer <ArrowRight size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Investisseurs prospects */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-[#1B2A4A] flex items-center gap-2"><Building2 size={18} className="text-[#F5821F]" /> Prospects investisseurs</h3>
          <button onClick={() => setShowInvForm(true)} className="flex items-center gap-1.5 bg-[#F5821F] text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-orange-500 transition">
            <Plus size={14} /> Ajouter un prospect
          </button>
        </div>
        {invProspects.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">Aucun prospect investisseur</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {invProspects.map(inv => (
              <div key={inv.id} className="flex items-center justify-between p-4 gap-4 flex-wrap">
                <div>
                  <p className="font-bold text-[#1B2A4A]">{inv.prenom} {inv.nom}</p>
                  <p className="text-xs text-gray-500">{inv.telephone} · {inv.email} · Depuis {formatDate(inv.date_entree)}</p>
                </div>
                <button onClick={() => activerInvestisseur(inv.id)}
                  className="flex items-center gap-1.5 bg-[#F5821F] text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-orange-500 transition">
                  Valider partenariat <ArrowRight size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Formulaire candidat locataire */}
      {showLocForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowLocForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#1B2A4A]">Nouveau candidat locataire</h3>
              <button onClick={() => setShowLocForm(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Nom *</label><input value={locForm.nom} onChange={e => setLocForm({ ...locForm, nom: e.target.value })} className={inputCls} /></div>
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Prénom *</label><input value={locForm.prenom} onChange={e => setLocForm({ ...locForm, prenom: e.target.value })} className={inputCls} /></div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Téléphone</label><input value={locForm.telephone} onChange={e => setLocForm({ ...locForm, telephone: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Adresse</label><input value={locForm.adresse} onChange={e => setLocForm({ ...locForm, adresse: e.target.value })} className={inputCls} /></div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1"><FileText size={13} /> Documents fournis</label>
                <textarea value={locForm.documents} onChange={e => setLocForm({ ...locForm, documents: e.target.value })} rows={2} placeholder="Ex : CNI, permis, photo, caution…" className={inputCls} />
              </div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label><textarea value={locForm.notes} onChange={e => setLocForm({ ...locForm, notes: e.target.value })} rows={2} className={inputCls} /></div>
              <button onClick={ajouterCandidatLocataire} disabled={saving} className="w-full bg-[#1B2A4A] text-white font-semibold py-2.5 rounded-xl hover:bg-[#24375d] transition disabled:opacity-50">
                {saving ? 'Enregistrement…' : 'Ajouter au pipeline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire prospect investisseur */}
      {showInvForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowInvForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#1B2A4A]">Nouveau prospect investisseur</h3>
              <button onClick={() => setShowInvForm(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Nom *</label><input value={invForm.nom} onChange={e => setInvForm({ ...invForm, nom: e.target.value })} className={inputCls} /></div>
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Prénom *</label><input value={invForm.prenom} onChange={e => setInvForm({ ...invForm, prenom: e.target.value })} className={inputCls} /></div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Téléphone</label><input value={invForm.telephone} onChange={e => setInvForm({ ...invForm, telephone: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Email</label><input value={invForm.email} onChange={e => setInvForm({ ...invForm, email: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Adresse</label><input value={invForm.adresse} onChange={e => setInvForm({ ...invForm, adresse: e.target.value })} className={inputCls} /></div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1"><FileText size={13} /> Documents fournis</label>
                <textarea value={invForm.documents} onChange={e => setInvForm({ ...invForm, documents: e.target.value })} rows={2} placeholder="Ex : pièce d'identité, contrat, justificatif moto…" className={inputCls} />
              </div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label><textarea value={invForm.notes} onChange={e => setInvForm({ ...invForm, notes: e.target.value })} rows={2} className={inputCls} /></div>
              <button onClick={ajouterProspectInvestisseur} disabled={saving} className="w-full bg-[#F5821F] text-white font-semibold py-2.5 rounded-xl hover:bg-orange-500 transition disabled:opacity-50">
                {saving ? 'Enregistrement…' : 'Ajouter aux prospects'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
