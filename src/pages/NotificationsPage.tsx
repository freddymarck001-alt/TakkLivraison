import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Notification, formatDate } from '../lib/types';
import { Bell, CheckCheck, Info, AlertTriangle, AlertOctagon, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const TYPE_CONFIG = {
  info: { icon: Info, class: 'border-blue-200 bg-blue-50', iconClass: 'text-blue-500', label: 'Info' },
  alerte: { icon: AlertTriangle, class: 'border-orange-200 bg-orange-50', iconClass: 'text-orange-500', label: 'Alerte' },
  urgence: { icon: AlertOctagon, class: 'border-red-200 bg-red-50', iconClass: 'text-red-500', label: 'Urgence' },
  succes: { icon: CheckCircle, class: 'border-emerald-200 bg-emerald-50', iconClass: 'text-emerald-500', label: 'Succès' },
};

export default function NotificationsPage() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLue, setFilterLue] = useState<boolean | null>(null);

  const fetch = async () => {
    if (!profile) return;
    let q = supabase.from('notifications').select('*')
      .eq('destinataire_role', profile.role)
      .order('created_at', { ascending: false });
    if (filterLue !== null) q = q.eq('lue', filterLue);
    const { data } = await q.limit(100);
    if (data) setNotifications(data as Notification[]);
    setLoading(false);
  };

  useEffect(() => {
    fetch();
    if (!profile) return;
    const sub = supabase.channel('notifs-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetch)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [profile, filterLue]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ lue: true, lue_le: new Date().toISOString() }).eq('id', id);
    fetch();
  };

  const markAllRead = async () => {
    if (!profile) return;
    await supabase.from('notifications').update({ lue: true, lue_le: new Date().toISOString() })
      .eq('destinataire_role', profile.role).eq('lue', false);
    fetch();
  };

  const unreadCount = notifications.filter(n => !n.lue).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {[null, false, true].map((v, i) => (
            <button key={i} onClick={() => setFilterLue(v)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${filterLue === v ? 'bg-[#1B2A4A] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              {v === null ? 'Toutes' : v ? 'Lues' : 'Non lues'}
              {v === false && unreadCount > 0 && <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead}
            className="flex items-center gap-2 text-sm text-[#1B2A4A] hover:text-[#F5821F] font-semibold transition">
            <CheckCheck size={16} /> Tout marquer comme lu
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Chargement...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <Bell size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-semibold">Aucune notification</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
            const Icon = cfg.icon;
            return (
              <div key={n.id}
                className={`flex items-start gap-3 p-4 rounded-2xl border transition ${n.lue ? 'bg-white border-gray-100 opacity-70' : `${cfg.class} border`}`}
                onClick={() => !n.lue && markRead(n.id)}
              >
                <div className={`flex-shrink-0 mt-0.5 ${cfg.iconClass}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <p className={`text-sm font-bold ${n.lue ? 'text-gray-600' : 'text-[#1B2A4A]'}`}>{n.titre}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.iconClass} bg-white/60`}>{cfg.label}</span>
                      {!n.lue && <span className="w-2 h-2 bg-[#F5821F] rounded-full flex-shrink-0" />}
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(n.created_at)}</p>
                </div>
                {!n.lue && (
                  <button onClick={e => { e.stopPropagation(); markRead(n.id); }}
                    className="flex-shrink-0 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-2 py-1 rounded-lg hover:bg-white transition">
                    Lu
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
