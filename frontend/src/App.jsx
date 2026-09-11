import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ProductPage from './pages/ProductPage';
import ParcelPage from './pages/ParcelPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import AdminDashboard from './pages/AdminDashboard';
import LoginPage from './pages/LoginPage';
import CashierPage from './pages/CashierPage';
import CashierHistoryPage from './pages/CashierHistoryPage';
import AdminCustomersPage from './pages/AdminCustomersPage';
import ProfilePage from './pages/ProfilePage';
import PromoPage from './pages/PromoPage';
import ProductDetailPage from './pages/ProductDetailPage';
import FavoritesPage from './pages/FavoritesPage';
import AdminProductsPage from './pages/AdminProductsPage';
import AdminParcelsPage from './pages/AdminParcelsPage';
import AdminPromosPage from './pages/AdminPromosPage';
import AdminProfilePage from './pages/AdminProfilePage';
import AdminCategoriesPage from './pages/AdminCategoriesPage';
import AdminContentPage from './pages/AdminContentPage';
import AdminFinancePage from './pages/AdminFinancePage';
import AdminPersonalFinancePage from './pages/AdminPersonalFinancePage';
import AdminParcelParticipantsPage from './pages/AdminParcelParticipantsPage';
import AdminParcelProgramsPage from './pages/AdminParcelProgramsPage';
import AdminParcelRegionsPage from './pages/AdminParcelRegionsPage';
import ParcelCollectionPage from './pages/ParcelCollectionPage';
import PublicInfoPage from './pages/PublicInfoPage';
import { CartProvider } from './context/CartContext';
import { FavoritesProvider } from './context/FavoritesContext';
import ConfirmDialog from './components/ConfirmDialog';
import NoticeToast from './components/NoticeToast';

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
          <Routes>
            {/* Toko Publik */}
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<ProductPage />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/favorit" element={<FavoritesPage />} />
            <Route path="/parsel" element={<ParcelPage />} />
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

            {/* Menu Bersama: Kasir, Riwayat Kasir, dan Data Pelanggan */}
            <Route path="/kasir" element={<AuthRoute roles={['OWNER', 'ADMIN', 'CASHIER']}><CashierPage /></AuthRoute>} />
            <Route path="/kasir/riwayat" element={<AuthRoute roles={['OWNER', 'ADMIN', 'CASHIER']}><CashierHistoryPage /></AuthRoute>} />
            <Route path="/admin/customers" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminCustomersPage /></AuthRoute>} />
            <Route path="/pelanggan" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminCustomersPage /></AuthRoute>} />

            {/* Menu Khusus Owner / Admin */}
            <Route path="/admin" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminDashboard /></AuthRoute>} />
            <Route path="/admin/products" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminProductsPage /></AuthRoute>} />
            <Route path="/admin/categories" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminCategoriesPage /></AuthRoute>} />
            <Route path="/admin/parcels" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminParcelsPage /></AuthRoute>} />
            <Route path="/admin/promos" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminPromosPage /></AuthRoute>} />
            <Route path="/admin/profile" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminProfilePage /></AuthRoute>} />
            <Route path="/admin/content" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminContentPage /></AuthRoute>} />
            <Route path="/admin/finance" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminFinancePage /></AuthRoute>} />
            <Route path="/admin/personal-finance" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminPersonalFinancePage /></AuthRoute>} />
            <Route path="/admin/parcel-participants" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminParcelParticipantsPage /></AuthRoute>} />
            <Route path="/admin/parcel-programs" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminParcelProgramsPage /></AuthRoute>} />
            <Route path="/admin/parcel-regions" element={<AuthRoute roles={['OWNER', 'ADMIN']}><AdminParcelRegionsPage /></AuthRoute>} />
            <Route path="/admin/parcel-collections" element={<AuthRoute roles={['OWNER', 'ADMIN']}><ParcelCollectionPage /></AuthRoute>} />
            <Route path="/parcel-manager" element={<AuthRoute roles={['PARCEL_MANAGER']}><AdminParcelParticipantsPage /></AuthRoute>} />
            <Route path="/parcel-manager/collections" element={<AuthRoute roles={['PARCEL_MANAGER']}><ParcelCollectionPage /></AuthRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </CartProvider>
    </FavoritesProvider>
  );
}
