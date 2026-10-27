import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useRouter } from '../../context/RouterContext';
import { useTranslation } from '../../context/LanguageContext';
import api from '../../api/client';
import {
  Package,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Clock,
  Layers,
  Database,
  Tag,
  AlertCircle,
  Info,
} from 'lucide-react';

export default function AdminCatalogPage() {
  const { isAdmin, isAuthenticated } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const { t } = useTranslation();

  const [products, setProducts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMerchant, setSelectedMerchant] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminCatalog({
        query: searchQuery,
        merchant: selectedMerchant,
        page,
        limit,
      });
      setProducts(res?.items || []);
      setTotalCount(res?.total || 0);
    } catch (err) {
      toast.error(err.message || 'Failed to fetch catalog products.');
      setProducts([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchCatalog();
    }
  }, [isAuthenticated, isAdmin, selectedMerchant, page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchCatalog();
  };

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="impex-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', maxWidth: '520px', margin: '2rem auto' }}>
        <ShieldCheck size={48} style={{ color: 'var(--danger)', margin: '0 auto 1rem' }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Admin Access Required</h3>
        <p style={{ color: 'var(--text-muted)' }}>You must be an authenticated administrator to access the Product Engine catalog.</p>
      </div>
    );
  }

  const merchantsList = [
    { id: '', label: 'All Merchants' },
    { id: 'amazon', label: 'Amazon US' },
    { id: 'shein', label: 'SHEIN US' },
    { id: 'aliexpress', label: 'AliExpress' },
    { id: 'ebay', label: 'eBay' },
    { id: 'fashionnova', label: 'Fashion Nova' },
    { id: 'hm', label: 'H&M' },
    { id: 'temu', label: 'Temu' },
    { id: 'walmart', label: 'Walmart' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontWeight: 700, fontSize: '0.8125rem' }}>
            <Database size={16} />
            <span>Product Engine</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Master Catalog Inventory</h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Real-time feed items, API-cached listings, and price freshness indicators across all merchants ({totalCount} total)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => navigate('/admin/orders')}
            className="btn btn-secondary btn-sm"
            style={{ gap: '0.35rem' }}
          >
            <Package size={14} />
            <span>Orders Queue</span>
          </button>
          <button
            onClick={fetchCatalog}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            style={{ gap: '0.35rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* URL-Only Mode Notice */}
      <div
        style={{
          padding: '1rem 1.25rem',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          fontSize: '0.85rem',
          color: '#1e40af',
          lineHeight: 1.5,
        }}
      >
        <Info size={18} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong style={{ display: 'block', color: '#1e3a8a', marginBottom: '0.2rem' }}>
            URL-Only Product Sourcing Active (PRODUCT_SOURCE_MODE=url_only)
          </strong>
          External Awin feeds and live merchant API product retrievals are temporarily paused. Customer orders arrive via submitted product URLs and are routed directly to the <button onClick={() => navigate('/admin/orders')} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>Orders Verification Queue</button> for operator pricing and quotation.
        </div>
      </div>
      <div className="impex-card" style={{ padding: '1rem 1.25rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
            <input
              type="text"
              className="input"
              placeholder={t('shop.searchProducts', 'Search products, brands, or categories...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          <div style={{ minWidth: '180px' }}>
            <select
              className="input"
              value={selectedMerchant}
              onChange={(e) => {
                setSelectedMerchant(e.target.value);
                setPage(1);
              }}
            >
              {merchantsList.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '0.55rem 1.25rem' }}>
            {t('common.filter', 'Filter')}
          </button>
        </form>
      </div>

      {/* Catalog Table */}
      {loading ? (
        <div className="impex-card" style={{ padding: '2rem' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '54px', marginBottom: '0.75rem', borderRadius: 'var(--radius-sm)' }} />
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="impex-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-muted)', borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.875rem 1.25rem' }}>Product</th>
                  <th style={{ padding: '0.875rem 1.25rem' }}>Merchant</th>
                  <th style={{ padding: '0.875rem 1.25rem' }}>Price (USD / HTG)</th>
                  <th style={{ padding: '0.875rem 1.25rem' }}>Freshness</th>
                  <th style={{ padding: '0.875rem 1.25rem' }}>Source</th>
                  <th style={{ padding: '0.875rem 1.25rem' }}>Updated</th>
                  <th style={{ padding: '0.875rem 1.25rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((item) => {
                  const freshness = item.freshness_status || 'FRESH';
                  const isFresh = freshness === 'FRESH';
                  const isStale = freshness === 'STALE';
                  const isExpired = freshness === 'EXPIRED';

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', maxWidth: '340px' }}>
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.title}
                              style={{ width: '42px', height: '42px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }}
                            />
                          ) : (
                            <div style={{ width: '42px', height: '42px', borderRadius: '6px', backgroundColor: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Package size={18} style={{ color: 'var(--text-light)' }} />
                            </div>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.title}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              SKU: {item.external_product_id || item.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span className="badge badge-muted">
                          {item.merchant_name || item.merchant_slug}
                        </span>
                      </td>

                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          ${Number(item.base_price_usd || 0).toFixed(2)} USD
                        </div>
                        {item.price_htg && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            ≈ {Number(item.price_htg).toLocaleString('en-US', { maximumFractionDigits: 0 })} HTG
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span
                          className={`badge ${
                            isFresh ? 'badge-success' : isStale ? 'badge-warning' : isExpired ? 'badge-danger' : 'badge-muted'
                          }`}
                        >
                          {freshness}
                        </span>
                      </td>

                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {item.source_type || 'FEED'}
                        </span>
                      </td>

                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '—'}
                      </td>

                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        {item.merchant_url ? (
                          <a
                            href={item.merchant_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{ gap: '0.35rem' }}
                          >
                            <span>Store</span>
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-light)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderTop: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Showing {products.length} of {totalCount} catalog products
            </span>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn btn-secondary btn-sm"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={products.length < limit}
                className="btn btn-secondary btn-sm"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="impex-card"
          style={{
            textAlign: 'center',
            padding: '4rem 1.5rem',
            maxWidth: '560px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <Database size={28} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.4rem' }}>
              Catalog is Empty
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              No pre-indexed catalog items currently exist. Trigger an authorized Awin feed synchronization or let customers place URL and screenshot orders from Amazon, SHEIN, eBay, or Walmart.
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/orders')}
            className="btn btn-primary btn-sm"
            style={{ gap: '0.4rem' }}
          >
            <Package size={14} />
            <span>View Orders Queue</span>
          </button>
        </div>
      )}
    </div>
  );
}
