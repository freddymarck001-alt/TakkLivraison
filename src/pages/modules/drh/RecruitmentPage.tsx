import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Locataire, Investisseur, formatDate } from '../../../lib/types';
import { UserPlus, Users, Building2, ArrowRight } from 'lucide-react';

export default function RecruitmentPage() {
  const [locPipeline, setLocPipeline] = useState<Locataire[]>([]);
  const [invProspects, setInvProspects] = useState<Investisseur[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [locRes, invRes] = await Promise.all([
        supabase.from('locataires').select('*').eq('statut', 'en_cours_recrutement').order('date_recrutement', { ascending: false }),
        supabase.from('investisseurs').select('*').eq('statut', 'prospect').order('date_entree', { ascending: false }),
      ]);
      if (locRes.data) setLocPipeline(locRes.data as Locataire[]);
      if (invRes.data) setInvProspects(invRes.data as Investisseur[]);
      setLoading(false);
    };
    fetch();
    const sub = supabase.channel('recruitment')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locataires' }, fetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investisseurs' }, fetch)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const activerLocataire = async (id: string) => {
    await supabase.from('locataires').update({ statut: 'actif', updated_at: new Date().toISOString() }).eq('id', id);
    setLocPipeline(prev => prev.filter(l => l.id !== id));
  };

  const activerInvestisseur = async (id: string) => {
    await supabase.from('investisseurs').update({ statut: 'actif', updated_at: new Date().toISOString() }).eq('id', id);
    await supabase.from('notifications').insert({ destinataire_role: 'dg', titre: 'Investisseur validé', message: 'Nouveau partenaire investisseur activé', type: 'succes' });
    setInvProspects(prev => prev.filter(i => i.id !== id));
  };

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
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#1B2A4A] flex items-center gap-2"><UserPlus size={18} className="text-[#F5821F]" /> Pipeline locataires</h3>
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
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#1B2A4A] flex items-center gap-2"><Building2 size={18} className="text-[#F5821F]" /> Prospects investisseurs</h3>
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
    </div>
  );
}
