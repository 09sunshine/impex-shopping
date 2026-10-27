import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../context/LanguageContext';
import api from '../../api/client';
import {
  QrCode,
  CheckCircle2,
  AlertCircle,
  Package,
  User,
  ShieldCheck,
  Search,
} from 'lucide-react';

export default function AdminPickupCounterPage() {
  const { isAdmin, isAuthenticated } = useAuth();
  const toast = useToast();
  const { t } = useTranslation();

  const [pickupCode, setPickupCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifiedOrder, setVerifiedOrder] = useState(null);
  const [delivering, setDelivering] = useState(false);

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="impex-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
        <h3>{t('admin.accessRestrictedTitle')}</h3>
      </div>
    );
  }

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!pickupCode.trim()) return;

    setVerifying(true);
    setVerifiedOrder(null);
    try {
      const res = await api.verifyPickupCode(pickupCode.trim().toUpperCase());
      setVerifiedOrder(res?.order || res);
      toast.success(t('admin.pickupForm.releaseSuccess'));
    } catch (err) {
      toast.error(err.message || 'Invalid or expired pickup code.');
    } finally {
      setVerifying(false);
    }
  };

  const handleConfirmHandover = async () => {
    if (!verifiedOrder) return;
    setDelivering(true);
    try {
      await api.updateAdminOrderStatus(verifiedOrder.id, {
        status: 'DELIVERED',
        notes: `Handed over at counter with verified pickup code ${pickupCode}`,
      });
      toast.success(`Order #${verifiedOrder.order_number || verifiedOrder.id} marked as DELIVERED!`);
      setVerifiedOrder(null);
      setPickupCode('');
    } catch (err) {
      toast.error(err.message || 'Failed to complete package handover.');
    } finally {
      setDelivering(false);
    }
  };

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{t('admin.pickupForm.title')}</h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {t('help.pickupLocation')}
        </p>
      </div>

      {/* Code Input Form */}
      <div className="impex-card">
        <form onSubmit={handleLookup} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <QrCode size={20} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder={t('admin.pickupForm.enterSecretCodeLabel')}
              value={pickupCode}
              onChange={(e) => setPickupCode(e.target.value.toUpperCase())}
              className="input-field"
              style={{ paddingLeft: '2.5rem', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.05em' }}
              required
            />
          </div>
          <button type="submit" disabled={verifying} className="btn btn-primary" style={{ minWidth: '120px', flex: '1 1 auto' }}>
            {verifying ? <span className="spinner" /> : t('admin.pickupForm.verifyPickupBtn')}
          </button>
        </form>
      </div>

      {/* Verified Order Inspection Card */}
      {verifiedOrder && (
        <div className="impex-card" style={{ border: '2px solid var(--success)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={22} style={{ color: 'var(--success)' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                Order #{verifiedOrder.order_number || verifiedOrder.id}
              </h3>
            </div>
            <span className="badge badge-success">
              {t('common.active')}
            </span>
          </div>

          <div
            style={{
              backgroundColor: 'var(--bg-muted)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              fontSize: '0.875rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('orderDetail.recipientName')}:</span>
              <strong>{verifiedOrder.customer_name || `Customer #${verifiedOrder.user_id}`}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('orderDetail.trackingTitle')}:</span>
              <span style={{ fontFamily: 'monospace' }}>{verifiedOrder.tracking_number || 'N/A'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('common.total')}:</span>
              <strong>${Number(verifiedOrder.total_amount || 0).toFixed(2)} USD ({t('common.completed')})</strong>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              {t('orderForm.productNameLabel')}:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {(verifiedOrder.items || []).map((it, idx) => (
                <div key={idx} style={{ fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{it.title}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{t('common.quantity')}: {it.quantity}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)' }}>
            <button
              onClick={handleConfirmHandover}
              disabled={delivering}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', gap: '0.5rem' }}
            >
              {delivering ? <span className="spinner" /> : (
                <>
                  <CheckCircle2 size={18} />
                  <span>{t('admin.pickupForm.verifyPickupBtn')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
