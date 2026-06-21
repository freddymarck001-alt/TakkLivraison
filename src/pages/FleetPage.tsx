import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Moto, formatCFA, formatDate } from '../lib/types';
import { Bike, Plus, Search, Filter, MapPin, AlertTriangle, CheckCircle, Clock, Wifi, WifiOff } from 'lucide-react';
import MotoModal from '../components/MotoModal';

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  en_panne: 'En panne',
  immobilisee: 'Immobilisée',
  disponible: 'Disponible',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  en_panne: 'bg-red-100 text-red-800',
  immobilisee: 'bg-yellow-100 text-yellow-800',
  disponible: 'bg-blue-100 text-blue-800',
};

const GPS_STATUS_LABELS: Record<string, string> = {
  connecte: 'Connecté',
  non_connecte: 'Non connecté',
  hors_ligne: 'Hors ligne',
};

const GPS_STATUS_COLORS: Record<string, string> = {
  connecte: 'bg-emerald-100 text-emerald-700',
  non_connecte: 'bg-gray-100 text-gray-600',
  hors_ligne: 'bg-red-100 text-red-700',
};

const StatusIcon = ({ statut }: { statut: string }) => {
  if (statut === 'active') return <CheckCircle size={14} className="text-emerald-600" />;
  if (statut === 'en_panne') return <AlertTriangle size={14} className="text-red-600" />;
  if (statut === 'immobilisee') return <Clock size={14} className="text-yellow-600" />;
  return <Bike size={14} className="text-blue-600" />;
};

export default function FleetPage() {
  const { profile } = useAuth();
  const [motos, setMotos] = useState<Moto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterProp, setFilterProp] = useState('');
  const [selected, setSelected] = useState<Moto | null>(null);
  const [showModal, setShowModal] = useState(false);

  const canEdit = profile?.role === 'dg' || profile?.role === 'daf' || profile?.role === 'do' || profile?.role === 'dam';

  const fetchMotos = async () => {
    const { data } = await supabase
      .from('motos')
      .select('*, locataires(id,nom,prenom,telephone), investisseurs(id,nom,prenom)')
      .order('matricule');
    if (data) setMotos(data as Moto[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchMotos();
    const sub = supabase
      .channel('fleet-motos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'motos' }, fetchMotos)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const filtered = motos.filter(m => {
    const q = search.toLowerCase();
    const matchQ = m.matricule.toLowerCase().includes(q) ||
      m.marque.toLowerCase().includes(q) ||
      (m.locataires && `${m.locataires.prenom} ${m.locataires.nom}`.toLowerCase().includes(q));
    const matchStatut = filterStatut ? m.statut === filterStatut : true;
    const matchProp = filterProp ? m.proprietaire === filterProp : true;
    return matchQ && matchStatut && matchProp;
  });

  const stats = {
    total: motos.length,
    active: motos.filter(m => m.statut === 'active').length,
    en_panne: motos.filter(m => m.statut === 'en_panne').length,
    takk: motos.filter(m => m.proprietaire === 'takk').length,
    investisseur: motos.filter(m => m.proprietaire === 'investisseur').length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total flotte', value: stats.total, color: 'bg-[#1B2A4A] text-white' },
          { label: 'Actives', value: stats.active, color: 'bg-emerald-600 text-white' },
          { label: 'En panne', value: stats.en_panne, color: 'bg-red-600 text-white' },
          { label: 'TAKK', value: stats.takk, color: 'bg-blue-600 text-white' },
          { label: 'Investisseurs', value: stats.investisseur, color: 'bg-[#F5821F] text-white' },
        ].map(s => (
          <div key={s.label} className={`${s.color} rounded-xl p-3 text-center shadow-sm`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs opacity-80 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-1 gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher une moto, un locataire..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5821F] bg-[#F7F8FA]"
              />
            </div>
            <select
              value={filterStatut}
              onChange={e => setFilterStatut(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]"
            >
              <option value="">Tous les statuts</option>
              <option value="active">Active</option>
              <option value="en_panne">En panne</option>
              <option value="immobilisee">Immobilisée</option>
              <option value="disponible">Disponible</option>
            </select>
            <select
              value={filterProp}
              onChange={e => setFilterProp(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]"
            >
              <option value="">Tous propriétaires</option>
              <option value="takk">TAKK</option>
              <option value="investisseur">Investisseur</option>
            </select>
          </div>
          <button
            onClick={() => { setSelected(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-[#1B2A4A] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#243660] transition"
          >
            <Plus size={16} /> Ajouter moto
          </button>
        </div>
      </div>

      {/* Table or Empty State */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-[#F5821F] rounded-full animate-spin mx-auto mb-3" />
            <p>Chargement de la flotte...</p>
          </div>
        ) : motos.length === 0 ? (
          <div className="text-center py-16">
            <Bike size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium mb-2">Aucune moto pour le moment</p>
            <p className="text-sm text-gray-400 mb-4">Commencez par ajouter votre première moto à la flotte</p>
            <button
              onClick={() => { setSelected(null); setShowModal(true); }}
              className="inline-flex items-center gap-2 bg-[#F5821F] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-orange-500 transition"
            >
              <Plus size={16} /> Ajouter une moto
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Filter size={40} className="mx-auto mb-3 opacity-30" />
            <p>Aucune moto ne correspond aux filtres</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-[#F7F8FA]">
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Matricule</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Modèle</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Propriétaire</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Locataire</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">GPS</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Km</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Achat</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((moto, i) => (
                  <tr
                    key={moto.id}
                    className={`border-b border-gray-50 hover:bg-orange-50/40 cursor-pointer transition ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                    onClick={() => { setSelected(moto); setShowModal(true); }}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-bold text-[#1B2A4A]">{moto.matricule}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{moto.marque} {moto.modele} {moto.annee}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[moto.statut]}`}>
                        <StatusIcon statut={moto.statut} />
                        {STATUS_LABELS[moto.statut]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${moto.proprietaire === 'takk' ? 'bg-[#1B2A4A] text-white' : 'bg-[#F5821F] text-white'}`}>
                        {moto.proprietaire === 'takk' ? 'TAKK' : 'Investisseur'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {moto.locataires ? `${moto.locataires.prenom} ${moto.locataires.nom}` : <span className="text-gray-400 italic">Non assigné</span>}
                    </td>
                    <td className="px-4 py-3">
                      {moto.gps_identifiant ? (
                        <div className="flex items-center gap-1.5">
                          {moto.gps_status === 'connecte' ? (
                            <Wifi size={14} className="text-emerald-600" />
                          ) : (
                            <WifiOff size={14} className="text-red-500" />
                          )}
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${GPS_STATUS_COLORS[moto.gps_status] || 'bg-gray-100 text-gray-600'}`}>
                            {GPS_STATUS_LABELS[moto.gps_status] || 'Non connecté'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic flex items-center gap-1">
                          <WifiOff size={12} /> Non connecté
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{moto.kilometrage.toLocaleString('fr-CI')} km</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(moto.date_achat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <MotoModal
          moto={selected}
          canEdit={canEdit}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchMotos(); }}
        />
      )}
    </div>
  );
}
