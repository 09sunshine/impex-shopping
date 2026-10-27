import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../context/LanguageContext';
import api from '../../api/client';
import HomeDeliveryModal from '../../components/modals/HomeDeliveryModal';
import TopUpModal from '../../components/modals/TopUpModal';
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  QrCode,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  XCircle,
  ExternalLink,
  MapPin,
  Wallet,
  DollarSign,
  FileText,
  Calendar,
  Layers,
  HelpCircle,
  Plus,
} from 'lucide-react';

export default function OrderDetailPage() {
  const { currentPath, navigate } = useRouter();
  const { user, wallet, refreshUser } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();

  const orderId = decodeURIComponent(currentPath.replace(/^\/orders\//, '').replace(/^\/shopping\/orders\//, ''));

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals & Action States
  const [confirmQuoteModalOpen, setConfirmQuoteModalOpen] = useState(false);
  const [declineQuoteModalOpen, setDeclineQuoteModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [homeDeliveryModalOpen, setHomeDeliveryModalOpen] = useState(false);
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [countdownText, setCountdownText] = useState('');

  const fetchOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOrder(orderId);
      setOrder(data);
    } catch (err) {
      setError(err.message || 'Could not load order details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    const pollInterval = setInterval(() => {
      // Silently refresh order so customer sees quote the moment admin issues it
      api.getOrder(orderId).then((data) => {
        if (data) setOrder(data);
      }).catch(() => {});
    }, 15000);
    return () => clearInterval(pollInterval);
  }, [orderId]);

  // Active Quote computation
  const quotes = order?.quotes || [];
  const latestQuote = quotes.length > 0 ? quotes[quotes.length - 1] : null;

  // Countdown timer for quote expiration
  useEffect(() => {
    if (!latestQuote || !latestQuote.expires_at) {
      setCountdownText('');
      return;
    }

    const interval = setInterval(() => {
      const expiry = new Date(latestQuote.expires_at).getTime();
      const now = Date.now();
      const diff = expiry - now;

      if (diff <= 0) {
        setCountdownText('Expired');
        clearInterval(interval);
      } else {
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setCountdownText(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [latestQuote]);

  // Spendable balance & validation
  const spendable = Number(wallet?.spendable_balance ?? wallet?.spendable_balance_usd ?? wallet?.balance ?? wallet?.balance_usd ?? 0);
  const quoteTotal = Number(latestQuote?.total ?? order?.quoted_total ?? 0);
  const hasSufficientFunds = spendable >= quoteTotal;
  const shortfall = Math.max(0, quoteTotal - spendable);

  // Quote Confirmation (Locks wallet escrow)
  const handleConfirmQuote = async () => {
    if (!hasSufficientFunds) {
      setConfirmQuoteModalOpen(false);
      setTopUpModalOpen(true);
      return;
    }

    setActionLoading(true);
    try {
      await api.confirmQuote(order.id, {
        quoteId: latestQuote?.id,
      });
      toast.success('Quote confirmed! Funds reserved in your IMPEX wallet.');
      setConfirmQuoteModalOpen(false);
      await Promise.all([refreshUser(), fetchOrder()]);
    } catch (err) {
      toast.error(err.message || 'Failed to confirm quote.');
    } finally {
      setActionLoading(false);
    }
  };

  // Price Change Confirmation
  const handleConfirmPriceChange = async () => {
    setActionLoading(true);
    try {
      await api.confirmPriceChange(order.id, {
        quoteId: latestQuote?.id,
      });
      toast.success('Updated quote confirmed.');
      await Promise.all([refreshUser(), fetchOrder()]);
    } catch (err) {
      toast.error(err.message || 'Failed to confirm updated quote.');
    } finally {
      setActionLoading(false);
    }
  };

  // Order Cancellation
  const handleCancelOrder = async () => {
    if (!window.confirm('Are you sure you want to cancel this order? Any reserved wallet funds will be immediately released back to your spendable balance.')) {
      return;
    }

    setActionLoading(true);
    try {
      await api.cancelOrder(order.id, 'Cancelled by customer');
      toast.success('Order cancelled. Reserved funds released.');
      await Promise.all([refreshUser(), fetchOrder()]);
    } catch (err) {
      toast.error(err.message || 'Could not cancel order.');
    } finally {
      setActionLoading(false);
    }
  };

  // Quote Rejection / Decline
  const handleDeclineQuote = async () => {
    setActionLoading(true);
    try {
      await api.declineQuote(order.id, {
        quoteId: latestQuote?.id,
        reason: declineReason.trim() || 'Declined by customer',
      });
      toast.success('Quote declined. The order has been cancelled.');
      setDeclineQuoteModalOpen(false);
      await Promise.all([refreshUser(), fetchOrder()]);
    } catch (err) {
      toast.error(err.message || 'Failed to decline quote.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '880px', margin: '0 auto' }}>
        <div className="skeleton" style={{ height: '36px', width: '160px' }} />
        <div className="skeleton" style={{ height: '220px', borderRadius: 'var(--radius-lg)' }} />
        <div className="skeleton" style={{ height: '260px', borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="impex-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', maxWidth: '520px', margin: '2rem auto' }}>
        <AlertCircle size={48} style={{ color: 'var(--danger)', margin: '0 auto 1rem' }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Order Not Found
        </h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          {error || 'The requested order does not exist or you do not have permission to view it.'}
        </p>
        <button onClick={() => navigate('/orders')} className="btn btn-primary">
          Back to My Orders
        </button>
      </div>
    );
  }

  // Milestones Timeline definition
  const timelineMilestones = [
    { key: 'SUBMITTED', label: t('orderDetail.timelineSteps.submitted') },
    { key: 'UNDER_REVIEW', label: t('orderDetail.timelineSteps.underReview') },
    { key: 'QUOTE_READY', label: t('orderDetail.timelineSteps.quoteIssued') },
    { key: 'FUNDS_RESERVED', label: t('orderDetail.timelineSteps.fundsReserved') },
    { key: 'PURCHASE_COMPLETED', label: t('orderDetail.timelineSteps.purchased') },
    { key: 'INTERNATIONAL_TRANSIT', label: t('orderDetail.timelineSteps.inTransitHaiti') },
    { key: 'ARRIVED_AT_IMPEX', label: t('orderDetail.timelineSteps.arrivedDepot') },
    { key: 'DELIVERED', label: t('orderDetail.timelineSteps.delivered') },
  ];

  const getMilestoneIndex = (status) => {
    switch (status) {
      case 'SUBMITTED':
      case 'ORDER_CREATED':
      case 'CREATED':
        return 0;
      case 'UNDER_REVIEW':
        return 1;
      case 'QUOTE_READY':
      case 'AWAITING_CUSTOMER_CONFIRMATION':
      case 'PRICE_CHANGED':
        return 2;
      case 'FUNDS_RESERVED':
      case 'PURCHASE_PROCESSING':
      case 'PURCHASE_STARTED':
      case 'PAYMENT_CONFIRMED':
        return 3;
      case 'PURCHASE_COMPLETED':
      case 'MERCHANT_SHIPPED':
        return 4;
      case 'INTERNATIONAL_TRANSIT':
      case 'IN_TRANSIT':
        return 5;
      case 'ARRIVED_AT_IMPEX':
      case 'ARRIVED_IN_HAITI':
      case 'READY_FOR_PICKUP':
      case 'AVAILABLE_FOR_PICKUP':
        return 6;
      case 'DELIVERED':
        return 7;
      default:
        return 1;
    }
  };

  const currentMilestoneIndex = getMilestoneIndex(order.status);
  const isCancelled = order.status === 'CANCELLED' || order.status === 'REFUNDED';
  const isQuoteReady = ['QUOTE_READY', 'AWAITING_CUSTOMER_CONFIRMATION'].includes(order.status);
  const isPriceChanged = order.status === 'PRICE_CHANGED';
  const isArrived = ['ARRIVED_AT_IMPEX', 'READY_FOR_PICKUP', 'ARRIVED_IN_HAITI', 'AVAILABLE_FOR_PICKUP'].includes(order.status);
  const canCancel = ['SUBMITTED', 'UNDER_REVIEW', 'QUOTE_READY', 'AWAITING_CUSTOMER_CONFIRMATION', 'FUNDS_RESERVED'].includes(order.status);

  const pickupCode = order.pickup_code || `IX-${String(order.id).slice(-4).toUpperCase()}`;

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Top Navigation & Cancel Order action */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <button
          onClick={() => navigate('/orders')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} />
          <span>{t('orderDetail.backBtn')}</span>
        </button>

        {canCancel && (
          <button
            onClick={handleCancelOrder}
            disabled={actionLoading}
            className="btn btn-secondary btn-sm"
            style={{ color: 'var(--danger-text)', borderColor: 'var(--danger-border)' }}
          >
            <XCircle size={14} />
            <span>{t('common.cancel')}</span>
          </button>
        )}
      </div>

      {/* PRICE CHANGED BANNER */}
      {isPriceChanged && (
        <div
          className="impex-card"
          style={{
            backgroundColor: '#fffbeb',
            border: '2px solid #f59e0b',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={24} style={{ color: '#d97706', flexShrink: 0 }} />
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#92400e' }}>
                Price Updated by Merchant
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#b45309' }}>
                The merchant price has changed since your previous quote was created. Please review and confirm the updated price before IMPEX completes your purchase.
              </p>
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#ffffff',
              padding: '1rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #fde68a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Updated Quoted Total</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                ${Number(latestQuote?.total ?? order.quoted_total ?? 0).toFixed(2)} USD
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleCancelOrder}
                disabled={actionLoading}
                className="btn btn-secondary"
              >
                Cancel Order
              </button>
              <button
                onClick={handleConfirmPriceChange}
                disabled={actionLoading}
                className="btn btn-primary"
              >
                Accept New Price
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN ORDER HEADER CARD */}
      <div className="impex-card" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span className="badge badge-primary">
                Order #{order.order_number || String(order.id).slice(0, 8)}
              </span>
              <span className="badge badge-muted">
                {order.merchant_name || order.merchant_domain || 'Global Store'}
              </span>
            </div>

            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem', lineHeight: 1.3 }}>
              {order.product_name || 'Imported International Product'}
            </h1>

            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <span>{t('orderDetail.placedOn', { date: new Date(order.created_at || Date.now()).toLocaleDateString() })}</span>
              {order.product_url && (
                <a
                  href={order.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--primary)', fontWeight: 600 }}
                >
                  <span>Open Store Listing</span>
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('orderDetail.currentStatus')}</div>
            <div style={{ marginTop: '0.25rem' }}>
              <span className="badge badge-primary" style={{ fontSize: '0.8125rem', padding: '0.3rem 0.75rem' }}>
                {String(order.status).replace(/_/g, ' ')}
              </span>
            </div>
            {order.quoted_total > 0 && (
              <div style={{ marginTop: '0.5rem', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                ${Number(order.quoted_total).toFixed(2)} USD
              </div>
            )}
          </div>
        </div>

        {/* Milestone Progression Timeline */}
        {!isCancelled ? (
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              {t('orderDetail.timelineTitle')}
            </div>

            <div className="timeline-scroll-container">
              <div className="timeline-grid">
                {timelineMilestones.map((m, idx) => {
                  const isPassed = idx <= currentMilestoneIndex;
                  const isCurrent = idx === currentMilestoneIndex;

                  return (
                    <div key={m.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                      <div
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '50%',
                          backgroundColor: isPassed ? 'var(--primary)' : 'var(--bg-muted)',
                          color: isPassed ? '#ffffff' : 'var(--text-light)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          marginBottom: '0.4rem',
                          boxShadow: isCurrent ? '0 0 0 4px var(--primary-ring)' : 'none',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {isPassed ? <CheckCircle2 size={16} /> : idx + 1}
                      </div>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: isCurrent ? 700 : 500,
                          color: isPassed ? 'var(--text-primary)' : 'var(--text-muted)',
                          lineHeight: 1.25,
                        }}
                      >
                        {m.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'var(--danger-bg)', padding: '1rem', borderRadius: 'var(--radius-md)', color: 'var(--danger-text)' }}>
            <XCircle size={20} />
            <div>
              <div style={{ fontWeight: 700 }}>Order Cancelled / Refunded</div>
              <div style={{ fontSize: '0.8125rem' }}>All reserved funds have been returned to your spendable wallet balance.</div>
            </div>
          </div>
        )}
      </div>

      {/* DEDICATED OFFICIAL QUOTE CARD (When quote is ready or active) */}
      {(latestQuote || isQuoteReady) && (
        <div
          className="impex-card"
          style={{
            border: isQuoteReady ? '2px solid var(--primary)' : '1px solid var(--border)',
            padding: '1.75rem',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Official IMPEX Quote</h2>
                {latestQuote?.version && (
                  <span className="badge badge-muted" style={{ fontSize: '0.6875rem' }}>
                    Version {latestQuote.version}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Verified product price, international shipping, and customs clearance
              </p>
            </div>

            {countdownText && isQuoteReady && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--bg-muted)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-full)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--warning-text)' }}>
                <Clock size={14} />
                <span>Expires in: {countdownText}</span>
              </div>
            )}
          </div>

          {/* Breakdown table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('orderDetail.itemPrice')}:</span>
              <span style={{ fontWeight: 600 }}>${Number(latestQuote?.product_price ?? order.verified_product_price ?? 0).toFixed(2)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('orderDetail.internationalFreight')}:</span>
              <span style={{ fontWeight: 600 }}>${Number(latestQuote?.shipping_cost ?? order.international_shipping_fee ?? 0).toFixed(2)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('orderDetail.serviceAndCustoms')}:</span>
              <span style={{ fontWeight: 600 }}>${Number(latestQuote?.service_fee ?? order.service_fee ?? 0).toFixed(2)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Estimated Merchant Taxes / Fees:</span>
              <span style={{ fontWeight: 600 }}>${Number(latestQuote?.tax ?? 0).toFixed(2)}</span>
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '0.25rem 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{t('orderDetail.totalQuoted')}:</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--primary)' }}>
                  ${Number(latestQuote?.total ?? order.quoted_total ?? 0).toFixed(2)} USD
                </span>
                {latestQuote?.total_htg && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    ≈ {Number(latestQuote.total_htg).toLocaleString('en-US', { maximumFractionDigits: 0 })} HTG
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quote Confirmation Actions */}
          {isQuoteReady && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-light)' }}>
              {!hasSufficientFunds ? (
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--danger-text)', fontSize: '0.875rem' }}>
                      Insufficient Wallet Balance
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#991b1b', marginTop: '0.2rem' }}>
                      Current balance: ${spendable.toFixed(2)} • Required: ${quoteTotal.toFixed(2)} • Shortfall: <strong>${shortfall.toFixed(2)}</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => setTopUpModalOpen(true)}
                    className="btn btn-primary btn-sm"
                    style={{ gap: '0.4rem' }}
                  >
                    <Plus size={14} />
                    <span>Top Up Wallet</span>
                  </button>
                </div>
              ) : null}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  onClick={() => setDeclineQuoteModalOpen(true)}
                  disabled={actionLoading}
                  className="btn btn-secondary"
                >
                  {t('orderDetail.declineQuoteBtn')}
                </button>
                <button
                  onClick={() => setConfirmQuoteModalOpen(true)}
                  disabled={actionLoading}
                  className="btn btn-primary"
                  style={{ gap: '0.5rem' }}
                >
                  <CheckCircle2 size={16} />
                  <span>{t('orderDetail.acceptQuoteBtn')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PACKAGE ARRIVED AT IMPEX (COUNTER PICKUP & HOME DELIVERY) */}
      {isArrived && (
        <div
          className="impex-card"
          style={{
            border: '2px solid var(--success)',
            padding: '1.75rem',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div style={{ maxWidth: '480px' }}>
              <span className="badge badge-success" style={{ marginBottom: '0.5rem' }}>
                Arrived at IMPEX
              </span>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.4rem' }}>
                Your package is ready!
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Your package has safely arrived at our IMPEX facility. Collect it at our counter using your pickup code or request doorstep delivery.
              </p>
            </div>

            {/* Counter Pickup Code Display */}
            <div
              style={{
                backgroundColor: 'var(--bg-muted)',
                padding: '1.25rem 1.75rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                textAlign: 'center',
                minWidth: '220px',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {t('orderDetail.secretCodeTitle')}
              </div>
              <div style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.08em', margin: '0.35rem 0' }}>
                {pickupCode}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-light)' }}>
                {t('orderDetail.secretCodeDesc')}
              </div>
            </div>

            <div>
              {(() => {
                const isDeliveryRequested = ['REQUESTED', 'OUT_FOR_DELIVERY', 'IN_TRANSIT_LOCAL', 'DELIVERED'].includes(order.delivery_status) || order.delivery_requested === true;

                if (isDeliveryRequested) {
                  return (
                    <button
                      disabled={true}
                      className="btn btn-secondary btn-lg"
                      style={{ gap: '0.5rem', opacity: 0.8, cursor: 'not-allowed' }}
                    >
                      <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                      <span>✓ Home Delivery Requested</span>
                    </button>
                  );
                }

                return (
                  <button
                    onClick={() => setHomeDeliveryModalOpen(true)}
                    className="btn btn-primary btn-lg"
                    style={{ gap: '0.5rem' }}
                  >
                    <Truck size={18} />
                    <span>Request Home Delivery</span>
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* SPECIFICATIONS & FINANCIAL ESCROW BREAKDOWN GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.5rem' }}>
        {/* Specifications & Notes */}
        <div className="impex-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <FileText size={18} style={{ color: 'var(--primary)' }} />
            <span>Product Specifications</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Quantity:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{order.quantity || 1}</strong>
            </div>

            {order.size && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Size:</span>
                <span>{order.size}</span>
              </div>
            )}

            {order.color && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Color:</span>
                <span>{order.color}</span>
              </div>
            )}

            {order.variant && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Model / Variant:</span>
                <span>{order.variant}</span>
              </div>
            )}

            {order.customer_notes && (
              <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700 }}>
                  Customer Notes:
                </span>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  {order.customer_notes}
                </p>
              </div>
            )}

            {(() => {
              const ids = order.screenshot_attachment_ids?.length > 0
                ? order.screenshot_attachment_ids
                : order.product_specifications?.screenshot_attachment_ids?.length > 0
                ? order.product_specifications.screenshot_attachment_ids
                : order.screenshot_attachment_id
                ? [order.screenshot_attachment_id]
                : [];
              const urls = ids.map((id) => api.getScreenshotUrl(id));
              if (urls.length === 0 && (order.screenshot_url || order.product_image_url)) {
                urls.push(order.screenshot_url || order.product_image_url);
              }
              if (urls.length === 0) return null;

              return (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
                    Reference Screenshots ({urls.length}):
                  </span>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {urls.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'block',
                          position: 'relative',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          border: '1px solid var(--border)',
                          backgroundColor: '#f8fafc',
                        }}
                        title={`Open Reference Image #${idx + 1}`}
                      >
                        <img
                          src={url}
                          alt={`Reference Screenshot ${idx + 1}`}
                          style={{
                            height: '110px',
                            width: '130px',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            bottom: '4px',
                            right: '4px',
                            backgroundColor: 'rgba(15, 23, 42, 0.75)',
                            color: '#ffffff',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '2px 5px',
                            borderRadius: '4px',
                          }}
                        >
                          #{idx + 1}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Wallet & Escrow Ledger Info */}
        <div className="impex-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Wallet size={18} style={{ color: 'var(--primary)' }} />
            <span>Wallet Escrow & Payment</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Payment Status:</span>
              <span className="badge badge-muted">
                {String(order.payment_status || 'PENDING').replace(/_/g, ' ')}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Funds Reserved in Escrow:</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                ${Number(order.quoted_total || 0).toFixed(2)} USD
              </strong>
            </div>

            {order.actual_purchase_total > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Actual Merchant Purchase Total:</span>
                <strong style={{ color: 'var(--success)' }}>
                  ${Number(order.actual_purchase_total).toFixed(2)} USD
                </strong>
              </div>
            )}

            {order.merchant_tracking_number && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Merchant Tracking:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
                  {order.merchant_tracking_number}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* IMMUTABLE AUDIT TRAIL / EVENTS TIMELINE */}
      {order.events && order.events.length > 0 && (
        <div className="impex-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={18} style={{ color: 'var(--primary)' }} />
            <span>Audit History & Status Updates</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {order.events.map((ev, idx) => (
              <div key={ev.id || idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: '0.8125rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)', marginTop: '5px', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {String(ev.event_type || 'STATUS_UPDATE').replace(/_/g, ' ')}
                    </strong>
                    <span style={{ color: 'var(--text-light)', fontSize: '0.75rem' }}>
                      {new Date(ev.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(ev.created_at || Date.now()).toLocaleDateString()}
                    </span>
                  </div>
                  {ev.new_status && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                      Status changed to: <strong>{String(ev.new_status).replace(/_/g, ' ')}</strong>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONFIRM QUOTE MODAL */}
      {confirmQuoteModalOpen && (
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
          <div
            onClick={() => setConfirmQuoteModalOpen(false)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(3px)' }}
          />

          <div
            className="impex-card"
            style={{
              position: 'relative',
              zIndex: 101,
              width: '100%',
              maxWidth: '460px',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Confirm Quote & Reserve Funds
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Are you sure you want to reserve <strong>${quoteTotal.toFixed(2)} USD</strong> from your IMPEX wallet?
            </p>

            <div
              style={{
                backgroundColor: 'var(--bg-muted)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.5rem',
                fontSize: '0.8125rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Spendable Balance:</span>
                <span>${spendable.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Amount to Reserve:</span>
                <strong>${quoteTotal.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Remaining Balance:</span>
                <strong style={{ color: 'var(--success)' }}>${(spendable - quoteTotal).toFixed(2)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setConfirmQuoteModalOpen(false)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmQuote}
                disabled={actionLoading}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                {actionLoading ? <span className="spinner" /> : 'Yes, Reserve Funds'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Quote Modal */}
      {declineQuoteModalOpen && (
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
          <div
            onClick={() => setDeclineQuoteModalOpen(false)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)' }}
          />

          <div
            className="impex-card"
            style={{
              position: 'relative',
              zIndex: 101,
              width: '100%',
              maxWidth: '460px',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--danger-text)' }}>
              Decline Price Quote
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Declining this quote will cancel the order request. Any reserved balance remains untouched in your spendable wallet.
            </p>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                Reason for declining (Optional)
              </label>
              <textarea
                className="input"
                rows={3}
                placeholder="E.g., Price is higher than expected, delivery time is too long, or no longer needed..."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setDeclineQuoteModalOpen(false)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Keep Reviewing
              </button>
              <button
                onClick={handleDeclineQuote}
                disabled={actionLoading}
                className="btn btn-danger"
                style={{ flex: 1 }}
              >
                {actionLoading ? <span className="spinner" /> : 'Decline & Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <HomeDeliveryModal
        isOpen={homeDeliveryModalOpen}
        onClose={() => setHomeDeliveryModalOpen(false)}
        order={order}
        onSuccess={() => fetchOrder()}
      />

      <TopUpModal
        isOpen={topUpModalOpen}
        onClose={() => setTopUpModalOpen(false)}
      />
    </div>
  );
}
