import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) setError('Identifiants incorrects. Veuillez réessayer.');
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1B2A4A] via-[#243660] to-[#F5821F]" />

      {/* Decorative shapes */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-[#F5821F]/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#1B2A4A]/30 rounded-full blur-3xl translate-x-1/4 translate-y-1/4" />
      <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-white/5 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2" />

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Logo and title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-2xl mb-4">
              <img
                src="/assets/images/EC2F7DF2-10F2-42C2-BF64-6F3FC41659A0.PNG"
                alt="TAKK Livraison"
                className="w-16 h-16 object-contain"
              />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">TAKK Livraison</h1>
            <p className="text-white/70">Système de gestion de flotte</p>
          </div>

          {/* Login card */}
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-[#1B2A4A]">Connexion</h2>
              <p className="text-gray-500 text-sm mt-1">Accédez à votre espace de direction</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-[#1B2A4A] mb-2">
                  Adresse email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  required
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 bg-gray-50 text-[#1B2A4A] placeholder-gray-400 focus:outline-none focus:border-[#F5821F] focus:bg-white transition text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1B2A4A] mb-2">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3.5 pr-12 rounded-xl border-2 border-gray-200 bg-gray-50 text-[#1B2A4A] placeholder-gray-400 focus:outline-none focus:border-[#F5821F] focus:bg-white transition text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#1B2A4A] to-[#243660] hover:from-[#243660] hover:to-[#1B2A4A] text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm shadow-lg"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />}
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-white/50 text-xs mt-8">
            © 2026 TAKK Livraison · Tous droits réservés
          </p>
        </div>
      </div>
    </div>
  );
}
