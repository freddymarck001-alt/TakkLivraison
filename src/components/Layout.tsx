import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Tableau de bord',
  fleet: 'Flotte de motos',
  validation: 'File de validation',
  access: 'Droits d\'accès',
  reports: 'Rapports consolidés',
  recettes: 'Recettes',
  reinvestissement: 'Réinvestissement',
  microfinance: 'Micro-finance',
  commissions: 'Commissions investisseurs',
  impayes: 'Impayés',
  gps: 'Carte GPS temps réel',
  attendance: 'Présences & Absences',
  incidents: 'Incidents & Litiges',
  suppliers: 'Fournisseurs',
  maintenance: 'Maintenance',
  repairs: 'Réparations',
  stock: 'Stock pièces',
  locataires: 'Locataires',
  investisseurs: 'Investisseurs',
  staff: 'Personnel interne',
  recruitment: 'Recrutement',
  notifications: 'Notifications',
  messages: 'Messagerie',
  audit: 'Journal d\'audit',
  profile: 'Mon profil',
};

export default function Layout() {
  const { profile } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [msgCount, setMsgCount] = useState(0);

  const currentPage = location.pathname.slice(1) || 'dashboard';
  const pageTitle = PAGE_TITLES[currentPage] || 'TAKK Livraison';

  useEffect(() => {
    if (!profile) return;

    const fetchCounts = async () => {
      const { count: n } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('lue', false)
        .eq('destinataire_role', profile.role);
      setNotifCount(n ?? 0);

      if (profile?.id) {
        const { count: m } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('lu', false)
          .eq('destinataire_id', profile.id);
        setMsgCount(m ?? 0);
      }
    };

    fetchCounts();

    const notifSub = supabase
      .channel('layout-notifs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchCounts)
      .subscribe();

    return () => { supabase.removeChannel(notifSub); };
  }, [profile]);

  return (
    <div className="flex h-screen bg-[#F7F8FA] overflow-hidden">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile, shown on desktop */}
      <div className={`${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-40 md:z-auto h-full transition-transform duration-300`}>
        <Sidebar
          notifCount={notifCount}
          msgCount={msgCount}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar
          title={pageTitle}
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          notifCount={notifCount}
          msgCount={msgCount}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
