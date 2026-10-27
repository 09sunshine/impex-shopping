import React, { useEffect, useState } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
import { useExchangeRate } from '../../context/ExchangeRateContext';
import api from '../../api/client';
import TopUpModal from '../../components/modals/TopUpModal';
import {
  Link2,
  Wallet,
  Package,
  Truck,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Plus,
  Clock,
  ExternalLink,
  AlertTriangle,
  AlertCircle,
  MapPin,
  Sparkles,
} from 'lucide-react';

export default function DashboardPage() {
  const { navigate } = useRouter();
  const { user, wallet, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const { toHtg } = useExchangeRate();
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [topUpOpen, setTopUpOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (isAuthenticated) {
      setLoadingOrders(true);
      api.getOrders({ limit: 6 })
        .then((res) => {
          if (!mounted) return;
          const list = Array.isArray(res) ? res : (res?.orders || res?.items || []);
          setOrders(list);
        })
        .catch(() => {
          if (mounted) setOrders([]);
        })
        .finally(() => {
          if (mounted) setLoadingOrders(false);
        });
    } else {
      setLoadingOrders(false);
    }
    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  const firstName = user?.first_name || user?.name || (user?.email ? user.email.split('@')[0] : 'Valued Shopper');
  const spendable = Number(wallet?.spendable_balance ?? wallet?.spendable_balance_usd ?? wallet?.balance ?? wallet?.balance_usd ?? 0);

  // Compute live statistics from real backend orders
  const activeOrders = orders.filter((o) => !['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(o.status));
  const readyForPickupOrders = orders.filter((o) => ['ARRIVED_AT_IMPEX', 'READY_FOR_PICKUP', 'ARRIVED_IN_HAITI', 'AVAILABLE_FOR_PICKUP'].includes(o.status));
  const awaitingActionOrders = orders.filter((o) => ['QUOTE_READY', 'AWAITING_CUSTOMER_CONFIRMATION', 'PRICE_CHANGED'].includes(o.status));

  // Status Badge Mapper
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'DELIVERED':
        return <span className="badge badge-success">{t('common.delivered')}</span>;
      case 'READY_FOR_PICKUP':
      case 'ARRIVED_AT_IMPEX':
      case 'ARRIVED_IN_HAITI':
      case 'AVAILABLE_FOR_PICKUP':
        return <span className="badge badge-primary">{t('common.arrived')}</span>;
      case 'QUOTE_READY':
      case 'AWAITING_CUSTOMER_CONFIRMATION':
        return <span className="badge badge-warning">{t('orders.quoteReview')}</span>;
      case 'PRICE_CHANGED':
        return <span className="badge badge-danger">{t('common.pending')}</span>;
      case 'FUNDS_RESERVED':
      case 'PURCHASE_PROCESSING':
      case 'PURCHASE_COMPLETED':
        return <span className="badge badge-primary">{t('common.active')}</span>;
      case 'MERCHANT_SHIPPED':
      case 'INTERNATIONAL_TRANSIT':
      case 'IN_TRANSIT':
        return <span className="badge badge-warning">{t('common.inTransit')}</span>;
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
      case 'ORDER_CREATED':
        return <span className="badge badge-muted">{t('common.pending')}</span>;
      case 'CANCELLED':
        return <span className="badge badge-danger">{t('common.cancelled')}</span>;
      case 'REFUNDED':
        return <span className="badge badge-muted">{t('wallet.refund')}</span>;
      default:
        return <span className="badge badge-muted">{String(status || 'Created').replace(/_/g, ' ')}</span>;
    }
  };

  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? t('header.goodMorning') : hour < 18 ? t('header.goodAfternoon') : t('header.goodEvening');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Welcome Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          {timeGreeting}, {firstName}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          {t('auth.gatewayTitle')}
        </p>
      </div>

      {/* Primary Hero Card: Order by Product URL */}
      <div
        className="impex-card"
        style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
          color: '#ffffff',
          padding: '2.25rem',
          position: 'relative',
          overflow: 'hidden',
          border: 'none',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ maxWidth: '620px', position: 'relative', zIndex: 2 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: 'rgba(255, 255, 255, 0.18)',
              padding: '0.25rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 700,
              marginBottom: '1rem',
              backdropFilter: 'blur(4px)',
            }}
          >
            <Link2 size={15} />
            <span>{t('dashboard.heroBadge')}</span>
          </div>

          <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.65rem', lineHeight: 1.3 }}>
            {t('dashboard.heroTitle')}
          </h2>

          <p style={{ fontSize: '0.95rem', color: 'rgba(255, 255, 255, 0.9)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            {t('dashboard.heroSubtitle')}
          </p>

          {/* Quick Paste URL Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const inputVal = e.target.elements.productUrl?.value?.trim();
              if (inputVal) {
                navigate(`/order?url=${encodeURIComponent(inputVal)}`);
              } else {
                navigate('/order');
              }
            }}
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              maxWidth: '540px',
              width: '100%',
              minWidth: 0,
              marginBottom: '0.75rem',
            }}
          >
            <input
              name="productUrl"
              type="url"
              placeholder={t('dashboard.heroPlaceholder')}
              style={{
                flex: '1 1 min(100%, 240px)',
                minWidth: 0,
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                outline: 'none',
                fontSize: '0.9rem',
                backgroundColor: '#ffffff',
                color: 'var(--text-primary)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              }}
            />
            <button
              type="submit"
              className="btn"
              style={{
                backgroundColor: '#1e1b4b',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.9rem',
                padding: '0.75rem 1.4rem',
                gap: '0.4rem',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <span>{t('dashboard.heroBtn')}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        </div>

        {/* Decorative background circle */}
        <div
          style={{
            position: 'absolute',
            right: '-60px',
            bottom: '-60px',
            width: '280px',
            height: '280px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Metric Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '1.25rem' }}>
        {/* Wallet Balance Card */}
        <div className="impex-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              {t('dashboard.stats.availableBalance')}
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Wallet size={18} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              ${spendable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.2rem' }}>
              ≈ {toHtg(spendable).toLocaleString()} HTG
            </div>
          </div>

          <button
            onClick={() => setTopUpOpen(true)}
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', gap: '0.4rem', justifyContent: 'center' }}
          >
            <Plus size={14} />
            <span>{t('dashboard.topUpWallet')}</span>
          </button>
        </div>

        {/* Active Orders Card */}
        <div className="impex-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              {t('dashboard.stats.activeOrders')}
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
              <Package size={18} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {loadingOrders ? '...' : activeOrders.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {t('common.inTransit')}
            </div>
          </div>

          <button
            onClick={() => navigate('/orders')}
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', gap: '0.4rem', justifyContent: 'center' }}
          >
            <span>{t('dashboard.viewAllOrders')}</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Ready for Pickup Card */}
        <div className="impex-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              {t('dashboard.stats.readyForPickup')}
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: readyForPickupOrders.length > 0 ? 'var(--success)' : 'var(--text-primary)' }}>
              {loadingOrders ? '...' : readyForPickupOrders.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {t('common.arrived')}
            </div>
          </div>

          <button
            onClick={() => navigate('/orders?status=arrived')}
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', gap: '0.4rem', justifyContent: 'center' }}
          >
            <span>{t('orders.pickupCode')}</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Pending Actions Card (Quotes to confirm or price changes) */}
        <div className="impex-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              {t('dashboard.stats.awaitingQuote')}
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
              <Clock size={18} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: awaitingActionOrders.length > 0 ? '#d97706' : 'var(--text-primary)' }}>
              {loadingOrders ? '...' : awaitingActionOrders.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {t('orders.quoteReview')}
            </div>
          </div>

          <button
            onClick={() => navigate('/orders?status=active')}
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', gap: '0.4rem', justifyContent: 'center' }}
          >
            <span>{t('orders.quoteReview')}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Recent Orders Section */}
      <div className="impex-card" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{t('dashboard.recentOrdersTitle')}</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {t('dashboard.recentOrdersSubtitle')}
            </p>
          </div>
          <button
            onClick={() => navigate('/orders')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              fontWeight: 700,
              fontSize: '0.875rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              cursor: 'pointer',
            }}
          >
            <span>{t('dashboard.viewAllOrders')}</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {loadingOrders ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="skeleton" style={{ height: '56px', borderRadius: 'var(--radius-md)' }} />
            <div className="skeleton" style={{ height: '56px', borderRadius: 'var(--radius-md)' }} />
            <div className="skeleton" style={{ height: '56px', borderRadius: 'var(--radius-md)' }} />
          </div>
        ) : orders.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {orders.map((o) => {
              const orderId = o.id || o.order_number;
              const merchant = o.merchant_name || o.merchant_domain || 'Global Store';
              const title = o.product_name || o.title || 'International Product';
              const totalAmount = Number(o.final_total || o.quoted_total || o.customer_estimated_price || o.total_amount_usd || o.total_price || 0);

              return (
                <div
                  key={o.id}
                  onClick={() => navigate(`/orders/${o.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    padding: '1rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    gap: '0.75rem',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-muted)';
                    e.currentTarget.style.borderColor = '#c7d2fe';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', minWidth: 0, flex: '1 1 220px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--bg-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)',
                        flexShrink: 0,
                      }}
                    >
                      <Package size={20} />
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px' }}>
                          {title}
                        </span>
                        <span className="badge badge-muted" style={{ fontSize: '0.6875rem' }}>
                          {merchant}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        Order #{o.order_number || String(o.id).slice(0, 8)} • Placed {new Date(o.created_at || Date.now()).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem', flexShrink: 0, marginLeft: 'auto' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {totalAmount > 0 ? `$${totalAmount.toFixed(2)}` : 'Pending quote'}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        {o.currency || 'USD'}
                      </div>
                    </div>

                    {renderStatusBadge(o.status)}

                    <ArrowRight size={16} style={{ color: 'var(--text-light)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Attractive empty state with zero fake data */
          <div style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              <Link2 size={26} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              {t('dashboard.noRecentOrders')}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '440px', margin: '0 auto 1.5rem' }}>
              {t('dashboard.heroSubtitle')}
            </p>
            <button
              onClick={() => navigate('/order')}
              className="btn btn-primary"
              style={{ gap: '0.5rem' }}
            >
              <Link2 size={16} />
              <span>{t('dashboard.heroBadge')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Top Up Modal */}
      <TopUpModal isOpen={topUpOpen} onClose={() => setTopUpOpen(false)} />
    </div>
  );
}
