import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useExchangeRate } from '../../context/ExchangeRateContext';
import { useTranslation } from '../../context/LanguageContext';
import api from '../../api/client';
import TopUpModal from '../../components/modals/TopUpModal';
import AddressModal from '../../components/modals/AddressModal';
import {
  CheckCircle2,
  Lock,
  ShieldCheck,
  Wallet,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Truck,
  Package,
  Plus,
  MapPin,
  Tag,
  User,
  Phone,
  Home,
  Briefcase,
  Building,
} from 'lucide-react';

export default function CheckoutPage() {
  const { navigate } = useRouter();
  const { cart, items, clearCart } = useCart();
  const { user, wallet, refreshUser } = useAuth();
  const { toHtg } = useExchangeRate();
  const { t } = useTranslation();
  const toast = useToast();

  const [step, setStep] = useState(1); // 1: Review, 2: Address, 3: Payment, 4: Success
  const [customerNotes, setCustomerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [topUpOpen, setTopUpOpen] = useState(false);

  // Address & Recipient State
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [recipientName, setRecipientName] = useState(
    user?.name || (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : '')
  );
  const [contactPhone, setContactPhone] = useState(user?.phone || '');
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);

  useEffect(() => {
    if (user) {
      if (!recipientName && (user.name || user.first_name)) {
        setRecipientName((user.name || `${user.first_name || ''} ${user.last_name || ''}`).trim());
      }
      if (!contactPhone && user.phone) {
        setContactPhone(user.phone);
      }
    }
  }, [user]);

  const loadAddresses = async () => {
    try {
      const list = await api.getAddresses();
      const addrs = Array.isArray(list) ? list : (list?.addresses || []);
      setAddresses(addrs);
      if (addrs.length > 0 && !selectedAddressId) {
        const primary = addrs.find((a) => a.is_primary) || addrs[0];
        setSelectedAddressId(primary.id);
      }
    } catch {
      setAddresses([]);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, [user?.id]);

  const handleAddressSaved = (saved) => {
    loadAddresses();
    if (saved?.id) {
      setSelectedAddressId(saved.id);
    }
    setIsAddressModalOpen(false);
    setEditingAddress(null);
  };

  // Authoritative figures from cart
  const summary = cart?.summary || {};
  const totalUsd = summary.total_estimated_usd || items.reduce((sum, it) => sum + (it.unit_price * it.quantity), 0);
  const totalHtg = summary.total_estimated_htg || toHtg(totalUsd);

  const spendable = Number(wallet?.spendable_balance ?? wallet?.spendable_balance_usd ?? wallet?.balance ?? wallet?.balance_usd ?? 0);
  const remainingBalance = spendable - totalUsd;
  const hasEnoughFunds = remainingBalance >= 0;

  const handlePlaceOrder = async () => {
    if (!hasEnoughFunds) {
      toast.error('Insufficient wallet balance. Please top up your wallet to complete this order.');
      setTopUpOpen(true);
      return;
    }

    if (!recipientName.trim()) {
      toast.error('Please enter the recipient full name for this delivery.');
      setStep(2);
      return;
    }

    if (!contactPhone.trim()) {
      toast.error('Please enter a contact phone number for delivery coordination.');
      setStep(2);
      return;
    }

    setIsSubmitting(true);
    try {
      const order = await api.checkout({
        deliveryMethod: selectedAddressId ? 'DELIVERY' : 'PICKUP',
        deliveryAddressId: selectedAddressId || null,
        paymentMethod: 'WALLET',
        customerNotes,
      });

      setConfirmedOrder(order);
      setStep(4);
      toast.success('International shopping order successfully placed!');
      await Promise.all([refreshUser(), clearCart()]);
    } catch (err) {
      toast.error(err.message || 'Checkout failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 4: Success View
  if (step === 4 && confirmedOrder) {
    return (
      <div className="impex-card" style={{ maxWidth: '640px', margin: '2rem auto', textAlign: 'center', padding: '3rem 2rem' }}>
        <CheckCircle2 size={56} style={{ color: 'var(--success)', margin: '0 auto 1.25rem' }} />
        <span className="badge badge-success" style={{ marginBottom: '0.75rem' }}>
          Payment & Order Confirmed
        </span>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          Order #{confirmedOrder.order_number || confirmedOrder.id}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginBottom: '2rem' }}>
          Your international order has been received by IMPEX. Funds are secured in escrow and procurement is underway.
        </p>

        <div
          style={{
            backgroundColor: 'var(--bg-muted)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            marginBottom: '2rem',
            fontSize: '0.875rem',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Order Total:</span>
            <strong>${Number(confirmedOrder.total_amount || totalUsd).toFixed(2)} USD</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Payment Method:</span>
            <span>IMPEX Wallet Escrow</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Destination Depot:</span>
            <span>Port-au-Prince, Haiti Central Hub</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Status:</span>
            <span className="badge badge-primary">Processing / In Procurement</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button onClick={() => navigate(`/orders/${confirmedOrder.id}`)} className="btn btn-primary btn-lg">
            Track Order
          </button>
          <button onClick={() => navigate('/shop')} className="btn btn-secondary btn-lg">
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Step Stepper Header */}
      <div className="impex-card" style={{ padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {[
            { num: 1, label: 'Review Items' },
            { num: 2, label: 'Delivery Address' },
            { num: 3, label: 'Payment' },
          ].map((s) => {
            const isCurrent = step === s.num;
            const isCompleted = step > s.num;
            return (
              <div
                key={s.num}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: isCurrent ? 'var(--primary)' : isCompleted ? 'var(--success-text)' : 'var(--text-light)',
                  fontWeight: isCurrent || isCompleted ? 700 : 500,
                  fontSize: '0.875rem',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: isCurrent ? 'var(--primary)' : isCompleted ? 'var(--success-bg)' : 'var(--bg-muted)',
                    color: isCurrent ? '#ffffff' : isCompleted ? 'var(--success)' : 'var(--text-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    border: isCompleted ? '1px solid var(--success-border)' : 'none',
                  }}
                >
                  {isCompleted ? '✓' : s.num}
                </div>
                <span className="stepper-label">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1: Review Items */}
      {step === 1 && (
        <div className="impex-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Review Your Order Items</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {items.map((it) => (
              <div
                key={it.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem',
                  backgroundColor: '#fafbfc',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                }}
              >
                {it.image_url ? (
                  <img
                    src={it.image_url}
                    alt={it.title}
                    style={{ width: '50px', height: '50px', objectFit: 'contain', borderRadius: '4px' }}
                  />
                ) : (
                  <div style={{ width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', borderRadius: '4px' }}>
                    <ShoppingCart size={20} style={{ color: 'var(--text-light)', opacity: 0.5 }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {it.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Merchant: {it.merchant} • Qty: {it.quantity}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.925rem' }}>
                  ${(it.unit_price * it.quantity).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              {t('orderForm.notesTitle')}
            </label>
            <input
              type="text"
              placeholder={t('orderForm.notesHelp')}
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              className="input-field"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button onClick={() => setStep(2)} className="btn btn-primary btn-lg">
              <span>Next: Receiving Address</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Haiti Delivery Address & Contact */}
      {step === 2 && (
        <div className="impex-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Haiti Delivery Destination</h2>
              <span className="badge badge-success">
                <ShieldCheck size={12} />
                <span>Verified Routing</span>
              </span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Choose your saved delivery address in Haiti or add a new one on the fly.
            </p>
          </div>

          {/* Recipient Contact Card */}
          <div
            style={{
              backgroundColor: 'var(--bg-muted)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  {t('orderForm.recipientSectionTitle')}
                </h3>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', backgroundColor: '#eff6ff', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)' }}>
                {t('orderForm.recipientRequiredBadge')}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
                  {t('orderForm.recipientNameLabel')} *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder={t('orderForm.recipientNamePlaceholder')}
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
                  {t('orderForm.recipientPhoneLabel')} *
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="tel"
                    className="input"
                    style={{ paddingLeft: '2.25rem' }}
                    placeholder={t('orderForm.recipientPhonePlaceholder')}
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Address Book & Active Add Button */}
          <div
            style={{
              backgroundColor: 'var(--bg-body)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={18} style={{ color: 'var(--primary)' }} />
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    {t('orderForm.addressBookTitle')}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                    {t('orderForm.addressBookSubtitle')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingAddress(null);
                  setIsAddressModalOpen(true);
                }}
                className="btn btn-secondary btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontWeight: 700,
                  color: 'var(--primary)',
                  borderColor: 'var(--primary)',
                }}
              >
                <Plus size={15} />
                <span>{t('orderForm.addNewAddressBtn')}</span>
              </button>
            </div>

            {addresses.length === 0 ? (
              <div
                style={{
                  padding: '1.5rem',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-muted)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--border)',
                }}
              >
                <MapPin size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 0.5rem' }} />
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  {t('orderForm.noAddressesSaved')}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingAddress(null);
                    setIsAddressModalOpen(true);
                  }}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Plus size={14} />
                  <span>{t('orderForm.addAddressNowBtn')}</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                {addresses.map((addr) => {
                  const isSelected = selectedAddressId === addr.id;
                  return (
                    <div
                      key={addr.id}
                      onClick={() => setSelectedAddressId(addr.id)}
                      style={{
                        padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                        backgroundColor: isSelected ? 'rgba(79, 70, 229, 0.04)' : 'var(--bg-body)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.5rem',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: addr.label === 'Work' ? '#fef3c7' : addr.label === 'Office' ? '#e0e7ff' : '#dcfce7',
                              color: addr.label === 'Work' ? '#92400e' : addr.label === 'Office' ? '#3730a3' : '#166534',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <Tag size={11} />
                            <span>{addr.label || 'Home'}</span>
                            {addr.is_primary && ' • Primary'}
                          </span>
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              border: isSelected ? '5px solid var(--primary)' : '2px solid var(--border)',
                              backgroundColor: '#ffffff',
                            }}
                          />
                        </div>

                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                          {addr.recipient_name || recipientName || 'Recipient'}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          {addr.street}
                        </div>
                      </div>

                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.4rem' }}>
                        {addr.city}, {addr.state} • {addr.phone || contactPhone || 'Haiti'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
            <button onClick={() => setStep(1)} className="btn btn-secondary">
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <button onClick={() => setStep(3)} className="btn btn-primary btn-lg">
              <span>Next: Payment</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Payment Method via IMPEX Wallet */}
      {step === 3 && (
        <div className="impex-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Confirm Payment</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Order funds are deducted safely from your IMPEX spendable wallet balance
            </p>
          </div>

          {/* Wallet Financial Breakdown */}
          <div
            style={{
              backgroundColor: 'var(--bg-muted)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Wallet size={20} style={{ color: 'var(--primary)' }} />
                <span style={{ fontWeight: 600, fontSize: '0.925rem' }}>Spendable Wallet Balance:</span>
              </div>
              <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                ${Number(spendable).toFixed(2)} USD
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Order Total (Items + Freight + Service):</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--danger-text)' }}>
                - ${totalUsd.toFixed(2)} USD
              </span>
            </div>

            <div
              style={{
                borderTop: '1px solid var(--border)',
                paddingTop: '0.875rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.925rem' }}>Remaining Balance After Payment:</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  ≈ {toHtg(remainingBalance).toLocaleString()} HTG
                </div>
              </div>
              <span
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 800,
                  color: hasEnoughFunds ? 'var(--success)' : 'var(--danger)',
                }}
              >
                ${remainingBalance.toFixed(2)} USD
              </span>
            </div>
          </div>

          {/* Insufficient balance warning & Top-up CTA */}
          {!hasEnoughFunds && (
            <div
              style={{
                backgroundColor: 'var(--warning-bg)',
                border: '1px solid var(--warning-border)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--warning-text)' }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  You need <strong>${Math.abs(remainingBalance).toFixed(2)} USD</strong> more to place this order.
                </span>
              </div>
              <button
                onClick={() => setTopUpOpen(true)}
                className="btn btn-primary btn-sm"
                style={{ gap: '0.35rem' }}
              >
                <Plus size={14} />
                <span>Top Up Now</span>
              </button>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
            <button onClick={() => setStep(2)} className="btn btn-secondary">
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <button
              onClick={handlePlaceOrder}
              disabled={isSubmitting || !hasEnoughFunds}
              className="btn btn-primary btn-lg"
              style={{ minWidth: '220px' }}
            >
              {isSubmitting ? <span className="spinner" /> : `Confirm & Pay $${totalUsd.toFixed(2)}`}
            </button>
          </div>
        </div>
      )}

      <TopUpModal isOpen={topUpOpen} onClose={() => setTopUpOpen(false)} />
      <AddressModal
        isOpen={isAddressModalOpen}
        onClose={() => {
          setIsAddressModalOpen(false);
          setEditingAddress(null);
        }}
        onAddressSaved={handleAddressSaved}
        initialAddress={editingAddress}
      />
    </div>
  );
}
