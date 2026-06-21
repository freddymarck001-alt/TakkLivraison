import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';

// Dashboards
import DGDashboard from './pages/dashboards/DGDashboard';
import DAFDashboard from './pages/dashboards/DAFDashboard';
import DODashboard from './pages/dashboards/DODashboard';
import DAMDashboard from './pages/dashboards/DAMDashboard';
import DRHDashboard from './pages/dashboards/DRHDashboard';

// Shared
import FleetPage from './pages/FleetPage';

// DG Modules
import DGValidationPage from './pages/modules/dg/DGValidationPage';
import DGAccessPage from './pages/modules/dg/DGAccessPage';
import DGReportsPage from './pages/modules/dg/DGReportsPage';

// DAF Modules
import RecettesPage from './pages/modules/daf/RecettesPage';
import MicrofinancePage from './pages/modules/daf/MicrofinancePage';
import ReinvestissementPage from './pages/modules/daf/ReinvestissementPage';
import CommissionsPage from './pages/modules/daf/CommissionsPage';
import ImpayesPage from './pages/modules/daf/ImpayesPage';

// DO Modules
import AttendancePage from './pages/modules/do/AttendancePage';
import IncidentsPage from './pages/modules/do/IncidentsPage';
import GPSMapPage from './pages/modules/do/GPSMapPage';

// DAM Modules
import MaintenancePage from './pages/modules/dam/MaintenancePage';
import StockPage from './pages/modules/dam/StockPage';
import SuppliersPage from './pages/modules/dam/SuppliersPage';
import RepairsPage from './pages/modules/dam/RepairsPage';

// DRH Modules
import LocatairesPage from './pages/modules/drh/LocatairesPage';
import InvestisseursPage from './pages/modules/drh/InvestisseursPage';
import StaffPage from './pages/modules/drh/StaffPage';
import RecruitmentPage from './pages/modules/drh/RecruitmentPage';

// Transversal
import NotificationsPage from './pages/NotificationsPage';
import MessagingPage from './pages/MessagingPage';
import AuditLogPage from './pages/AuditLogPage';
import ProfilePage from './pages/ProfilePage';

function App() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#F5821F] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <Login />;
  }

  const getDashboard = () => {
    switch (profile.role) {
      case 'dg': return <DGDashboard />;
      case 'daf': return <DAFDashboard />;
      case 'do': return <DODashboard />;
      case 'dam': return <DAMDashboard />;
      case 'drh': return <DRHDashboard />;
      default: return <DGDashboard />;
    }
  };

  const canAccess = (roles: string[]) => roles.includes(profile.role);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={getDashboard()} />

          {/* Shared - all roles */}
          <Route path="fleet" element={<FleetPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="messages" element={<MessagingPage />} />
          <Route path="profile" element={<ProfilePage />} />

          {/* DG Modules */}
          {canAccess(['dg']) && (
            <>
              <Route path="validation" element={<DGValidationPage />} />
              <Route path="access" element={<DGAccessPage />} />
              <Route path="reports" element={<DGReportsPage />} />
              <Route path="audit" element={<AuditLogPage />} />
            </>
          )}

          {/* DAF Modules */}
          {canAccess(['daf', 'dg']) && (
            <>
              <Route path="recettes" element={<RecettesPage />} />
              <Route path="microfinance" element={<MicrofinancePage />} />
              <Route path="reinvestissement" element={<ReinvestissementPage />} />
              <Route path="commissions" element={<CommissionsPage />} />
              <Route path="impayes" element={<ImpayesPage />} />
            </>
          )}

          {/* DO Modules */}
          {canAccess(['do', 'dg']) && (
            <>
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="incidents" element={<IncidentsPage />} />
              <Route path="gps" element={<GPSMapPage />} />
            </>
          )}

          {/* DAM Modules */}
          {canAccess(['dam', 'dg']) && (
            <>
              <Route path="maintenance" element={<MaintenancePage />} />
              <Route path="stock" element={<StockPage />} />
              <Route path="suppliers" element={<SuppliersPage />} />
              <Route path="repairs" element={<RepairsPage />} />
            </>
          )}

          {/* DRH Modules */}
          {canAccess(['drh', 'dg']) && (
            <>
              <Route path="locataires" element={<LocatairesPage />} />
              <Route path="investisseurs" element={<InvestisseursPage />} />
              <Route path="staff" element={<StaffPage />} />
              <Route path="recruitment" element={<RecruitmentPage />} />
            </>
          )}

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
