import { useNavigate } from 'react-router-dom';
import { Bell, MessageSquare, Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_LABELS } from '../lib/types';

interface TopBarProps {
  title: string;
  onMenuToggle?: () => void;
  notifCount?: number;
  msgCount?: number;
}

export default function TopBar({ title, onMenuToggle, notifCount = 0, msgCount = 0 }: TopBarProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="bg-white border-b border-gray-100 px-4 md:px-6 py-3.5 flex items-center justify-between flex-shrink-0 z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden text-[#1B2A4A] hover:bg-gray-100 p-1.5 rounded-lg transition"
        >
          <Menu size={20} />
        </button>
        <div>
          <h2 className="text-base font-bold text-[#1B2A4A] leading-tight">{title}</h2>
          {profile && (
            <p className="text-xs text-gray-400 hidden md:block">{ROLE_LABELS[profile.role]}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 text-gray-500 hover:text-[#1B2A4A] hover:bg-gray-100 rounded-xl transition"
        >
          <Bell size={20} />
          {notifCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>
        <button
          onClick={() => navigate('/messages')}
          className="relative p-2 text-gray-500 hover:text-[#1B2A4A] hover:bg-gray-100 rounded-xl transition"
        >
          <MessageSquare size={20} />
          {msgCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#F5821F] rounded-full" />
          )}
        </button>
        {profile && (
          <div className="flex items-center gap-2 ml-1 pl-3 border-l border-gray-100">
            <div className="w-8 h-8 rounded-full bg-[#1B2A4A] flex items-center justify-center text-white text-xs font-bold">
              {profile.prenom?.[0]}{profile.nom?.[0]}
            </div>
            <div className="hidden md:block">
              <p className="text-xs font-semibold text-[#1B2A4A] leading-tight">{profile.prenom} {profile.nom}</p>
              <p className="text-xs text-gray-400">{ROLE_LABELS[profile.role]}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
