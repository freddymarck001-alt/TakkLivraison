import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Recette, formatCFA, formatDate } from '../../../lib/types';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

export default function ImpayesPage() {
  const { profile } = useAuth();
  const [impayes, setImpayes] = useState<Recette[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchImpayes = async () => {
    const { data } = await supabase
      .from('recettes')
      .select('*, motos(matricule), locataires(nom,prenom,telephone)')
      .in('statut', ['impaye', 'partiel'])
      .order('semaine_debut', { ascending: false });
    if (data) setImpayes(data as Recette[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchImpayes();
    const sub = supabase.channel('impayes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recettes' }, fetchImpayes)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const handleRecouvrer = async (recette: Recette) => {
    await supabase.from('recettes').update({
      montant_recu: recette.montant_attendu,
      statut: 'paye',
      date_paiement: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', recette.id);

    if (recette.locataire_id) {
      await supabase.from('locataires').update({
        solde_impaye: 0,
        updated_at: new Date().toISOString(),
      }).eq('id', recette.locataire_id);
    }
    await supabase.from('audit_logs').insert({
      user_email: profile?.email, user_role: profile?.role,
      action: 'Recouvrement impayé', table_concernee: 'recettes',
      reference_id: recette.id,
      details: { montant: recette.montant_attendu },
    });
    fetchImpayes();
  };

  const totalImpayes = impayes.reduce((s, r) => s + (Number(r.montant_attendu) - Number(r.montant_recu)), 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-red-600 text-white rounded-xl p-4">
          <p className="text-xs opacity-70 uppercase tracking-wider">Total impayés</p>
          <p className="text-2xl font-bold mt-1">{formatCFA(totalImpayes)}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Dossiers en cours</p>
          <p className="text-2xl font-bold text-[#1B2A4A] mt-1">{impayes.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#1B2A4A] flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" /> Impayés et paiements partiels
          </h3>
        </div>
        {loading ? (
          <div className="text-center py-12 text-gray-400">Chargement...</div>
        ) : impayes.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle size={40} className="mx-auto text-emerald-400 mb-3" />
            <p className="text-gray-500 font-semibold">Aucun impayé en cours !</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {impayes.map(r => {
              const moto = (r.motos as unknown as { matricule: string })?.matricule || '—';
              const loc = r.locataires;
              const manque = Number(r.montant_attendu) - Number(r.montant_recu);
              return (
                <div key={r.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-sm font-bold text-[#1B2A4A]">{moto}</span>
                      {loc && (
                        <span className="text-sm text-gray-700">{loc.prenom} {loc.nom}</span>
                      )}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        r.statut === 'impaye' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {r.statut === 'impaye' ? 'Impayé' : 'Partiel'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">Semaine du {formatDate(r.semaine_debut)} · {r.jours_travailles} jours</p>
                    <div className="flex gap-4 text-xs mt-1">
                      <span className="text-gray-600">Attendu : <strong>{formatCFA(Number(r.montant_attendu))}</strong></span>
                      <span className="text-gray-600">Reçu : <strong className="text-emerald-600">{formatCFA(Number(r.montant_recu))}</strong></span>
                      <span className="text-red-600 font-bold">Manque : {formatCFA(manque)}</span>
                    </div>
                    {loc?.telephone && (
                      <p className="text-xs text-gray-400 mt-1">Contact : {loc.telephone}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRecouvrer(r)}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-emerald-700 transition flex-shrink-0"
                  >
                    <CheckCircle size={14} /> Marquer recouvré
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
