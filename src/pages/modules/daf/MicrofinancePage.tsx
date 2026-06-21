import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Pret, EcheancePret, formatCFA, formatDate } from '../../../lib/types';
import { CreditCard, Plus, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, Clock, Save, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const computeEcheancier = (montant: number, taux: number, duree: number, dateDebut: string): Omit<EcheancePret, 'id' | 'pret_id' | 'created_at'>[] => {
  const r = taux / 100;
  const mensualite = Math.round(montant * r / (1 - Math.pow(1 + r, -duree)));
  const echeances = [];
  let capital = montant;
  for (let i = 1; i <= duree; i++) {
    const interet = Math.round(capital * r);
    const capitalRembourse = Math.min(mensualite - interet, capital);
    const capitalFin = Math.max(capital - capitalRembourse, 0);
    const date = new Date(dateDebut);
    date.setMonth(date.getMonth() + i);
    echeances.push({
      numero_echeance: i,
      date_echeance: date.toISOString().split('T')[0],
      capital_debut: capital,
      interet,
      capital_rembourse: capitalRembourse,
      mensualite: i < duree ? mensualite : capital + interet,
      capital_fin: capitalFin,
      statut: 'a_payer' as const,
      date_paiement: null,
    });
    capital = capitalFin;
  }
  return echeances;
};

export default function MicrofinancePage() {
  const { profile } = useAuth();
  const [prets, setPrets] = useState<Pret[]>([]);
  const [echeances, setEcheances] = useState<Record<string, EcheancePret[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    institution: '', montant: 2000000, taux_mensuel: 2.5, duree_mois: 12, date_debut: new Date().toISOString().split('T')[0], notes: ''
  });
  const [preview, setPreview] = useState<ReturnType<typeof computeEcheancier>>([]);
  const [saving, setSaving] = useState(false);

  const fetchPrets = async () => {
    const { data } = await supabase.from('prets').select('*').order('date_debut', { ascending: false });
    if (data) setPrets(data as Pret[]);
    setLoading(false);
  };

  const fetchEcheances = async (pretId: string) => {
    if (echeances[pretId]) return;
    const { data } = await supabase.from('echeances_pret').select('*').eq('pret_id', pretId).order('numero_echeance');
    if (data) setEcheances(prev => ({ ...prev, [pretId]: data as EcheancePret[] }));
  };

  useEffect(() => {
    fetchPrets();
    const sub = supabase.channel('microfinance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prets' }, fetchPrets)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  useEffect(() => {
    if (form.montant && form.taux_mensuel && form.duree_mois && form.date_debut) {
      setPreview(computeEcheancier(form.montant, form.taux_mensuel, form.duree_mois, form.date_debut));
    }
  }, [form.montant, form.taux_mensuel, form.duree_mois, form.date_debut]);

  const handleSave = async () => {
    setSaving(true);
    const { data: newPret } = await supabase.from('prets').insert({
      institution: form.institution,
      montant: form.montant,
      taux_mensuel: form.taux_mensuel,
      duree_mois: form.duree_mois,
      date_debut: form.date_debut,
      capital_restant: form.montant,
      statut: 'en_cours',
      notes: form.notes,
      created_by: profile?.id,
    }).select().single();

    if (newPret) {
      const echs = computeEcheancier(form.montant, form.taux_mensuel, form.duree_mois, form.date_debut);
      await supabase.from('echeances_pret').insert(echs.map(e => ({ ...e, pret_id: newPret.id })));
      await supabase.from('audit_logs').insert({
        user_email: profile?.email, user_role: profile?.role,
        action: 'Nouveau prêt', table_concernee: 'prets',
        details: { institution: form.institution, montant: form.montant },
      });
      await supabase.from('notifications').insert({
        destinataire_role: 'dg',
        titre: 'Nouveau prêt contracté',
        message: `${form.institution} — ${formatCFA(form.montant)} à ${form.taux_mensuel}%/mois sur ${form.duree_mois} mois`,
        type: 'info',
      });
    }

    setSaving(false);
    setShowForm(false);
    fetchPrets();
  };

  const handleToggle = (id: string) => {
    if (expanded === id) {
      setExpanded(null);
    } else {
      setExpanded(id);
      fetchEcheances(id);
    }
  };

  const totalCapitalRestant = prets.filter(p => p.statut === 'en_cours').reduce((s, p) => s + Number(p.capital_restant), 0);

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-[#1B2A4A] text-white rounded-xl p-4">
          <p className="text-xs opacity-70">Prêts actifs</p>
          <p className="text-3xl font-bold">{prets.filter(p => p.statut === 'en_cours').length}</p>
        </div>
        <div className="bg-[#F5821F] text-white rounded-xl p-4">
          <p className="text-xs opacity-70">Capital restant dû</p>
          <p className="text-xl font-bold">{formatCFA(totalCapitalRestant)}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-500">Prêts remboursés</p>
          <p className="text-3xl font-bold text-emerald-600">{prets.filter(p => p.statut === 'rembourse').length}</p>
        </div>
      </div>

      {/* Add button */}
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#1B2A4A] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#243660] transition">
          <Plus size={16} /> Nouveau prêt
        </button>
      </div>

      {/* Prêts list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : (
        <div className="space-y-3">
          {prets.map(pret => {
            const isExpanded = expanded === pret.id;
            const echs = echeances[pret.id] || [];
            const prochaine = echs.find(e => e.statut === 'a_payer');
            return (
              <div key={pret.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50/50 transition"
                  onClick={() => handleToggle(pret.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="font-bold text-[#1B2A4A]">{pret.institution}</h3>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        pret.statut === 'en_cours' ? 'bg-blue-100 text-blue-700' :
                        pret.statut === 'rembourse' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {pret.statut}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span>Montant initial : <strong>{formatCFA(Number(pret.montant))}</strong></span>
                      <span>Taux : <strong>{pret.taux_mensuel}%/mois</strong></span>
                      <span>Durée : <strong>{pret.duree_mois} mois</strong></span>
                      <span>Capital restant : <strong className="text-red-600">{formatCFA(Number(pret.capital_restant))}</strong></span>
                    </div>
                    {prochaine && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-orange-600 font-semibold">
                        <AlertTriangle size={12} />
                        Prochaine échéance : {formatCFA(prochaine.mensualite)} le {formatDate(prochaine.date_echeance)}
                      </div>
                    )}
                  </div>
                  <div className="ml-3 flex-shrink-0">
                    {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                  </div>
                </div>

                {isExpanded && echs.length > 0 && (
                  <div className="border-t border-gray-100">
                    {/* Mini chart */}
                    <div className="p-4">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Échéancier de remboursement</h4>
                      <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={echs.map(e => ({ num: `#${e.numero_echeance}`, capital: Number(e.capital_rembourse), interet: Number(e.interet) }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="num" tick={{ fontSize: 9 }} />
                          <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9 }} />
                          <Tooltip formatter={(v: number) => formatCFA(v)} />
                          <Bar dataKey="capital" name="Capital" fill="#1B2A4A" stackId="a" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="interet" name="Intérêt" fill="#F5821F" stackId="a" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#F7F8FA] border-b border-gray-100">
                            <th className="text-left px-3 py-2 font-bold text-gray-500">N°</th>
                            <th className="text-left px-3 py-2 font-bold text-gray-500">Date</th>
                            <th className="text-right px-3 py-2 font-bold text-gray-500">Capital déb.</th>
                            <th className="text-right px-3 py-2 font-bold text-gray-500">Intérêt</th>
                            <th className="text-right px-3 py-2 font-bold text-gray-500">Capital remb.</th>
                            <th className="text-right px-3 py-2 font-bold text-gray-500">Mensualité</th>
                            <th className="text-right px-3 py-2 font-bold text-gray-500">Capital fin</th>
                            <th className="text-center px-3 py-2 font-bold text-gray-500">Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {echs.map(e => (
                            <tr key={e.id} className={`border-b border-gray-50 ${e.statut === 'paye' ? 'bg-green-50/30' : e.statut === 'en_retard' ? 'bg-red-50/30' : ''}`}>
                              <td className="px-3 py-2 font-bold text-[#1B2A4A]">{e.numero_echeance}</td>
                              <td className="px-3 py-2 font-mono text-gray-600">{formatDate(e.date_echeance)}</td>
                              <td className="px-3 py-2 text-right text-gray-600">{Number(e.capital_debut).toLocaleString('fr-CI')}</td>
                              <td className="px-3 py-2 text-right text-[#F5821F] font-semibold">{Number(e.interet).toLocaleString('fr-CI')}</td>
                              <td className="px-3 py-2 text-right text-[#1B2A4A]">{Number(e.capital_rembourse).toLocaleString('fr-CI')}</td>
                              <td className="px-3 py-2 text-right font-bold text-[#1B2A4A]">{Number(e.mensualite).toLocaleString('fr-CI')}</td>
                              <td className="px-3 py-2 text-right text-gray-600">{Number(e.capital_fin).toLocaleString('fr-CI')}</td>
                              <td className="px-3 py-2 text-center">
                                {e.statut === 'paye' ? <CheckCircle size={14} className="text-emerald-500 mx-auto" /> :
                                  e.statut === 'en_retard' ? <AlertTriangle size={14} className="text-red-500 mx-auto" /> :
                                  <Clock size={14} className="text-gray-400 mx-auto" />}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {prets.length === 0 && <div className="text-center py-16 text-gray-400"><CreditCard size={40} className="mx-auto mb-3 opacity-30" /><p>Aucun prêt enregistré</p></div>}
        </div>
      )}

      {/* New Loan Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-[#1B2A4A] flex items-center gap-2"><CreditCard size={18} className="text-[#F5821F]" /> Nouveau prêt micro-finance</h3>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Institution prêteuse *</label>
                <input value={form.institution} onChange={e => setForm({ ...form, institution: e.target.value })} placeholder="ex: COOPEC, Advans, Baobab..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Montant (FCFA) *</label>
                  <input type="number" value={form.montant} onChange={e => setForm({ ...form, montant: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Taux mensuel (%)</label>
                  <input type="number" step="0.1" value={form.taux_mensuel} onChange={e => setForm({ ...form, taux_mensuel: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Durée (mois)</label>
                  <input type="number" value={form.duree_mois} onChange={e => setForm({ ...form, duree_mois: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Date de début</label>
                  <input type="date" value={form.date_debut} onChange={e => setForm({ ...form, date_debut: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
                </div>
              </div>

              {/* Preview */}
              {preview.length > 0 && (
                <div className="bg-[#F7F8FA] rounded-xl p-3 border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 mb-2">Aperçu — Mensualité : <span className="text-[#F5821F]">{formatCFA(preview[0]?.mensualite || 0)}</span></p>
                  <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                    {preview.slice(0, 6).map(e => (
                      <div key={e.numero_echeance} className="flex justify-between text-gray-600">
                        <span>Mois {e.numero_echeance} ({formatDate(e.date_echeance)})</span>
                        <span>Intérêt: {Number(e.interet).toLocaleString('fr-CI')} | Capital: {Number(e.capital_rembourse).toLocaleString('fr-CI')}</span>
                      </div>
                    ))}
                    {preview.length > 6 && <p className="text-gray-400">… et {preview.length - 6} mois supplémentaires</p>}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F] resize-none" />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Annuler</button>
              <button onClick={handleSave} disabled={saving || !form.institution}
                className="px-5 py-2.5 rounded-xl bg-[#1B2A4A] text-white text-sm font-semibold flex items-center gap-2 hover:bg-[#243660] disabled:opacity-50">
                <Save size={15} /> {saving ? 'Enregistrement...' : 'Enregistrer et générer l\'échéancier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
