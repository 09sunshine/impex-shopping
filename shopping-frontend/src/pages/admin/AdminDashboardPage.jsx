import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
import api from '../../api/client';
import {
  ShieldCheck,
  Package,
  ShoppingCart,
  Truck,
  CheckCircle2,
  DollarSign,
  Lock,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  Clock,
  Store,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { navigate } = useRouter();
  const { isAdmin, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState([]);

  useEffect(() => {
    let mounted = true;
    if (isAuthenticated && isAdmin) {
      setLoading(true);
      Promise.all([
        api.getAdminStats().catch(() => null),
        api.getAdminOrders({ limit: 6 }).catch(() => null),
      ]).then(([statsRes, ordersRes]) => {
        if (mounted) {
          setStats(statsRes);
          setRecentOrders(ordersRes?.orders || ordersRes?.items || ordersRes || []);
        }
      }).finally(() => {
        if (mounted) setLoading(false);
      });
    } else {
      setLoading(false);
    }
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, isAdmin]);

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="impex-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', maxWidth: '520px', margin: '2rem auto' }}>
        <ShieldCheck size={48} style={{ color: 'var(--danger)', margin: '0 auto 1rem' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          {t('admin.accessRestrictedTitle')}
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          {t('admin.accessRestrictedDesc')}
        </p>
        <button onClick={() => navigate('/')} className="btn btn-primary">
          {t('admin.returnHomeBtn')}
        </button>
      </div>
    );
  }

  const kpis = [
    { label: t('admin.kpis.totalOrders'), value: stats?.total_orders ?? 0, icon: Package, color: 'var(--primary)', bg: 'var(--primary-light)' },
    { label: t('admin.kpis.pendingReview'), value: (stats?.under_review ?? 0) + (stats?.submitted ?? 0), icon: Clock, color: 'var(--warning)', bg: 'var(--warning-bg)' },
    { label: t('admin.kpis.awaitingQuote'), value: stats?.quote_ready ?? 0, icon: Clock, color: '#3b82f6', bg: '#eff6ff' },
    { label: t('admin.kpis.priceChanged'), value: stats?.price_changed ?? 0, icon: AlertTriangle, color: 'var(--danger)', bg: 'var(--danger-bg)' },
    { label: t('admin.kpis.purchasePending'), value: stats?.funds_reserved ?? 0, icon: ShoppingCart, color: 'var(--primary)', bg: 'var(--primary-light)' },
    { label: t('admin.kpis.purchased'), value: stats?.purchased ?? 0, icon: CheckCircle2, color: 'var(--success)', bg: 'var(--success-bg)' },
    { label: t('admin.kpis.arrivedHub'), value: stats?.arrived_in_haiti ?? 0, icon: Truck, color: 'var(--info)', bg: 'var(--info-bg)' },
    { label: t('admin.kpis.delivered'), value: stats?.delivered ?? 0, icon: CheckCircle2, color: 'var(--success)', bg: 'var(--success-bg)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Admin Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.35rem' }}>
            <ShieldCheck size={14} />
            <span>{t('admin.consoleBadge')}</span>
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800 }}>{t('admin.dashboardTitle')}</h1>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => navigate('/admin/orders')} className="btn btn-primary btn-sm" style={{ gap: '0.35rem' }}>
            <Package size={15} />
            <span>{t('admin.btnOrderQueue')}</span>
          </button>
          <button onClick={() => navigate('/admin/pickup')} className="btn btn-secondary btn-sm" style={{ gap: '0.35rem' }}>
            <CheckCircle2 size={15} />
            <span>{t('admin.btnPickupCounter')}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '1.25rem' }}>
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="impex-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: kpi.bg,
                  color: kpi.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon size={22} />
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {kpi.label}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {loading ? '...' : kpi.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Shopping Orders Table */}
      <div className="impex-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{t('admin.recentQueueTitle')}</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {t('admin.recentQueueSubtitle')}
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/orders')}
            className="btn btn-secondary btn-sm"
            style={{ gap: '0.35rem' }}
          >
            <span>{t('admin.viewFullQueue')}</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="skeleton" style={{ height: '48px', borderRadius: 'var(--radius-md)' }} />
            <div className="skeleton" style={{ height: '48px', borderRadius: 'var(--radius-md)' }} />
          </div>
        ) : recentOrders.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('admin.colOrder')}</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('admin.colMerchantProduct')}</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('admin.colEstPrice')}</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('admin.colStatus')}</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{t('admin.colAction')}</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => navigate('/admin/orders')}
                    style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--primary)' }}>
                      #{o.order_number || String(o.id).slice(0, 8)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{o.product_name || o.title || 'Product'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{o.merchant_name || o.merchant_domain}</div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, fontSize: '0.875rem' }}>
                      ${Number(o.customer_estimated_price || o.quoted_total || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span className="badge badge-muted">{String(o.status).replace(/_/g, ' ')}</span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <button className="btn btn-secondary btn-sm">{t('admin.btnManage')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {t('admin.noOrdersQueue')}
          </div>
        )}
      </div>
    </div>
  );
}
