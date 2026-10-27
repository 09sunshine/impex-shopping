import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import api from '../../api/client';
import {
  Store,
  ExternalLink,
  Link2,
  CheckCircle2,
  Search,
  Sparkles,
  ArrowRight,
  Info,
  RefreshCw,
  Globe,
} from 'lucide-react';

const STATIC_MERCHANTS = [
  {
    slug: 'amazon',
    name: 'Amazon US',
    domain: 'amazon.com',
    tagline: 'World’s largest marketplace: Electronics, Fashion, Home, Gadgets',
    logo_icon: '🛒',
    popular_categories: ['Electronics', 'Computers', 'Home & Kitchen', 'Beauty'],
  },
  {
    slug: 'shein',
    name: 'SHEIN US',
    domain: 'shein.com',
    tagline: 'Global fast fashion, trendy apparel, shoes & accessories',
    logo_icon: '👗',
    popular_categories: ['Women Fashion', 'Men Fashion', 'Shoes', 'Accessories'],
  },
  {
    slug: 'aliexpress',
    name: 'AliExpress',
    domain: 'aliexpress.com',
    tagline: 'Millions of affordable factory-direct consumer goods & tech parts',
    logo_icon: '📦',
    popular_categories: ['Gadgets', 'Phone Accessories', 'Tools', 'Smart Home'],
  },
  {
    slug: 'ebay',
    name: 'eBay US',
    domain: 'ebay.com',
    tagline: 'New, refurbished, certified pre-owned tech, collectibles & deals',
    logo_icon: '🏷️',
    popular_categories: ['Refurbished Laptops', 'Sneakers', 'Collectibles', 'Auto Parts'],
  },
  {
    slug: 'fashionnova',
    name: 'Fashion Nova',
    domain: 'fashionnova.com',
    tagline: 'Trendsetting streetwear, dresses, clubwear & modern styles',
    logo_icon: '✨',
    popular_categories: ['Dresses', 'Denim', 'Loungewear', 'Swimwear'],
  },
  {
    slug: 'hm',
    name: 'H&M US',
    domain: 'hm.com',
    tagline: 'Modern Scandinavian fashion basics, sustainable style & home decor',
    logo_icon: '🧥',
    popular_categories: ['Basics', 'Office Wear', 'Kids Apparel', 'H&M Home'],
  },
  {
    slug: 'temu',
    name: 'Temu',
    domain: 'temu.com',
    tagline: 'Wholesale-priced trending household goods, gadgets & daily essentials',
    logo_icon: '⚡',
    popular_categories: ['Kitchen Tools', 'Storage', 'Apparel', 'Automotive'],
  },
  {
    slug: 'walmart',
    name: 'Walmart US',
    domain: 'walmart.com',
    tagline: 'Everyday low prices on electronics, home essentials, tools & toys',
    logo_icon: '🏬',
    popular_categories: ['Smart TVs', 'Kitchen Appliances', 'Toys', 'Bedding'],
  },
];

export default function MerchantsPage() {
  const { navigate } = useRouter();
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');

  const fetchMerchants = async () => {
    setLoading(true);
    try {
      const data = await api.getShoppingMerchants();
      const list = Array.isArray(data) ? data : (data?.merchants || []);
      setMerchants(list);
    } catch {
      setMerchants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchants();
  }, []);

  const displayList = STATIC_MERCHANTS.map((m) => {
    const liveMatch = merchants.find(
      (lm) => lm.slug === m.slug || (lm.domain && lm.domain.includes(m.domain))
    );

    return {
      ...m,
      liveMatch,
      urlOrderSupported: true,
    };
  });

  const filteredList = displayList.filter(
    (m) =>
      m.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      m.domain.toLowerCase().includes(searchFilter.toLowerCase()) ||
      m.tagline.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          <Store size={14} />
          <span>Supported Stores Directory</span>
        </div>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Supported Merchants & Online Stores
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '720px' }}>
          Order from any of these 8 premier international retailers by copying and pasting a product link. IMPEX manages merchant purchase, US sales tax optimization, air freight, customs, and delivery in Haiti.
        </p>
      </div>

      {/* URL Ordering Guide Notice */}
      <div
        className="impex-card"
        style={{
          padding: '1.25rem 1.5rem',
          backgroundColor: '#eff6ff',
          borderLeft: '4px solid var(--primary)',
          display: 'flex',
          gap: '1rem',
          alignItems: 'flex-start',
        }}
      >
        <Info size={20} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.875rem', color: '#1e40af', lineHeight: 1.5 }}>
          <strong style={{ color: '#1e3a8a', display: 'block', marginBottom: '0.25rem' }}>
            URL-Only Ordering Active
          </strong>
          <span>
            Find items directly on any of the supported merchant websites below. Copy the product URL from your browser address bar and paste it into the <strong>Order by Product URL</strong> form. Our operations team will verify current stock, price, and shipping to issue you an official quotation.
          </span>
        </div>
      </div>

      {/* Search and Action Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input"
            placeholder="Search stores or brands..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => navigate('/order')}
            className="btn btn-primary"
            style={{ gap: '0.4rem' }}
          >
            <Link2 size={16} />
            <span>Order by Product URL</span>
          </button>
          <button
            onClick={fetchMerchants}
            disabled={loading}
            className="btn btn-secondary"
            title="Refresh status"
          >
            <RefreshCw size={15} className={loading ? 'spinner' : ''} />
          </button>
        </div>
      </div>

      {/* Merchants Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '1.25rem' }}>
        {filteredList.map((m) => {
          return (
            <div
              key={m.slug}
              className="impex-card"
              style={{
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1.25rem',
                border: '1px solid var(--border)',
                transition: 'all 0.2s ease',
              }}
            >
              <div>
                {/* Header row with logo and capability badge */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                        border: '1px solid var(--border-light)',
                        flexShrink: 0,
                      }}
                    >
                      {m.logo_icon}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
                        {m.name}
                      </h3>
                      <a
                        href={`https://${m.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '0.75rem', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none', fontWeight: 600 }}
                        title={`Visit ${m.name}`}
                      >
                        <span>{m.domain}</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>

                  <span className="badge badge-primary" style={{ fontSize: '0.6875rem', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                    <Link2 size={12} />
                    <span>URL Ordering</span>
                  </span>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1rem' }}>
                  {m.tagline}
                </p>

                {/* Popular categories tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  {m.popular_categories.map((cat) => (
                    <span
                      key={cat}
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        backgroundColor: 'var(--bg-body)',
                        color: 'var(--text-secondary)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-light)',
                      }}
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Actions */}
              <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
                <button
                  onClick={() => navigate(`/order?merchant=${m.slug}`)}
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1, justifyContent: 'center', gap: '0.35rem' }}
                >
                  <Link2 size={14} />
                  <span>Order by Product URL</span>
                </button>

                <a
                  href={`https://${m.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ gap: '0.35rem', padding: '0.45rem 0.75rem', textDecoration: 'none' }}
                  title={`Open ${m.name} to copy a product link`}
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {filteredList.length === 0 && (
        <div className="impex-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <Store size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>No stores matching "{searchFilter}"</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            You can order from any unlisted store using the "Other store" option in our URL order tool.
          </p>
          <button onClick={() => navigate('/order')} className="btn btn-primary">
            Order by Custom URL
          </button>
        </div>
      )}
    </div>
  );
}
