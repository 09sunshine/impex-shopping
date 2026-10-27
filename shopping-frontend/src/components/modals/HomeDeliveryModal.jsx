import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../context/LanguageContext';
import api from '../../api/client';
import { X, Truck, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';

export default function HomeDeliveryModal({ isOpen, onClose, order, onSuccess }) {
  const { wallet, refreshUser } = useAuth();
  const toast = useToast();
  const { t } = useTranslation();
  const [commune, setCommune] = useState('Pétion-Ville');
  const [customCommune, setCustomCommune] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !order) return null;

  const isOther = commune === 'Other Commune (Outside Listed Areas)';

  // Authoritative estimated delivery fee
  const deliveryFee = ['Port-au-Prince', 'Delmas', 'Pétion-Ville', 'Petion-Ville', 'Tabarre'].includes(commune) ? 5.00 : 8.50;
  const spendable = wallet?.spendable_balance ?? wallet?.balance ?? 0;
  const hasEnoughFunds = spendable >= deliveryFee;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isOther && !customCommune.trim()) {
      toast.error('Please specify your commune / province name.');
      return;
    }
    if (!addressLine.trim()) {
      toast.error(t('homeDeliveryModal.errorAddress'));
      return;
    }
    if (!hasEnoughFunds) {
      toast.error(t('homeDeliveryModal.errorFunds'));
      return;
    }

    const selectedCommuneName = isOther ? customCommune.trim() : commune;

    setSubmitting(true);
    try {
      const fullNotes = `Destination: ${selectedCommuneName}, ${addressLine.trim()}. Phone: ${phone}. Notes: ${deliveryNotes}`;
      await api.requestHomeDelivery(order.id, {
        notes: fullNotes,
        commune: selectedCommuneName,
      });
      await refreshUser();
      toast.success(t('homeDeliveryModal.successMsg'));
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message || t('homeDeliveryModal.errorFailed'));
    } finally {
      setSubmitting(false);
    }
  };

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
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(3px)',
        }}
      />

      <div
        className="modal-responsive-card"
        style={{ maxWidth: '520px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{t('homeDeliveryModal.title')}</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {t('homeDeliveryModal.subtitle', { orderNumber: order.order_number || order.id })}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              {t('homeDeliveryModal.communeLabel')}
            </label>
            <select
              value={commune}
              onChange={(e) => setCommune(e.target.value)}
              className="input-field"
            >
              <option value="Pétion-Ville">Pétion-Ville</option>
              <option value="Delmas">Delmas</option>
              <option value="Port-au-Prince">Port-au-Prince</option>
              <option value="Tabarre">Tabarre</option>
              <option value="Carrefour">Carrefour</option>
              <option value="Croix-des-Bouquets">Croix-des-Bouquets</option>
              <option value="Kenscoff">Kenscoff</option>
              <option value="Cap-Haïtien">Cap-Haïtien</option>
              <option value="Other Commune (Outside Listed Areas)">Other Commune (Outside Listed Areas)</option>
            </select>
          </div>

          {isOther && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Commune / Province Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Jacmel, Les Cayes, Saint-Marc, Gonaïves..."
                value={customCommune}
                onChange={(e) => setCustomCommune(e.target.value)}
                className="input-field"
                required
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              {t('homeDeliveryModal.streetLabel')}
            </label>
            <input
              type="text"
              placeholder={t('homeDeliveryModal.streetPlaceholder')}
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              className="input-field"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              {t('homeDeliveryModal.phoneLabel')}
            </label>
            <input
              type="tel"
              placeholder={t('homeDeliveryModal.phonePlaceholder')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              {t('homeDeliveryModal.instructionsLabel')}
            </label>
            <textarea
              rows={2}
              placeholder={t('homeDeliveryModal.instructionsPlaceholder')}
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              className="input-field"
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Pricing & Wallet Summary */}
          <div
            style={{
              backgroundColor: 'var(--bg-muted)',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{t('homeDeliveryModal.feeLabel')}</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>${deliveryFee.toFixed(2)} USD</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{t('homeDeliveryModal.balanceLabel')}</span>
              <span style={{ fontWeight: 600, color: hasEnoughFunds ? 'var(--success)' : 'var(--danger)' }}>
                ${Number(spendable).toFixed(2)} USD
              </span>
            </div>

            {!hasEnoughFunds && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                <AlertCircle size={14} />
                <span>{t('homeDeliveryModal.insufficientFunds')}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
              {t('homeDeliveryModal.cancelBtn')}
            </button>
            <button
              type="submit"
              disabled={submitting || !hasEnoughFunds}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              {submitting ? <span className="spinner" /> : t('homeDeliveryModal.confirmBtn', { amount: deliveryFee.toFixed(2) })}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
