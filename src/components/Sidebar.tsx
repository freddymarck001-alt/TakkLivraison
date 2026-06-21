import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Bike, Users, DollarSign, Map, Wrench, Package,
  UserCheck, Building2, TrendingUp, Bell, MessageSquare, ClipboardList,
  Settings, LogOut, ChevronLeft, ChevronRight, FileText, ShieldCheck,
  Truck, AlertTriangle, BarChart3, CreditCard, UserPlus, Archive, User
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Role, ROLE_LABELS } from '../lib/types';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  roles: Role[];
  badge?: number;
}

const navItems: NavItem[] = [
  // Commun
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['dg', 'daf', 'do', 'dam', 'drh'] },
  { id: 'fleet', label: 'Flotte de motos', icon: Bike, roles: ['dg', 'daf', 'do', 'dam'] },

  // DG
  { id: 'validation', label: 'File de validation', icon: ShieldCheck, roles: ['dg'] },
  { id: 'reports', label: 'Rapports consolidés', icon: BarChart3, roles: ['dg'] },
  { id: 'access', label: 'Droits d\'accès', icon: Settings, roles: ['dg'] },

  // DAF
  { id: 'recettes', label: 'Recettes', icon: DollarSign, roles: ['daf', 'dg'] },
  { id: 'reinvestissement', label: 'Réinvestissement', icon: TrendingUp, roles: ['daf', 'dg'] },
  { id: 'microfinance', label: 'Micro-finance', icon: CreditCard, roles: ['daf', 'dg'] },
  { id: 'commissions', label: 'Commissions invest.', icon: Building2, roles: ['daf', 'dg'] },
  { id: 'impayes', label: 'Impayés', icon: AlertTriangle, roles: ['daf', 'dg'] },

  // DO
  { id: 'gps', label: 'Carte GPS temps réel', icon: Map, roles: ['do', 'dg'] },
  { id: 'attendance', label: 'Présences & Jours', icon: UserCheck, roles: ['do', 'dg'] },
  { id: 'incidents', label: 'Incidents & Litiges', icon: AlertTriangle, roles: ['do', 'dg'] },

  // DAM
  { id: 'suppliers', label: 'Fournisseurs', icon: Truck, roles: ['dam', 'dg'] },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench, roles: ['dam', 'dg'] },
  { id: 'repairs', label: 'Réparations', icon: FileText, roles: ['dam', 'dg'] },
  { id: 'stock', label: 'Stock pièces', icon: Package, roles: ['dam', 'dg'] },

  // DRH
  { id: 'locataires', label: 'Locataires', icon: Users, roles: ['drh', 'dg'] },
  { id: 'investisseurs', label: 'Investisseurs', icon: Building2, roles: ['drh', 'dg'] },
  { id: 'staff', label: 'Personnel interne', icon: UserPlus, roles: ['drh', 'dg'] },
  { id: 'recruitment', label: 'Recrutement', icon: Archive, roles: ['drh', 'dg'] },

  // Transversal
  { id: 'notifications', label: 'Notifications', icon: Bell, roles: ['dg', 'daf', 'do', 'dam', 'drh'] },
  { id: 'messages', label: 'Messagerie', icon: MessageSquare, roles: ['dg', 'daf', 'do', 'dam', 'drh'] },
  { id: 'audit', label: 'Journal d\'audit', icon: ClipboardList, roles: ['dg'] },
];

interface SidebarProps {
  notifCount?: number;
  msgCount?: number;
  onNavigate?: () => void;
}

export default function Sidebar({ notifCount = 0, msgCount = 0, onNavigate }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  if (!profile) return null;

  const role = profile.role as Role;
  const currentPage = location.pathname.slice(1) || 'dashboard';
  const visibleItems = navItems.filter(item => item.roles.includes(role));

  const go = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  const groups = [
    { label: 'Principal', items: visibleItems.filter(i => ['dashboard', 'fleet'].includes(i.id)) },
    { label: 'Modules métier', items: visibleItems.filter(i => !['dashboard', 'fleet', 'notifications', 'messages', 'audit'].includes(i.id)) },
    { label: 'Communication', items: visibleItems.filter(i => ['notifications', 'messages', 'audit'].includes(i.id)) },
  ];

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} flex-shrink-0 bg-[#1B2A4A] text-white flex flex-col transition-all duration-300 h-full overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-4 py-4 border-b border-white/10`}>
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <img
              src="/assets/images/EC2F7DF2-10F2-42C2-BF64-6F3FC41659A0.PNG"
              alt="TAKK"
              className="w-8 h-8 object-contain flex-shrink-0"
            />
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white leading-tight truncate">TAKK Livraison</p>
              <p className="text-xs text-[#F5821F] font-medium truncate">{ROLE_LABELS[role]}</p>
            </div>
          </div>
        )}
        {collapsed && (
          <img src="/assets/images/EC2F7DF2-10F2-42C2-BF64-6F3FC41659A0.PNG" alt="TAKK" className="w-8 h-8 object-contain" />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-white/60 hover:text-white transition p-1 rounded-lg hover:bg-white/10 flex-shrink-0"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-hide">
        {groups.map(group => {
          if (group.items.length === 0) return null;
          return (
            <div key={group.label} className="mb-2">
              {!collapsed && (
                <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/30">
                  {group.label}
                </p>
              )}
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                const badge = item.id === 'notifications' ? notifCount : item.id === 'messages' ? msgCount : 0;
                return (
                  <button
                    key={item.id}
                    onClick={() => go(`/${item.id}`)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all relative group
                      ${isActive
                        ? 'bg-[#F5821F] text-white font-semibold'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                      } ${collapsed ? 'justify-center px-2' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    {isActive && !collapsed && (
                      <span className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full" />
                    )}
                    <Icon size={18} className="flex-shrink-0" />
                    {!collapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
                    {badge > 0 && (
                      <span className={`${collapsed ? 'absolute top-1 right-1' : ''} flex-shrink-0 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1`}>
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User & logout */}
      <div className="border-t border-white/10 p-3">
        {!collapsed ? (
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-8 h-8 rounded-full bg-[#F5821F] flex items-center justify-center text-sm font-bold flex-shrink-0">
              {profile.prenom?.[0]}{profile.nom?.[0]}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-semibold text-white truncate">{profile.prenom} {profile.nom}</p>
              <p className="text-xs text-white/50 truncate">{profile.email}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-2">
            <div className="w-8 h-8 rounded-full bg-[#F5821F] flex items-center justify-center text-sm font-bold">
              {profile.prenom?.[0]}{profile.nom?.[0]}
            </div>
          </div>
        )}
        <div className={`flex gap-2 ${collapsed ? 'justify-center' : ''}`}>
          <button
            onClick={() => go('/profile')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition text-xs flex-1 ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? 'Mon profil' : undefined}
          >
            <User size={15} />
            {!collapsed && 'Mon profil'}
          </button>
          <button
            onClick={signOut}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition text-xs ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? 'Déconnexion' : undefined}
          >
            <LogOut size={15} />
            {!collapsed && 'Déconnexion'}
          </button>
        </div>
      </div>
    </aside>
  );
}
