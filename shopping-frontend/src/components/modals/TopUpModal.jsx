import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useExchangeRate } from '../../context/ExchangeRateContext';
import { useTranslation } from '../../context/LanguageContext';
import api from '../../api/client';
import {
  X,
  Smartphone,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Wallet,
  ArrowRight,
  User,
  Phone,
} from 'lucide-react';

// Custom sharp, responsive PayPal SVG icon
function PaypalIcon({ size = 18, color = 'currentColor', style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      style={{ display: 'inline-block', flexShrink: 0, ...style }}
    >
      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.787.787 0 0 1 .777-.665h7.243c3.498 0 5.753 1.706 5.378 5.27-.323 3.076-2.26 4.757-5.183 4.757H9.72a.787.787 0 0 0-.777.665l-1.077 6.84a.641.641 0 0 1-.79.75z" />
      <path
        d="M9.72 13.082h3.439c2.923 0 4.86-1.681 5.183-4.757.375-3.564-1.88-5.27-5.378-5.27H5.72a.787.787 0 0 0-.777.665L2.146 20.597a.641.641 0 0 0 .633.74h4.606l1.077-6.84a.787.787 0 0 1 .778-.665z"
        opacity="0.35"
      />
    </svg>
  );
}

export default function TopUpModal({ isOpen, onClose }) {
  const { user, wallet, refreshUser } = useAuth();
  const toast = useToast();
  const { toHtg } = useExchangeRate();
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [amount, setAmount] = useState('50');
  const [method, setMethod] = useState('moncash');
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Active payment session state
  const [paymentSession, setPaymentSession] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);

  // Pre-populate name and contact from user profile
  useEffect(() => {
    if (user) {
      const defaultName = user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || '';
      setName(defaultName);
      const defaultPhone = user.phone || user.customer?.phone || '';
      setContact(defaultPhone);
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const getMethodDisplayName = (m) => {
    switch (m?.toLowerCase()) {
      case 'paypal':
        return 'PayPal';
      case 'moncash':
        return 'MonCash';
      case 'natcash':
        return 'NatCash';
      default:
        return 'Payment';
    }
  };

  const isPayPal = method === 'paypal';

  const handleInitiateTopUp = async (e) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid top-up amount greater than $0.');
      return;
    }
    if (!name.trim()) {
      toast.error('Please enter your full name for the payment invoice.');
      return;
    }
    if (!isPayPal && !contact.trim()) {
      toast.error('Please enter your contact phone number for mobile money payment authorization.');
      return;
    }

    setSubmitting(true);
    const providerLabel = getMethodDisplayName(method);

    try {
      const res = await api.requestTopUp({
        amount: numAmount,
        name: name.trim(),
        contact: contact.trim() || undefined,
        payment_method: method,
        currency: 'USD',
      });

      setPaymentSession(res);

      if (res.checkout_url) {
        window.open(res.checkout_url, '_blank', 'noopener,noreferrer');
        toast.info(`${providerLabel} checkout portal opened in a new tab. Complete your payment to fund your wallet.`);
      } else {
        toast.info(res.message || `Payment request initiated on ${providerLabel}.`);
      }
    } catch (err) {
      toast.error(err.message || `Failed to initiate ${providerLabel} top-up.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!paymentSession?.payment_reference) return;
    setVerifying(true);
    const providerLabel = paymentSession.payment_reference?.startsWith('PAYPAL') ? 'PayPal' : "Pay'm";

    try {
      const confirmRes = await api.confirmTopUp(paymentSession.payment_reference);
      await refreshUser();

      if (confirmRes.success || confirmRes.status === 'SUCCEEDED') {
        setIsCompleted(true);
        toast.success('Payment verified! Your wallet balance has been credited.');
      } else {
        toast.warning(
          confirmRes.message || `Payment is still being processed on ${providerLabel}. Please complete payment on the portal.`
        );
      }
    } catch (err) {
      toast.error(err.message || `Failed to verify payment with ${providerLabel}.`);
    } finally {
      setVerifying(false);
    }
  };

  const resetModal = () => {
    setPaymentSession(null);
    setIsCompleted(false);
    onClose();
  };

  const parsedAmount = parseFloat(amount) || 0;
  const estimatedHtg = toHtg ? toHtg(parsedAmount) : Math.round(parsedAmount * 131);
  const isSessionPayPal = paymentSession?.payment_reference?.startsWith('PAYPAL') || isPayPal;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={resetModal}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(3px)',
        }}
      />

      {/* Modal Dialog Card */}
      <div
        className="modal-responsive-card"
        style={{
          maxWidth: '520px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-xl)',
          padding: '1.75rem',
          position: 'relative',
          zIndex: 101,
          width: '100%',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                padding: '0.2rem 0.55rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                fontWeight: 700,
                marginBottom: '0.4rem',
              }}
            >
              <ShieldCheck size={13} />
              <span>{isPayPal ? 'PayPal Secured Gateway' : "Pay'm Secured Gateway"}</span>
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800 }}>{t('topUp.modalTitle')}</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {t('topUp.modalSubtitle')}
            </p>
          </div>
          <button
            onClick={resetModal}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-light)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {isCompleted ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              <CheckCircle2 size={32} />
            </div>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.4rem' }}>
              Wallet Topped Up Successfully!
            </h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Your deposit of <strong>${parsedAmount.toFixed(2)} USD</strong> has been securely verified and credited to your IMPEX balance. You can now use your wallet for zero-delay order purchases.
            </p>
            <button
              onClick={resetModal}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem' }}
            >
              Done • Return to Shopping
            </button>
          </div>
        ) : paymentSession ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ backgroundColor: 'var(--bg-muted)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8125rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Order ID:</span>
                <span style={{ fontWeight: 700 }}>{paymentSession.order_id || 'Generated'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8125rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Transaction Reference:</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{paymentSession.payment_reference}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Amount to Pay:</span>
                <span style={{ fontWeight: 800, color: 'var(--primary)' }}>
                  ${parsedAmount.toFixed(2)} USD (~{estimatedHtg.toLocaleString()} HTG)
                </span>
              </div>
            </div>

            {paymentSession.checkout_url ? (
              <a
                href={paymentSession.checkout_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.8rem', gap: '0.5rem', justifyContent: 'center' }}
              >
                <span>{isSessionPayPal ? 'Open PayPal Checkout' : "Open Pay'm Payment Page"}</span>
                <ExternalLink size={16} />
              </a>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                {paymentSession.message || 'Payment prompt dispatched. Please authorize on your portal/app.'}
              </p>
            )}

            <button
              onClick={handleVerifyPayment}
              disabled={verifying}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '0.75rem', gap: '0.5rem', justifyContent: 'center' }}
            >
              <RefreshCw size={15} className={verifying ? 'spin' : ''} />
              <span>
                {verifying
                  ? `Verifying with ${isSessionPayPal ? 'PayPal' : "Pay'm"}...`
                  : 'I Completed Payment • Verify & Credit Wallet'}
              </span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleInitiateTopUp} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            {/* Customer Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                {t('topUp.payerNameLabel', 'Full Name')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  placeholder={t('topUp.payerNamePlaceholder', 'e.g. Jean Pierre')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.75rem 0.65rem 2.25rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '0.875rem',
                  }}
                />
                <User size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>

            {/* Contact Phone */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                {t('topUp.payerPhoneLabel', 'Contact Phone')} {isPayPal ? '(Notification / Backup)' : '(MonCash / Natcash / Notification)'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="tel"
                  required={!isPayPal}
                  placeholder={isPayPal ? '+1 (555) 000-0000 (optional)' : '+509 3700 0000'}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.75rem 0.65rem 2.25rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '0.875rem',
                  }}
                />
                <Phone size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>

            {/* Amount */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {t('topUp.amountLabel', 'Top-up Amount (USD)')}
                </label>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  ≈ {estimatedHtg.toLocaleString()} HTG
                </span>
              </div>

              {/* Quick Preset Buttons */}
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                {['25', '50', '100', '250', '500'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(preset)}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      border: amount === preset ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                      backgroundColor: amount === preset ? 'var(--primary-light)' : '#ffffff',
                      color: amount === preset ? 'var(--primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    ${preset}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  min="5"
                  max="10000"
                  step="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.75rem 0.65rem 2rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '1rem',
                    fontWeight: 700,
                  }}
                />
                <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--text-muted)' }}>
                  $
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                {t('topUp.selectMethod', 'Payment Method')}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 95px), 1fr))', gap: '0.5rem' }}>
                {[
                  { id: 'moncash', name: 'MonCash', icon: Smartphone, tag: 'Digicel' },
                  { id: 'natcash', name: 'NatCash', icon: Smartphone, tag: 'Natcom' },
                  { id: 'paypal', name: 'PayPal', icon: PaypalIcon, tag: 'USD Account' },
                ].map((m) => {
                  const Icon = m.icon;
                  const isSelected = method === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id)}
                      style={{
                        padding: '0.65rem 0.5rem',
                        borderRadius: '8px',
                        border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                        backgroundColor: isSelected ? 'var(--primary-light)' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.2rem',
                        transition: 'all 0.15s ease-in-out',
                      }}
                    >
                      <Icon size={18} color={isSelected ? 'var(--primary)' : 'var(--text-muted)'} />
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>
                        {m.name}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: isSelected ? 'var(--primary)' : 'var(--text-light)' }}>
                        {m.tag}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.85rem',
                fontWeight: 700,
                gap: '0.5rem',
                justifyContent: 'center',
                marginTop: '0.5rem',
              }}
            >
              <span>
                {submitting
                  ? t('common.loading')
                  : t('topUp.dynamicProceedBtn', { method: getMethodDisplayName(method), amount: parsedAmount.toFixed(2) })}
              </span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
