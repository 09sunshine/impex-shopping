import React from 'react';
import { LanguageProvider } from './context/LanguageContext';
import { ExchangeRateProvider } from './context/ExchangeRateContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { RouterProvider, useRouter } from './context/RouterContext';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';

// Customer Pages
import DashboardPage from './pages/customer/DashboardPage';
import OrderPage from './pages/customer/OrderPage';
import ShopPage from './pages/customer/ShopPage';
import ProductDetailPage from './pages/customer/ProductDetailPage';
import CartPage from './pages/customer/CartPage';
import CheckoutPage from './pages/customer/CheckoutPage';
import OrdersPage from './pages/customer/OrdersPage';
import OrderDetailPage from './pages/customer/OrderDetailPage';
import ShipmentsPage from './pages/customer/ShipmentsPage';
import WalletPage from './pages/customer/WalletPage';
import ProfilePage from './pages/customer/ProfilePage';
import NotificationsPage from './pages/customer/NotificationsPage';
import HelpPage from './pages/customer/HelpPage';
import MerchantsPage from './pages/customer/MerchantsPage';

// Admin Pages
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import AdminPurchaseQueuePage from './pages/admin/AdminPurchaseQueuePage';
import AdminPickupCounterPage from './pages/admin/AdminPickupCounterPage';
import AdminMerchantsPage from './pages/admin/AdminMerchantsPage';
import AdminCatalogPage from './pages/admin/AdminCatalogPage';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('[Dashboard Error Boundary]', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '3rem 1.5rem', textAlign: 'center', maxWidth: '520px', margin: '2rem auto' }} className="impex-card">
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.5rem' }}>
            ⚠️
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.5rem' }}>Dashboard Encountered an Error</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {this.state.error?.message || 'A temporary render error occurred.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = '/';
            }}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', fontWeight: 700 }}
          >
            Reload Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function RouteSwitch() {
  const { currentPath, navigate } = useRouter();
  const { isAdmin } = useAuth();

  // Match routes: Admin users land on Admin Dashboard, normal users land on Customer Dashboard
  if (currentPath === '/' || currentPath === '/dashboard') {
    return isAdmin ? <AdminDashboardPage /> : <DashboardPage />;
  }

  if (currentPath === '/order' || currentPath === '/shopping/order') {
    return <OrderPage />;
  }

  if (currentPath === '/shop') {
    return <ShopPage />;
  }

  if (currentPath.startsWith('/product/')) {
    return <ProductDetailPage />;
  }

  if (currentPath === '/cart') {
    return <CartPage />;
  }

  if (currentPath === '/checkout') {
    return <CheckoutPage />;
  }

  if (currentPath === '/orders' || currentPath === '/shopping/orders') {
    return <OrdersPage />;
  }

  if (currentPath.startsWith('/orders/') || currentPath.startsWith('/shopping/orders/')) {
    return <OrderDetailPage />;
  }

  if (currentPath === '/shipments') {
    return <ShipmentsPage />;
  }

  if (currentPath === '/wallet') {
    return <WalletPage />;
  }

  if (currentPath === '/profile') {
    return <ProfilePage />;
  }

  if (currentPath === '/notifications') {
    return <NotificationsPage />;
  }

  if (currentPath === '/help') {
    return <HelpPage />;
  }

  // Admin Routes
  if (currentPath === '/admin') {
    return <AdminDashboardPage />;
  }

  if (currentPath === '/admin/orders') {
    return <AdminOrdersPage />;
  }

  if (currentPath === '/admin/purchases') {
    return <AdminPurchaseQueuePage />;
  }

  if (currentPath === '/admin/pickup') {
    return <AdminPickupCounterPage />;
  }

  if (currentPath === '/merchants') {
    return <OrderPage />;
  }

  if (currentPath === '/admin/merchants') {
    return <AdminOrdersPage />;
  }

  if (currentPath === '/admin/catalog') {
    return <AdminCatalogPage />;
  }

  // 404 Fallback
  return (
    <div className="impex-card" style={{ textAlign: 'center', padding: '4rem 1.5rem', maxWidth: '520px', margin: '2rem auto' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>
        Page Not Found
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        The page you are looking for does not exist on IMPEX International Shopping.
      </p>
      <button onClick={() => navigate('/')} className="btn btn-primary">
        Return to Dashboard
      </button>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          gap: '1.25rem',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: '#6366f1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: '1.25rem',
            boxShadow: '0 8px 16px rgba(99, 102, 241, 0.35)',
          }}
        >
          IX
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#c7d2fe', fontSize: '0.875rem' }}>
          <span className="spinner" style={{ width: '18px', height: '18px', borderColor: '#818cf8', borderTopColor: 'transparent' }} />
          <span>Connecting to IMPEX...</span>
        </div>
      </div>
    );
  }

  // If unauthenticated, the first screen is the login / register screen
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Authenticated users access the full application layout
  return (
    <ErrorBoundary>
      <Layout>
        <RouteSwitch />
      </Layout>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ExchangeRateProvider>
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <RouterProvider>
                <AppContent />
              </RouterProvider>
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
      </ExchangeRateProvider>
    </LanguageProvider>
  );
}
