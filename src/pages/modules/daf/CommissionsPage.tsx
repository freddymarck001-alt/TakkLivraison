import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Investisseur, Moto, formatCFA } from '../../../lib/types';
import { Building2 } from 'lucide-react';

interface InvWithMotos extends Investisseur {
  motos: Moto[];
  revenuBrut: number;
  commissionTAKK: number;
  commissionInv: number;
}

export default function CommissionsPage() {
  const [investisseurs, setInvestisseurs] = useState<InvWithMotos[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [invRes, motosRes, recRes] = await Promise.all([
        supabase.from('investisseurs').select('*').neq('statut', 'prospect').order('nom'),
        supabase.from('motos').select('id,investisseur_id,matricule,statut').eq('proprietaire', 'investisseur'),
        supabase.from('recettes').select('moto_id,montant_recu'),
      ]);

      const recettesByMoto = new Map<string, number>();
      (recRes.data || []).forEach(r => {
        recettesByMoto.set(r.moto_id, (recettesByMoto.get(r.moto_id) || 0) + Number(r.montant_recu));
      });

      const motosByInv = new Map<string, Moto[]>();
      (motosRes.data || []).forEach(m => {
        if (m.investisseur_id) {
          if (!motosByInv.has(m.investisseur_id)) motosByInv.set(m.investisseur_id, []);
          motosByInv.get(m.investisseur_id)!.push(m as Moto);
        }
      });

      const result: InvWithMotos[] = (invRes.data || []).map(inv => {
        const motos = motosByInv.get(inv.id) || [];
        const revenuBrut = motos.reduce((s, m) => s + (recettesByMoto.get(m.id) || 0), 0);
        return {
          ...inv as Investisseur,
          motos,
          revenuBrut,
          commissionTAKK: Math.round(revenuBrut * 0.2),
          commissionInv: Math.round(revenuBrut * 0.8),
        };
      });

      setInvestisseurs(result);
      setLoading(false);
    };
    fetch();
  }, []);

  const totalRevenu = investisseurs.reduce((s, i) => s + i.revenuBrut, 0);
  const totalTAKK = investisseurs.reduce((s, i) => s + i.commissionTAKK, 0);
  const totalInv = investisseurs.reduce((s, i) => s + i.commissionInv, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1B2A4A] text-white rounded-xl p-4">
          <p className="text-xs opacity-70">Revenu total investisseurs</p>
          <p className="text-xl font-bold mt-1">{formatCFA(totalRevenu)}</p>
        </div>
        <div className="bg-[#F5821F] text-white rounded-xl p-4">
          <p className="text-xs opacity-70">Commission TAKK (20%)</p>
          <p className="text-xl font-bold mt-1">{formatCFA(totalTAKK)}</p>
        </div>
        <div className="bg-emerald-600 text-white rounded-xl p-4">
          <p className="text-xs opacity-70">Dû aux investisseurs (80%)</p>
          <p className="text-xl font-bold mt-1">{formatCFA(totalInv)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#1B2A4A]">Commissions par investisseur</h3>
          <p className="text-xs text-gray-500 mt-0.5">Répartition : 80% investisseur · 20% TAKK (gestion)</p>
        </div>
        {loading ? (
          <div className="text-center py-12 text-gray-400">Chargement...</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {investisseurs.map(inv => (
              <div key={inv.id} className="p-5">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <h4 className="font-bold text-[#1B2A4A]">{inv.prenom} {inv.nom}</h4>
                    <p className="text-xs text-gray-500">{inv.telephone} · {inv.motos.length} moto(s) confiée(s)</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${inv.statut === 'actif' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {inv.statut}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-[#F7F8FA] rounded-xl p-3">
                    <p className="text-xs text-gray-500">Motos</p>
                    <p className="font-bold text-[#1B2A4A]">{inv.motos.length}</p>
                    <p className="text-xs text-gray-400">{inv.motos.map(m => m.matricule).join(', ')}</p>
                  </div>
                  <div className="bg-[#F7F8FA] rounded-xl p-3">
                    <p className="text-xs text-gray-500">Revenu brut</p>
                    <p className="font-bold text-[#1B2A4A]">{formatCFA(inv.revenuBrut)}</p>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-3">
                    <p className="text-xs text-[#F5821F]">Commission TAKK (20%)</p>
                    <p className="font-bold text-[#F5821F]">{formatCFA(inv.commissionTAKK)}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3">
                    <p className="text-xs text-emerald-600">Dû à l'investisseur (80%)</p>
                    <p className="font-bold text-emerald-700">{formatCFA(inv.commissionInv)}</p>
                    <p className="text-xs text-gray-400 mt-1">Déjà versé : {formatCFA(Number(inv.total_commissions_versees))}</p>
                  </div>
                </div>
                {/* Motos list */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {inv.motos.map(m => (
                    <span key={m.id} className={`text-xs px-2 py-1 rounded-full font-mono ${
                      m.statut === 'active' ? 'bg-emerald-100 text-emerald-800' :
                      m.statut === 'en_panne' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {m.matricule} · {m.statut}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {investisseurs.length === 0 && (
              <div className="text-center py-16">
                <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-400">Aucun investisseur actif</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
