import React from 'react';
import { useRouter } from '../../context/RouterContext';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useExchangeRate } from '../../context/ExchangeRateContext';
import {
  ShoppingCart,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Truck,
  Plus,
  Minus,
  Store,
  Receipt,
  Info,
} from 'lucide-react';

export default function CartPage() {
  const { navigate } = useRouter();
  const { cart, items, itemCount, updateQuantity, removeItem, clearCart, loading } = useCart();
  const { isAuthenticated } = useAuth();
  const { toHtg } = useExchangeRate();

  if (!isAuthenticated) {
    return (
      <div className="impex-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
        <ShoppingCart size={48} style={{ color: 'var(--text-light)', margin: '0 auto 1rem' }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Please Sign In to View Your Cart
        </h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Your IMPEX shopping cart is securely attached to your personal account.
        </p>
        <button onClick={() => navigate('/profile')} className="btn btn-primary">
          Sign In to IMPEX
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="impex-card" style={{ textAlign: 'center', padding: '4rem 1.5rem' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary-light)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
          }}
        >
          <ShoppingCart size={32} />
        </div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          URL-Only Ordering Active
        </h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '460px', margin: '0 auto 1.5rem', fontSize: '0.925rem' }}>
          Direct catalog cart shopping is currently paused. Please submit your international purchases by copying and pasting product web links.
        </p>
        <button onClick={() => navigate('/order')} className="btn btn-primary btn-lg" style={{ gap: '0.5rem' }}>
          <span>Order by Product URL</span>
          <ArrowRight size={18} />
        </button>
      </div>
    );
  }

  // Multi-merchant grouping
  const groupedByMerchant = items.reduce((acc, item) => {
    const m = item.merchant || 'International Merchant';
    if (!acc[m]) acc[m] = [];
    acc[m].push(item);
    return acc;
  }, {});

  // Extract authoritative summary from backend cart response
  const summary = cart?.summary || {};
  const subtotal = summary.subtotal || items.reduce((sum, it) => sum + (it.unit_price * it.quantity), 0);
  const merchantShipping = summary.estimated_merchant_shipping || 0.00;
  const freight = summary.estimated_freight_usd || (itemCount * 4.50);
  const serviceFee = summary.service_fee || (subtotal * 0.05);
  const customsDuty = summary.customs_duty || 0.00;
  const totalUsd = summary.total_estimated_usd || (subtotal + merchantShipping + freight + serviceFee + customsDuty);
  const totalHtg = summary.total_estimated_htg || toHtg(totalUsd);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Shopping Cart</h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {itemCount} item(s) from {Object.keys(groupedByMerchant).length} merchant store(s)
          </p>
        </div>
        <button
          onClick={clearCart}
          className="btn btn-secondary btn-sm"
          style={{ gap: '0.35rem', color: 'var(--danger-text)' }}
        >
          <Trash2 size={14} />
          <span>Clear Cart</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '1.75rem', alignItems: 'start' }}>
        {/* Left Column: Multi-Merchant Grouped Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {Object.entries(groupedByMerchant).map(([merchantName, merchantItems]) => (
            <div key={merchantName} className="impex-card" style={{ padding: '1.25rem' }}>
              {/* Merchant Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  paddingBottom: '0.875rem',
                  borderBottom: '1px solid var(--border-light)',
                  marginBottom: '1rem',
                }}
              >
                <Store size={18} style={{ color: 'var(--primary)' }} />
                <span style={{ fontWeight: 700, fontSize: '0.925rem' }}>
                  Merchant: {merchantName}
                </span>
                <span className="badge badge-primary" style={{ marginLeft: 'auto' }}>
                  {merchantItems.length} item(s)
                </span>
              </div>

              {/* Items List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {merchantItems.map((item) => {
                  const lineTotal = (item.unit_price * item.quantity).toFixed(2);
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'center',
                        paddingBottom: '1rem',
                        borderBottom: '1px solid var(--border-light)',
                      }}
                    >
                      {/* Thumbnail */}
                      <div
                        style={{
                          width: '75px',
                          height: '75px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: '#ffffff',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          flexShrink: 0,
                        }}
                      >
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.title}
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <ShoppingCart size={24} style={{ color: 'var(--text-light)', opacity: 0.5 }} />
                        )}
                      </div>

                      {/* Details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            marginBottom: '0.25rem',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.title}
                        </h4>
                        {item.selected_variant && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                            Option: <strong>{item.selected_variant}</strong>
                          </div>
                        )}
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          ${item.unit_price.toFixed(2)} USD each
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: '#ffffff',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity - 1, item.selected_variant)}
                          disabled={loading}
                          style={{
                            width: '28px',
                            height: '28px',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <Minus size={13} />
                        </button>
                        <span style={{ width: '28px', textAlign: 'center', fontSize: '0.8125rem', fontWeight: 700 }}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity + 1, item.selected_variant)}
                          disabled={loading}
                          style={{
                            width: '28px',
                            height: '28px',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      {/* Line Total */}
                      <div style={{ minWidth: '70px', textAlign: 'right', fontWeight: 800, fontSize: '0.925rem' }}>
                        ${lineTotal}
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={loading}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-light)',
                          cursor: 'pointer',
                          padding: '4px',
                        }}
                        title="Remove item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Authoritative Order Summary */}
        <div className="impex-card" style={{ position: 'sticky', top: '90px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <Receipt size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Order Cost Breakdown</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Items Subtotal:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>${subtotal.toFixed(2)} USD</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Merchant Domestic Shipping:</span>
              <span>{merchantShipping > 0 ? `$${merchantShipping.toFixed(2)}` : 'FREE'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Est. Air Freight to Haiti:</span>
              <span>${freight.toFixed(2)} USD</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Procurement & Customs Processing:</span>
              <span>${serviceFee.toFixed(2)} USD</span>
            </div>

            {customsDuty > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Customs Tariff:</span>
                <span>${customsDuty.toFixed(2)} USD</span>
              </div>
            )}

            <div
              style={{
                borderTop: '1.5px solid var(--border)',
                paddingTop: '0.875rem',
                marginTop: '0.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Total to Pay:
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  ≈ {totalHtg.toLocaleString()} HTG
                </div>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
                ${totalUsd.toFixed(2)}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <button
              onClick={() => navigate('/checkout')}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', gap: '0.5rem' }}
            >
              <span>Proceed to Checkout</span>
              <ArrowRight size={18} />
            </button>
          </div>

          <div
            style={{
              marginTop: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-muted)',
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <ShieldCheck size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
            <span>Paid securely via IMPEX Wallet Escrow. Funds are only settled upon verified procurement.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
