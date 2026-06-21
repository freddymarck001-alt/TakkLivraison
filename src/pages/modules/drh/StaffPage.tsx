import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Profile, ROLE_LABELS, Role } from '../../../lib/types';
import { Users, UserPlus } from 'lucide-react';

const roleColors: Record<Role, string> = {
  dg: 'bg-[#1B2A4A] text-white',
  daf: 'bg-emerald-700 text-white',
  do: 'bg-blue-700 text-white',
  dam: 'bg-orange-700 text-white',
  drh: 'bg-purple-700 text-white',
};

export default function StaffPage() {
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('profiles').select('*').order('role').then(({ data }) => {
      if (data) setStaff(data as Profile[]);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1B2A4A] text-white rounded-xl p-4">
          <p className="text-xs opacity-70">Total personnel</p>
          <p className="text-3xl font-bold">{staff.length}</p>
        </div>
        <div className="bg-[#F5821F] text-white rounded-xl p-4">
          <p className="text-xs opacity-70">Directeurs actifs</p>
          <p className="text-3xl font-bold">{staff.filter(s => s.actif).length}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-500">Postes de direction</p>
          <p className="text-3xl font-bold text-[#1B2A4A]">5</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {staff.map(s => (
          <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 ${roleColors[s.role] || 'bg-gray-200 text-gray-700'}`}>
              {s.prenom?.[0]}{s.nom?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[#1B2A4A]">{s.prenom} {s.nom}</p>
              <p className="text-xs text-gray-500 truncate">{s.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${roleColors[s.role] || 'bg-gray-100 text-gray-600'}`}>{s.role.toUpperCase()}</span>
                <span className="text-xs text-gray-500">{ROLE_LABELS[s.role]}</span>
              </div>
            </div>
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.actif ? 'bg-emerald-500' : 'bg-gray-300'}`} title={s.actif ? 'Actif' : 'Inactif'} />
          </div>
        ))}
        {staff.length === 0 && !loading && (
          <div className="col-span-2 text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Users size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400">Aucun membre du personnel enregistré</p>
            <p className="text-xs text-gray-400 mt-1">Les comptes apparaissent après première connexion</p>
          </div>
        )}
      </div>
    </div>
  );
}
