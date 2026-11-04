import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { ToastProvider } from './components/ui/toast';
import DashboardPage from './pages/DashboardPage';
import AssetsPage from './pages/AssetsPage';
import CategoriesPage from './pages/CategoriesPage';
import DepreciationPage from './pages/DepreciationPage';
import DepreciationHistoryPage from './pages/DepreciationHistoryPage';
import ConditionPage from './pages/ConditionPage';
import CustodyPage from './pages/CustodyPage';
import DisposalPage from './pages/DisposalPage';
import AkuntaOutboxPage from './pages/AkuntaOutboxPage';
import BookValueReportPage from './pages/BookValueReportPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <ToastProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/aset" element={<AssetsPage />} />
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
    </ToastProvider>
  );
}
