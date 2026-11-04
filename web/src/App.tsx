import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { ToastProvider } from './components/ui/toast';
import { ActiveEntityProvider } from './hooks/useActiveEntity';
import { useCan } from './api/queries';
import DashboardPage from './pages/DashboardPage';
import MyAssetsPage from './pages/MyAssetsPage';
import AssetsPage from './pages/AssetsPage';
import AssetDetailPage from './pages/AssetDetailPage';
import CategoriesPage from './pages/CategoriesPage';
import DepreciationPage from './pages/DepreciationPage';
import DepreciationHistoryPage from './pages/DepreciationHistoryPage';
import ConditionPage from './pages/ConditionPage';
import CustodyPage from './pages/CustodyPage';
import DisposalPage from './pages/DisposalPage';
import AkuntaOutboxPage from './pages/AkuntaOutboxPage';
import BookValueReportPage from './pages/BookValueReportPage';
import SettingsPage from './pages/SettingsPage';

/** Users without dashboard access land on "Aset Saya" instead. */
function Landing() {
  const { can } = useCan();
  if (can('asset.read')) return <DashboardPage />;
  if (can('asset.read_own')) return <Navigate to="/aset-saya" replace />;
  return <DashboardPage />;
}

export default function App() {
  return (
    <ToastProvider>
      <ActiveEntityProvider>
        <AppShell>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/aset-saya" element={<MyAssetsPage />} />
          <Route path="/aset" element={<AssetsPage />} />
          <Route path="/aset/:id" element={<AssetDetailPage />} />
          <Route path="/kategori" element={<CategoriesPage />} />
          <Route path="/depresiasi" element={<DepreciationPage />} />
          <Route path="/depresiasi/riwayat" element={<DepreciationHistoryPage />} />
          <Route path="/kondisi" element={<ConditionPage />} />
          <Route path="/pelimpahan" element={<CustodyPage />} />
          <Route path="/pelepasan" element={<DisposalPage />} />
          <Route path="/akunta" element={<AkuntaOutboxPage />} />
          <Route path="/laporan/nilai-buku" element={<BookValueReportPage />} />
          <Route path="/pengaturan" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </ActiveEntityProvider>
    </ToastProvider>
  );
}
