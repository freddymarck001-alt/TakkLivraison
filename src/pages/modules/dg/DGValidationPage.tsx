import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatCFA, formatDate } from '../../../lib/types';
import { ShieldCheck, CheckCircle, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

interface PendingItem {
  id: string;
  type: string;
  titre: string;
  details: string;
  montant?: number;
  created_at: string;
}

export default function DGValidationPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPending = async () => {
    const [commRes, invRes, pretsRes] = await Promise.all([
      supabase.from('commandes').select('id,description,montant_total,created_at,type_commande').eq('statut', 'en_attente').order('created_at', { ascending: false }),
      supabase.from('investisseurs').select('id,nom,prenom,created_at').eq('statut', 'prospect').order('created_at', { ascending: false }),
      supabase.from('prets').select('id,institution,montant,created_at,statut').eq('statut', 'en_attente').order('created_at', { ascending: false }).limit(20),
    ]);

    const pending: PendingItem[] = [
      ...(commRes.data || []).map(c => ({ id: c.id, type: 'Commande', titre: c.description, details: `Type: ${c.type_commande}`, montant: Number(c.montant_total), created_at: c.created_at })),
      ...(invRes.data || []).map(i => ({ id: i.id, type: 'Investisseur', titre: `${i.prenom} ${i.nom}`, details: 'Nouveau prospect à valider', created_at: i.created_at })),
      ...(pretsRes.data || []).map(p => ({ id: p.id, type: 'Prêt', titre: p.institution, details: 'Prêt à valider', montant: Number(p.montant), created_at: p.created_at })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setItems(pending);
    setLoading(false);
  };

  useEffect(() => {
    fetchPending();
    const sub = supabase.channel('dg-validation')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, fetchPending)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investisseurs' }, fetchPending)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prets' }, fetchPending)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const handleApprove = async (item: PendingItem) => {
    if (item.type === 'Commande') {
      await supabase.from('commandes').update({ statut: 'validee' }).eq('id', item.id);
    } else if (item.type === 'Investisseur') {
      await supabase.from('investisseurs').update({ statut: 'actif' }).eq('id', item.id);
    } else if (item.type === 'Prêt') {
      await supabase.from('prets').update({ statut: 'en_cours' }).eq('id', item.id);
    }
    await supabase.from('audit_logs').insert({
      user_email: profile?.email, user_role: profile?.role,
      action: `Validation DG : ${item.type} approuvé`, table_concernee: item.type.toLowerCase(),
      reference_id: item.id,
    });
    setItems(prev => prev.filter(i => i.id !== item.id));
  };

  const handleReject = async (item: PendingItem) => {
    if (item.type === 'Commande') {
      await supabase.from('commandes').update({ statut: 'annulee' }).eq('id', item.id);
    } else if (item.type === 'Investisseur') {
      await supabase.from('investisseurs').update({ statut: 'inactif' }).eq('id', item.id);
    } else if (item.type === 'Prêt') {
      await supabase.from('prets').update({ statut: 'refuse' }).eq('id', item.id);
    }
    await supabase.from('audit_logs').insert({
      user_email: profile?.email, user_role: profile?.role,
      action: `Validation DG : ${item.type} rejeté`, table_concernee: item.type.toLowerCase(),
      reference_id: item.id,
    });
    setItems(prev => prev.filter(i => i.id !== item.id));
  };

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
        <ShieldCheck size={16} />
        <span>La file de validation liste les éléments nécessitant l'approbation du Directeur Général.</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <CheckCircle size={48} className="mx-auto text-emerald-400 mb-3" />
          <p className="text-gray-500 font-semibold text-lg">Aucun élément en attente de validation</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    item.type === 'Commande' ? 'bg-blue-100 text-blue-700' :
                    item.type === 'Investisseur' ? 'bg-[#F5821F]/20 text-[#F5821F]' :
                    'bg-purple-100 text-purple-700'
                  }`}>{item.type}</span>
                  <h3 className="font-bold text-[#1B2A4A]">{item.titre}</h3>
                </div>
                <p className="text-xs text-gray-500">{item.details}</p>
                {item.montant && <p className="text-sm font-bold text-[#F5821F] mt-1">{formatCFA(item.montant)}</p>}
                <p className="text-xs text-gray-400 mt-1">{formatDate(item.created_at)}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => handleApprove(item)}
                  className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-emerald-700 transition">
                  <CheckCircle size={14} /> Approuver
                </button>
                <button onClick={() => handleReject(item)} className="flex items-center gap-1.5 border border-red-300 text-red-600 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-red-50 transition">
                  <X size={14} /> Rejeter
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
