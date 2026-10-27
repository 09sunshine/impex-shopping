import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
import api from '../../api/client';
import {
  Package,
  Search,
  Filter,
  ArrowRight,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Link2,
} from 'lucide-react';

export default function OrdersPage() {
  const { navigate, queryParams } = useRouter();
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();

  const [orders, setOrders] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(queryParams.get('status') || '');
  const [searchFilter, setSearchFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    let mounted = true;
    if (isAuthenticated) {
      setLoading(true);
      api.getOrders({ status: statusFilter, page, limit })
        .then((res) => {
          if (!mounted) return;
          const list = Array.isArray(res) ? res : (res?.orders || res?.items || []);
          setOrders(list);
          setTotalCount(res?.total || list.length);
        })
        .catch(() => {
          if (mounted) {
            setOrders([]);
            setTotalCount(0);
          }
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    } else {
      setLoading(false);
    }
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, statusFilter, page]);

  const filteredOrders = orders.filter((o) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    const orderNo = String(o.order_number || o.id).toLowerCase();
    const name = String(o.product_name || o.title || '').toLowerCase();
    const merchant = String(o.merchant_name || o.merchant_domain || '').toLowerCase();
    return orderNo.includes(term) || name.includes(term) || merchant.includes(term);
  });

  const getStatusBadge = (status) => {
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
      case 'CANCELLED':
        return <span className="badge badge-danger">{t('common.cancelled')}</span>;
      case 'REFUNDED':
        return <span className="badge badge-muted">{t('wallet.refund')}</span>;
      default:
        return <span className="badge badge-muted">{String(status || 'Created').replace(/_/g, ' ')}</span>;
    }
  };

  const tabs = [
    { label: t('common.all'), value: '' },
    { label: t('common.active'), value: 'active' },
    { label: t('common.inTransit'), value: 'in_transit' },
    { label: t('common.arrived'), value: 'arrived' },
    { label: t('common.delivered'), value: 'delivered' },
    { label: t('common.cancelled'), value: 'cancelled' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {t('orders.title')}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {t('orders.subtitle')}
          </p>
        </div>

        <button
          onClick={() => navigate('/order')}
          className="btn btn-primary"
          style={{ gap: '0.5rem' }}
        >
          <Link2 size={16} />
          <span>{t('orders.newOrder')}</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="impex-card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          {/* Status Tabs */}
          <div className="horizontal-scroll-tabs" style={{ flex: 1, minWidth: 0 }}>
            {tabs.map((tab) => {
              const isActive = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => {
                    setStatusFilter(tab.value);
                    setPage(1);
                  }}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.8125rem',
                    fontWeight: isActive ? 700 : 500,
                    backgroundColor: isActive ? 'var(--primary)' : 'var(--bg-muted)',
                    color: isActive ? '#ffffff' : 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '220px', flex: '0 1 260px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
            <input
              type="text"
              placeholder={t('orders.searchPlaceholder')}
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="input"
              style={{ paddingLeft: '2.25rem', height: '36px', fontSize: '0.8125rem' }}
            />
          </div>
        </div>
      </div>

      {/* Orders List / Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="skeleton" style={{ height: '70px', borderRadius: 'var(--radius-lg)' }} />
          <div className="skeleton" style={{ height: '70px', borderRadius: 'var(--radius-lg)' }} />
          <div className="skeleton" style={{ height: '70px', borderRadius: 'var(--radius-lg)' }} />
        </div>
      ) : filteredOrders.length > 0 ? (
        <>
          {/* Desktop Table View */}
          <div className="impex-card desktop-table-view" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.875rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                      Order #
                    </th>
                    <th style={{ padding: '0.875rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                      Product & Merchant
                    </th>
                    <th style={{ padding: '0.875rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                      Amount
                    </th>
                    <th style={{ padding: '0.875rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                      Status
                    </th>
                    <th style={{ padding: '0.875rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                      Date
                    </th>
                    <th style={{ padding: '0.875rem 1.25rem', textAlign: 'right' }} />
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o) => {
                    const amount = Number(o.final_total || o.quoted_total || o.customer_estimated_price || o.total_amount_usd || 0);

                    return (
                      <tr
                        key={o.id}
                        onClick={() => navigate(`/orders/${o.id}`)}
                        style={{
                          borderBottom: '1px solid var(--border-light)',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-muted)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <td style={{ padding: '1rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', color: 'var(--primary)' }}>
                          #{o.order_number || String(o.id).slice(0, 8)}
                        </td>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', maxWidth: '320px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {o.product_name || o.title || 'Imported Product'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {o.merchant_name || o.merchant_domain || 'Global Store'}
                          </div>
                        </td>
                        <td style={{ padding: '1rem 1.25rem', fontWeight: 700, fontSize: '0.875rem' }}>
                          {amount > 0 ? `$${amount.toFixed(2)} USD` : 'Pending Quote'}
                        </td>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          {getStatusBadge(o.status)}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          {new Date(o.created_at || Date.now()).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                          <ArrowRight size={16} style={{ color: 'var(--text-light)' }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View (< 768px) */}
          <div className="mobile-card-view">
            {filteredOrders.map((o) => {
              const amount = Number(o.final_total || o.quoted_total || o.customer_estimated_price || o.total_amount_usd || 0);

              return (
                <div
                  key={o.id}
                  className="impex-card impex-card-interactive"
                  onClick={() => navigate(`/orders/${o.id}`)}
                  style={{
                    padding: '1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--primary)' }}>
                      #{o.order_number || String(o.id).slice(0, 8)}
                    </span>
                    {getStatusBadge(o.status)}
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                      {o.product_name || o.title || 'Imported Product'}
                    </h4>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Store: {o.merchant_name || o.merchant_domain || 'Global Store'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)' }}>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {amount > 0 ? `$${amount.toFixed(2)} USD` : 'Pending Quote'}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        Placed {new Date(o.created_at || Date.now()).toLocaleDateString()}
                      </div>
                    </div>
                    <button className="btn btn-subtle btn-sm" style={{ padding: '0.35rem 0.65rem' }}>
                      <span>Details</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Empty State */
        <div className="impex-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
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
            <Package size={26} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.4rem' }}>
            No international orders yet.
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
            Find something you love from anywhere in the world and let IMPEX handle the rest.
          </p>
          <button
            onClick={() => navigate('/order')}
            className="btn btn-primary"
            style={{ gap: '0.5rem' }}
          >
            <Link2 size={16} />
            <span>Order from Anywhere</span>
          </button>
        </div>
      )}
    </div>
  );
}
