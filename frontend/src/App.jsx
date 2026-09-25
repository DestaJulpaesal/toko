import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// Halaman publik: tetap eager-loaded karena ini yang paling sering diakses pengunjung pertama kali.
import HomePage from './pages/HomePage';
import ProductPage from './pages/ProductPage';
import ParcelPage from './pages/ParcelPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import PromoPage from './pages/PromoPage';
import ProductDetailPage from './pages/ProductDetailPage';
import FavoritesPage from './pages/FavoritesPage';
import PublicInfoPage from './pages/PublicInfoPage';
import EventPackagePage from './pages/EventPackagePage';
import AuthActionPage from './pages/AuthActionPage';

// Halaman kasir & admin: lazy-loaded (code-splitting) supaya bundle publik tidak ikut membawa kode admin.
const CashierPage = lazy(() => import('./pages/CashierPage'));
const CashierHistoryPage = lazy(() => import('./pages/CashierHistoryPage'));
const AdminCustomersPage = lazy(() => import('./pages/AdminCustomersPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminSimpleDashboard = lazy(() => import('./pages/AdminSimpleDashboard'));
const AdminProductsPage = lazy(() => import('./pages/AdminProductsPage'));
const AdminParcelsPage = lazy(() => import('./pages/AdminParcelsPage'));
const AdminPromosPage = lazy(() => import('./pages/AdminPromosPage'));
const AdminProfilePage = lazy(() => import('./pages/AdminProfilePage'));
const AdminCategoriesPage = lazy(() => import('./pages/AdminCategoriesPage'));
const AdminContentPage = lazy(() => import('./pages/AdminContentPage'));
const AdminFinancePage = lazy(() => import('./pages/AdminFinancePage'));
const AdminPersonalFinancePage = lazy(() => import('./pages/AdminPersonalFinancePage'));
const AdminDebtsPage = lazy(() => import('./pages/AdminDebtsPage'));
const AdminFinanceReportsPage = lazy(() => import('./pages/AdminFinanceReportsPage'));
const AdminFinanceCalendarPage = lazy(() => import('./pages/AdminFinanceCalendarPage'));
const AdminNetWorthPage = lazy(() => import('./pages/AdminNetWorthPage'));
const AdminApprovalsPage = lazy(() => import('./pages/AdminApprovalsPage'));
const FinanceAuditLogPage = lazy(() => import('./pages/FinanceAuditLogPage'));
const AdminParcelParticipantsPage = lazy(() => import('./pages/AdminParcelParticipantsPage'));
const AdminParcelProgramsPage = lazy(() => import('./pages/AdminParcelProgramsPage'));
const AdminParcelRegionsPage = lazy(() => import('./pages/AdminParcelRegionsPage'));
const ParcelCollectionPage = lazy(() => import('./pages/ParcelCollectionPage'));
const AdminStockOpnamePage = lazy(() => import('./pages/AdminStockOpnamePage'));
const AdminRestockPage = lazy(() => import('./pages/AdminRestockPage'));
const AdminEventPackagesPage = lazy(() => import('./pages/AdminEventPackagesPage'));
const AdminProductPerformancePage = lazy(() => import('./pages/AdminProductPerformancePage'));
import { CartProvider } from './context/CartContext';
import { FavoritesProvider } from './context/FavoritesContext';
import ConfirmDialog from './components/ConfirmDialog';
import NoticeToast from './components/NoticeToast';
import FirstTimeGuide from './components/FirstTimeGuide';
import SupportButton from './components/SupportButton';
import QuickAddFab from './components/QuickAddFab';

// Route Guard: Proteksi menu khusus Owner/Admin agar Karyawan/Kasir dialihkan ke /kasir
function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('glosir_user'));
  } catch {
    return null;
  }
}

function AuthRoute({ children, roles }) {
  const user = getStoredUser();
  const token = localStorage.getItem('glosir_token');
  if (!user || !token) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'CASHIER' ? '/kasir' : user.role === 'PARCEL_MANAGER' ? '/parcel-manager' : '/admin'} replace />;
  }
  return children;
}

export default function App() {
  return (
    <FavoritesProvider>
      <CartProvider>
        <Router>
          <ConfirmDialog />
          <NoticeToast />
          <FirstTimeGuide />
          <SupportButton />
          <QuickAddFab />
          <Suspense fallback={<div className="page-loading">Memuat halaman...</div>}>
          <Routes>
            {/* Toko Publik */}
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<ProductPage />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/favorit" element={<FavoritesPage />} />
            <Route path="/parsel" element={<ParcelPage />} />
            <Route path="/paket-acara" element={<EventPackagePage />} />
            <Route path="/event-packages/:id" element={<EventPackagePage />} />
            <Route path="/promo" element={<PromoPage />} />
            <Route path="/profil" element={<ProfilePage />} />
            <Route path="/syarat-ketentuan" element={<PublicInfoPage pageKey="terms" />} />
            <Route path="/kebijakan-privasi" element={<PublicInfoPage pageKey="privacy" />} />
            <Route path="/contact-us" element={<PublicInfoPage pageKey="contact" />} />
            <Route path="/faq" element={<PublicInfoPage pageKey="faq" />} />
            <Route path="/pusat-bantuan" element={<PublicInfoPage pageKey="help" />} />
            <Route path="/testimoni" element={<PublicInfoPage pageKey="testimonials" />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/verify-email" element={<AuthActionPage action="verify" />} />
            <Route path="/reset-password" element={<AuthActionPage action="reset" />} />

            {/* Menu Bersama: Kasir, Riwayat Kasir, dan Data Pelanggan */}
            <Route path="/kasir" element={<AuthRoute roles={['OWNER', 'ADMIN', 'CASHIER']}><CashierPage /></AuthRoute>} />
            <Route path="/kasir/riwayat" element={<AuthRoute roles={['OWNER', 'ADMIN', 'CASHIER']}><CashierHistoryPage /></AuthRoute>} />
            <Route path="/admin/customers" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminCustomersPage /></AuthRoute>} />
            <Route path="/pelanggan" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminCustomersPage /></AuthRoute>} />

            {/* Menu Khusus Owner / Admin */}
            <Route path="/admin" element={<AuthRoute roles={['OWNER', 'ADMIN']}><OwnerDashboard /></AuthRoute>} />
            <Route path="/admin/detail" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminDashboard /></AuthRoute>} />
            <Route path="/admin/products" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminProductsPage /></AuthRoute>} />
            <Route path="/admin/categories" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminCategoriesPage /></AuthRoute>} />
            <Route path="/admin/parcels" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminParcelsPage /></AuthRoute>} />
            <Route path="/admin/promos" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminPromosPage /></AuthRoute>} />
            <Route path="/admin/profile" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminProfilePage /></AuthRoute>} />
            <Route path="/admin/content" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminContentPage /></AuthRoute>} />
            <Route path="/admin/finance" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminFinancePage /></AuthRoute>} />
            <Route path="/admin/personal-finance" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminPersonalFinancePage /></AuthRoute>} />
            <Route path="/admin/debts" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminDebtsPage /></AuthRoute>} />
            <Route path="/admin/finance/reports" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminFinanceReportsPage /></AuthRoute>} />
            <Route path="/admin/finance/calendar" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminFinanceCalendarPage /></AuthRoute>} />
            <Route path="/admin/finance/networth" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminNetWorthPage /></AuthRoute>} />
            <Route path="/admin/finance/approvals" element={<AuthRoute roles={['OWNER']}><AdminApprovalsPage /></AuthRoute>} />
            <Route path="/admin/finance/audit" element={<AuthRoute roles={['OWNER']}><FinanceAuditLogPage /></AuthRoute>} />
            <Route path="/admin/parcel-participants" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminParcelParticipantsPage /></AuthRoute>} />
            <Route path="/admin/parcel-programs" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminParcelProgramsPage /></AuthRoute>} />
            <Route path="/admin/parcel-regions" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminParcelRegionsPage /></AuthRoute>} />
            <Route path="/admin/parcel-collections" element={<AuthRoute roles={['OWNER', 'ADMIN']}><ParcelCollectionPage /></AuthRoute>} />
            <Route path="/admin/stock-opname" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminStockOpnamePage /></AuthRoute>} />
            <Route path="/admin/restock" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminRestockPage /></AuthRoute>} />
            <Route path="/admin/event-packages" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminEventPackagesPage /></AuthRoute>} />
            <Route path="/admin/product-performance" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminProductPerformancePage /></AuthRoute>} />
            <Route path="/parcel-manager" element={<AuthRoute roles={['PARCEL_MANAGER']}><AdminParcelParticipantsPage /></AuthRoute>} />
            <Route path="/parcel-manager/collections" element={<AuthRoute roles={['PARCEL_MANAGER']}><ParcelCollectionPage /></AuthRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </Router>
      </CartProvider>
    </FavoritesProvider>
  );
}

function OwnerDashboard() {
  const user = getStoredUser();
  const displayMode = user?.role === 'OWNER' ? (localStorage.getItem(`glosir_display_mode_${user.id}`) || 'simple') : 'complete';
  return user?.role === 'OWNER' && displayMode === 'simple' ? <AdminSimpleDashboard /> : <AdminDashboard />;
}
