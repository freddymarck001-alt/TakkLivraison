import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AuditLog, ROLE_LABELS, formatDate, Role } from '../lib/types';
import { ClipboardList, Search } from 'lucide-react';

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
      if (data) setLogs(data as AuditLog[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    return !search || l.action.toLowerCase().includes(q) || l.user_email.toLowerCase().includes(q) || l.table_concernee.toLowerCase().includes(q);
  });

  const roleColor: Record<string, string> = {
    dg: 'bg-[#1B2A4A] text-white', daf: 'bg-emerald-700 text-white',
    do: 'bg-blue-700 text-white', dam: 'bg-orange-700 text-white', drh: 'bg-purple-700 text-white',
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par action, utilisateur, table..."
            className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <ClipboardList size={18} className="text-[#F5821F]" />
          <h3 className="font-bold text-[#1B2A4A]">Journal d'audit — {filtered.length} entrées</h3>
        </div>
        {loading ? (
          <div className="text-center py-12 text-gray-400">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
            <p>Aucune entrée</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(log => (
              <div key={log.id} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50/50 transition">
                <div className="flex-shrink-0 mt-0.5">
                  {log.user_role && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${roleColor[log.user_role] || 'bg-gray-100 text-gray-600'}`}>
                      {log.user_role.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-[#1B2A4A]">{log.action}</p>
                    <p className="text-xs text-gray-400 flex-shrink-0">{new Date(log.created_at).toLocaleString('fr-CI')}</p>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{log.user_email}</p>
                  {log.table_concernee && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full mt-1 inline-block font-mono">{log.table_concernee}</span>
                  )}
                  {log.details && Object.keys(log.details).length > 0 && (
                    <p className="text-xs text-gray-400 mt-1 font-mono truncate">
                      {JSON.stringify(log.details)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
