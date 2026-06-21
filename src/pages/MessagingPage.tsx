import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Profile, ROLE_LABELS, formatDate } from '../lib/types';
import { MessageSquare, Send, Plus, X, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Msg {
  id: string;
  expediteur_id: string;
  destinataire_id: string | null;
  sujet: string;
  contenu: string;
  lu: boolean;
  created_at: string;
}

export default function MessagingPage() {
  const { profile, user } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Msg | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [form, setForm] = useState({ destinataire_id: '', sujet: '', contenu: '' });
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox');
  const [loading, setLoading] = useState(true);

  const fetchMsgs = async () => {
    if (!user) return;
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(100);
    if (data) setMsgs(data as Msg[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchMsgs();
    supabase.from('profiles').select('id,email,nom,prenom,role').then(({ data }) => setUsers(data as Profile[] || []));
    const sub = supabase.channel('messages-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchMsgs)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [user]);

  const handleSend = async () => {
    if (!user || !form.contenu.trim()) return;
    setSending(true);
    await supabase.from('messages').insert({
      expediteur_id: user.id,
      destinataire_id: form.destinataire_id || null,
      sujet: form.sujet,
      contenu: form.contenu,
    });
    setSending(false);
    setShowCompose(false);
    setForm({ destinataire_id: '', sujet: '', contenu: '' });
    fetchMsgs();
  };

  const handleSelect = async (msg: Msg) => {
    setSelected(msg);
    if (!msg.lu && msg.destinataire_id === user?.id) {
      await supabase.from('messages').update({ lu: true, lu_le: new Date().toISOString() }).eq('id', msg.id);
      fetchMsgs();
    }
  };

  const inbox = msgs.filter(m => m.destinataire_id === user?.id || m.destinataire_id === null);
  const sent = msgs.filter(m => m.expediteur_id === user?.id);
  const displayed = tab === 'inbox' ? inbox : sent;
  const getUserName = (id: string) => {
    const u = users.find(u => u.id === id);
    return u ? `${u.prenom} ${u.nom} (${ROLE_LABELS[u.role]})` : id;
  };

  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col md:flex-row gap-4">
      {/* List panel */}
      <div className="w-full md:w-72 flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden max-h-64 md:max-h-none">
        <div className="p-3 border-b border-gray-100 space-y-2">
          <button onClick={() => setShowCompose(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#1B2A4A] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#243660] transition">
            <Plus size={16} /> Nouveau message
          </button>
          <div className="flex gap-1">
            {(['inbox', 'sent'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${tab === t ? 'bg-[#F5821F] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t === 'inbox' ? 'Reçus' : 'Envoyés'}
                {t === 'inbox' && inbox.filter(m => !m.lu).length > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-[10px] px-1 rounded-full">{inbox.filter(m => !m.lu).length}</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
          ) : displayed.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Aucun message</div>
          ) : displayed.map(m => (
            <div key={m.id} onClick={() => handleSelect(m)}
              className={`p-3 border-b border-gray-50 cursor-pointer transition ${selected?.id === m.id ? 'bg-orange-50 border-l-2 border-l-[#F5821F]' : 'hover:bg-gray-50'} ${!m.lu && m.destinataire_id === user?.id ? 'bg-blue-50/30' : ''}`}>
              <div className="flex items-center justify-between mb-0.5">
                <p className={`text-xs font-bold truncate ${!m.lu && m.destinataire_id === user?.id ? 'text-[#1B2A4A]' : 'text-gray-700'}`}>
                  {tab === 'inbox' ? (m.expediteur_id === user?.id ? 'Moi' : getUserName(m.expediteur_id).split(' (')[0]) : `À: ${m.destinataire_id ? getUserName(m.destinataire_id).split(' (')[0] : 'Tous'}`}
                </p>
                {!m.lu && m.destinataire_id === user?.id && <span className="w-2 h-2 bg-[#F5821F] rounded-full flex-shrink-0" />}
              </div>
              <p className="text-xs font-semibold text-gray-700 truncate">{m.sujet || '(Sans objet)'}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatDate(m.created_at)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Message view */}
      <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        {selected ? (
          <>
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-bold text-[#1B2A4A] text-base">{selected.sujet || '(Sans objet)'}</h3>
              <div className="flex flex-wrap gap-4 mt-1 text-xs text-gray-500">
                <span>De : <strong>{getUserName(selected.expediteur_id)}</strong></span>
                <span>À : <strong>{selected.destinataire_id ? getUserName(selected.destinataire_id) : 'Tous les directeurs'}</strong></span>
                <span>{formatDate(selected.created_at)}</span>
              </div>
            </div>
            <div className="p-5 flex-1 overflow-y-auto">
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">{selected.contenu}</p>
            </div>
            <div className="p-3 border-t border-gray-100">
              <button
                onClick={() => { setForm({ destinataire_id: selected.expediteur_id, sujet: `RE: ${selected.sujet}`, contenu: '' }); setShowCompose(true); }}
                className="flex items-center gap-2 text-sm text-[#1B2A4A] border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 font-semibold transition">
                <Send size={14} /> Répondre
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageSquare size={48} className="mx-auto mb-3 opacity-20" />
              <p>Sélectionnez un message</p>
            </div>
          </div>
        )}
      </div>

      {/* Compose modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-[#1B2A4A] flex items-center gap-2"><MessageSquare size={18} className="text-[#F5821F]" /> Nouveau message</h3>
              <button onClick={() => setShowCompose(false)}><X size={18} className="text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Destinataire</label>
                <select value={form.destinataire_id} onChange={e => setForm({ ...form, destinataire_id: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]">
                  <option value="">— Tous les directeurs —</option>
                  {users.filter(u => u.id !== user?.id).map(u => (
                    <option key={u.id} value={u.id}>{u.prenom} {u.nom} ({ROLE_LABELS[u.role]})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Objet</label>
                <input value={form.sujet} onChange={e => setForm({ ...form, sujet: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Message *</label>
                <textarea value={form.contenu} onChange={e => setForm({ ...form, contenu: e.target.value })} rows={5} placeholder="Votre message..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F] resize-none" />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowCompose(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Annuler</button>
              <button onClick={handleSend} disabled={sending || !form.contenu.trim()}
                className="px-5 py-2.5 rounded-xl bg-[#F5821F] text-white text-sm font-semibold flex items-center gap-2 hover:bg-orange-500 disabled:opacity-50">
                <Send size={15} /> {sending ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
