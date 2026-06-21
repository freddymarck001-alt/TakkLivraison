import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Profile, ROLE_LABELS, Role } from '../../../lib/types';
import { Settings, Save, Shield, UserPlus, Trash2, Edit2, X, AlertCircle, CheckCircle, KeyRound } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

const ROLES: Role[] = ['dg', 'daf', 'do', 'dam', 'drh'];

interface NewUserForm {
  email: string;
  prenom: string;
  nom: string;
  role: Role;
  password: string;
}

const defaultForm: NewUserForm = {
  email: '',
  prenom: '',
  nom: '',
  role: 'do',
  password: 'Takk2026',
};

export default function DGAccessPage() {
  const { profile: me } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<Role>('do');
  const [editActif, setEditActif] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<NewUserForm>(defaultForm);
  const [creating, setCreating] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at');
    if (data) setProfiles(data as Profile[]);
    setLoading(false);
  };

  const handleUpdateRole = async (userId: string) => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ role: editRole, actif: editActif, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (!error) {
      await supabase.from('audit_logs').insert({
        user_email: me?.email,
        user_role: me?.role,
        action: editActif ? 'Modification rôle utilisateur' : 'Désactivation utilisateur',
        table_concernee: 'profiles',
        reference_id: userId,
        details: { nouveau_role: editRole, actif: editActif },
      });
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: editRole, actif: editActif } : p));
      setEditing(null);
      setSuccessMsg('Utilisateur modifié avec succès');
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setErrorMsg('Erreur lors de la modification');
      setTimeout(() => setErrorMsg(null), 3000);
    }
    setSaving(false);
  };

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.prenom || !createForm.nom) {
      setErrorMsg('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setCreating(true);
    setErrorMsg(null);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: createForm.email,
      password: createForm.password,
      options: {
        data: { role: createForm.role },
      },
    });

    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        setErrorMsg('Cet email est déjà utilisé par un autre compte');
      } else {
        setErrorMsg(signUpError.message);
      }
      setCreating(false);
      return;
    }

    if (signUpData.user) {
      await supabase.from('profiles').upsert({
        id: signUpData.user.id,
        email: createForm.email,
        role: createForm.role,
        nom: createForm.nom,
        prenom: createForm.prenom,
        actif: true,
      });

      await supabase.from('audit_logs').insert({
        user_email: me?.email,
        user_role: me?.role,
        action: 'Création utilisateur',
        table_concernee: 'profiles',
        reference_id: signUpData.user.id,
        details: { email: createForm.email, role: createForm.role },
      });

      setCreatedPassword(createForm.password);
      await fetchProfiles();
    }
    setCreating(false);
  };

  const handleDeleteUser = async (userId: string) => {
    setSaving(true);
    const profile = profiles.find(p => p.id === userId);

    await supabase.from('profiles').update({ actif: false }).eq('id', userId);
    await supabase.from('audit_logs').insert({
      user_email: me?.email,
      user_role: me?.role,
      action: 'Suppression utilisateur',
      table_concernee: 'profiles',
      reference_id: userId,
      details: { email: profile?.email },
    });

    setProfiles(prev => prev.filter(p => p.id !== userId));
    setShowDeleteConfirm(null);
    setSuccessMsg('Utilisateur désactivé avec succès');
    setTimeout(() => setSuccessMsg(null), 3000);
    setSaving(false);
  };

  const handleResetPassword = async () => {
    if (!showResetPasswordModal || !newPassword) return;
    if (newPassword.length < 6) {
      setErrorMsg('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setResetting(true);
    setErrorMsg(null);

    // Use Supabase admin to reset password via edge function
    const { error } = await supabase.functions.invoke('reset-user-password', {
      body: { userId: showResetPasswordModal.id, newPassword },
    });

    if (error) {
      setErrorMsg('Erreur lors de la réinitialisation du mot de passe');
      setTimeout(() => setErrorMsg(null), 3000);
    } else {
      await supabase.from('audit_logs').insert({
        user_email: me?.email,
        user_role: me?.role,
        action: 'Réinitialisation mot de passe utilisateur',
        table_concernee: 'auth.users',
        reference_id: showResetPasswordModal.id,
        details: { email: showResetPasswordModal.email },
      });
      setSuccessMsg(`Mot de passe réinitialisé pour ${showResetPasswordModal.email}`);
      setTimeout(() => setSuccessMsg(null), 3000);
      setShowResetPasswordModal(null);
      setNewPassword('');
    }

    setResetting(false);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateForm(defaultForm);
    setCreatedPassword(null);
    setErrorMsg(null);
  };

  const roleColors: Record<Role, string> = {
    dg: 'bg-[#1B2A4A] text-white',
    daf: 'bg-emerald-700 text-white',
    do: 'bg-blue-700 text-white',
    dam: 'bg-orange-700 text-white',
    drh: 'bg-purple-700 text-white',
  };

  return (
    <div className="space-y-5">
      {/* Alerts */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
          <CheckCircle size={16} /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertCircle size={16} /> {errorMsg}
        </div>
      )}

      {/* Info banner */}
      <div className="bg-[#1B2A4A]/10 border border-[#1B2A4A]/20 rounded-xl px-4 py-3 flex items-center gap-2">
        <Shield size={16} className="text-[#1B2A4A]" />
        <p className="text-sm text-[#1B2A4A] font-semibold">Seul le Directeur Général peut gérer les utilisateurs et droits d'accès.</p>
      </div>

      {/* Create button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-[#1B2A4A] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#243660] transition"
        >
          <UserPlus size={16} /> Ajouter un utilisateur
        </button>
      </div>

      {/* Users list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#1B2A4A] flex items-center gap-2">
            <Settings size={18} className="text-[#F5821F]" /> Gestion des droits d'accès ({profiles.filter(p => p.actif).length} actifs)
          </h3>
        </div>
        {loading ? (
          <div className="text-center py-12 text-gray-400">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-[#F5821F] rounded-full animate-spin mx-auto mb-3" />
            Chargement...
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {profiles.map(p => (
              <div key={p.id} className={`flex items-center justify-between p-4 gap-4 flex-wrap ${!p.actif ? 'bg-gray-50 opacity-60' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${roleColors[p.role] || 'bg-gray-200 text-gray-700'}`}>
                    {p.prenom?.[0]}{p.nom?.[0]}
                  </div>
                  <div>
                    <p className="font-bold text-[#1B2A4A] flex items-center gap-2">
                      {p.prenom} {p.nom}
                      {!p.actif && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Inactif</span>}
                    </p>
                    <p className="text-xs text-gray-500">{p.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {editing === p.id ? (
                    <>
                      <select
                        value={editRole}
                        onChange={e => setEditRole(e.target.value as Role)}
                        className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]"
                      >
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={editActif}
                          onChange={e => setEditActif(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-[#F5821F] focus:ring-[#F5821F]"
                        />
                        Actif
                      </label>
                      <button
                        onClick={() => handleUpdateRole(p.id)}
                        disabled={saving}
                        className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-emerald-700 transition disabled:opacity-50"
                      >
                        <Save size={13} /> {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="text-xs text-gray-500 hover:text-gray-700 px-2 py-2 rounded-xl hover:bg-gray-100 transition"
                      >
                        Annuler
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${roleColors[p.role] || 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABELS[p.role]}
                      </span>
                      {p.id !== me?.id && (
                        <>
                          <button
                            onClick={() => setShowResetPasswordModal(p)}
                            className="p-2 hover:bg-gray-100 rounded-xl transition"
                            title="Réinitialiser le mot de passe"
                          >
                            <KeyRound size={14} className="text-gray-400 hover:text-[#F5821F]" />
                          </button>
                          <button
                            onClick={() => {
                              setEditing(p.id);
                              setEditRole(p.role);
                              setEditActif(p.actif);
                            }}
                            className="p-2 hover:bg-gray-100 rounded-xl transition"
                            title="Modifier"
                          >
                            <Edit2 size={14} className="text-gray-400 hover:text-[#1B2A4A]" />
                          </button>
                        </>
                      )}
                      {p.id === me?.id && (
                        <span className="text-xs text-gray-400 italic px-2">Vous</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            {profiles.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                Aucun utilisateur enregistré
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-[#1B2A4A] flex items-center gap-2">
                <UserPlus size={18} className="text-[#F5821F]" /> Nouvel utilisateur
              </h3>
              <button onClick={closeCreateModal}>
                <X size={18} className="text-gray-500 hover:text-gray-700" />
              </button>
            </div>

            {createdPassword ? (
              <div className="p-5 space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <p className="text-emerald-700 text-sm font-semibold mb-2">Utilisateur créé avec succès !</p>
                  <p className="text-emerald-600 text-xs">Transmettez ces identifiants au nouvel utilisateur :</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Email :</span>
                    <span className="font-mono font-semibold text-[#1B2A4A]">{createForm.email}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Mot de passe :</span>
                    <span className="font-mono font-semibold text-[#1B2A4A]">{createdPassword}</span>
                  </div>
                </div>
                <button
                  onClick={closeCreateModal}
                  className="w-full bg-[#1B2A4A] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#243660] transition"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <>
                <div className="p-5 space-y-4">
                  {errorMsg && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2 flex items-center gap-2">
                      <AlertCircle size={14} /> {errorMsg}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Prénom *</label>
                      <input
                        type="text"
                        value={createForm.prenom}
                        onChange={e => setCreateForm({ ...createForm, prenom: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Nom *</label>
                      <input
                        type="text"
                        value={createForm.nom}
                        onChange={e => setCreateForm({ ...createForm, nom: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Email *</label>
                    <input
                      type="email"
                      value={createForm.email}
                      onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                      placeholder="prenom@exemple.com"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Rôle *</label>
                    <select
                      value={createForm.role}
                      onChange={e => setCreateForm({ ...createForm, role: e.target.value as Role })}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]"
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Mot de passe initial</label>
                    <input
                      type="text"
                      value={createForm.password}
                      onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]"
                    />
                    <p className="text-xs text-gray-400 mt-1">L'utilisateur pourra le changer après sa première connexion</p>
                  </div>
                </div>
                <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
                  <button
                    onClick={closeCreateModal}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleCreateUser}
                    disabled={creating || !createForm.email || !createForm.prenom || !createForm.nom}
                    className="px-5 py-2.5 rounded-xl bg-[#1B2A4A] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50 hover:bg-[#243660] transition"
                  >
                    <UserPlus size={15} /> {creating ? 'Création...' : 'Créer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-5 space-y-3 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <h3 className="font-bold text-[#1B2A4A]">Désactiver cet utilisateur ?</h3>
              <p className="text-sm text-gray-500">
                L'utilisateur ne pourra plus se connecter. Cette action peut être annulée en réactivant le compte.
              </p>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDeleteUser(showDeleteConfirm)}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold flex items-center gap-2 hover:bg-red-700 transition disabled:opacity-50"
              >
                <Trash2 size={15} /> Désactiver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-[#1B2A4A] flex items-center gap-2">
                <KeyRound size={18} className="text-[#F5821F]" /> Réinitialiser le mot de passe
              </h3>
              <button onClick={() => { setShowResetPasswordModal(null); setNewPassword(''); }}>
                <X size={18} className="text-gray-500 hover:text-gray-700" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                Réinitialiser le mot de passe de <strong>{showResetPasswordModal.email}</strong>
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nouveau mot de passe *</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 caractères"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#F5821F]"
                />
              </div>
              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2 flex items-center gap-2">
                  <AlertCircle size={14} /> {errorMsg}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => { setShowResetPasswordModal(null); setNewPassword(''); }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetting || newPassword.length < 6}
                className="px-5 py-2.5 rounded-xl bg-[#F5821F] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50 hover:bg-orange-500 transition"
              >
                <KeyRound size={15} /> {resetting ? 'Réinitialisation...' : 'Définir le mot de passe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
