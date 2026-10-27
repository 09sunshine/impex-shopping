import React, { useState } from 'react';
import { useRouter } from '../../context/RouterContext';
import {
  Link2,
  Store,
  ExternalLink,
  ArrowRight,
  Info,
  CheckCircle2,
  Globe,
} from 'lucide-react';

const SUPPORTED_STORES = [
  { name: 'Amazon US', domain: 'amazon.com', icon: '🛒' },
  { name: 'SHEIN US', domain: 'shein.com', icon: '👗' },
  { name: 'AliExpress', domain: 'aliexpress.com', icon: '📦' },
  { name: 'eBay US', domain: 'ebay.com', icon: '🏷️' },
  { name: 'Fashion Nova', domain: 'fashionnova.com', icon: '✨' },
  { name: 'H&M US', domain: 'hm.com', icon: '🧥' },
  { name: 'Temu', domain: 'temu.com', icon: '⚡' },
  { name: 'Walmart US', domain: 'walmart.com', icon: '🏬' },
];

export default function ShopPage() {
  const { navigate } = useRouter();
  const [pastedUrl, setPastedUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = pastedUrl.trim();
    if (trimmed) {
      navigate(`/order?url=${encodeURIComponent(trimmed)}`);
    } else {
      navigate('/order');
    }
  };

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            backgroundColor: 'var(--primary-light)',
            color: 'var(--primary)',
            padding: '0.25rem 0.75rem',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.75rem',
            fontWeight: 700,
            marginBottom: '0.75rem',
          }}
        >
          <Link2 size={14} />
          <span>URL-Only Ordering Active</span>
        </div>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Catalog Sourcing via Product URL
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5 }}>
          Pre-indexed product catalog feeds are currently disabled. Customer-submitted product URLs are the primary and active ordering method on IMPEX.
        </p>
      </div>

      {/* Main Action Card */}
      <div
        className="impex-card"
        style={{
          padding: '2.25rem',
          backgroundColor: '#ffffff',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Link2 size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Paste Any Product Link to Order
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Browse directly on any international shopping website, copy the item’s URL, and paste it here. Our procurement team will inspect the product, verify real stock and price, and send you a custom quotation.
            </p>
          </div>
        </div>

        {/* Quick URL form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="url"
            className="input"
            placeholder="https://www.amazon.com/dp/... or paste any product link"
            value={pastedUrl}
            onChange={(e) => setPastedUrl(e.target.value)}
            style={{ flex: '1 1 300px', fontSize: '0.9rem' }}
          />
          <button type="submit" className="btn btn-primary" style={{ gap: '0.4rem', padding: '0 1.5rem' }}>
            <span>Order by Product URL</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <div
          style={{
            padding: '1rem',
            backgroundColor: '#eff6ff',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #bfdbfe',
            color: '#1e40af',
            fontSize: '0.8125rem',
            lineHeight: 1.5,
          }}
        >
          <strong>How it works:</strong> Paste URL → Submit request → Admin verification → Receive quotation → Accept quotation → Pay/reserve funds → Admin purchases product → Shipment processing → Customer pickup or delivery.
        </div>
      </div>

      {/* Supported Stores Section */}
      <div>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
          Supported International Stores
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          You can copy product links from any of these stores or use the "Other store" option:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
          {SUPPORTED_STORES.map((s) => (
            <div
              key={s.name}
              onClick={() => navigate(`/order?merchant=${s.name.toLowerCase().split(' ')[0]}`)}
              className="impex-card"
              style={{
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>{s.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {s.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>
                  Order by link →
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
