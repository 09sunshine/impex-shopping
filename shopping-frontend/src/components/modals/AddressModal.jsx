import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../context/LanguageContext';
import api from '../../api/client';
import {
  X,
  MapPin,
  Home,
  Briefcase,
  Building,
  User,
  Phone,
  Check,
  Tag,
  Plus,
} from 'lucide-react';

const TAG_PRESETS = [
  { id: 'Home', label: 'Home', icon: Home, color: '#3b82f6' },
  { id: 'Work', label: 'Work', icon: Briefcase, color: '#8b5cf6' },
  { id: 'Office', label: 'Office', icon: Building, color: '#0ea5e9' },
  { id: 'Agency', label: 'Pickup Agency', icon: MapPin, color: '#10b981' },
];

export default function AddressModal({
  isOpen,
  onClose,
  onSuccess,
  onAddressSaved,
  initialData = null,
  initialAddress = null,
}) {
  const effectiveInitialData = initialData || initialAddress;
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useTranslation();

  const [label, setLabel] = useState('Home');
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('Port-au-Prince');
  const [state, setState] = useState('Ouest');
  const [country, setCountry] = useState('Haiti');
  const [postalCode, setPostalCode] = useState('HT6110');
  const [notes, setNotes] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (effectiveInitialData) {
      setLabel(effectiveInitialData.label || 'Home');
      setRecipientName(effectiveInitialData.recipient_name || '');
      setPhone(effectiveInitialData.phone || '');
      setStreet(effectiveInitialData.street || effectiveInitialData.address_line || effectiveInitialData.house || '');
      setCity(effectiveInitialData.city || 'Port-au-Prince');
      setState(effectiveInitialData.state || 'Ouest');
      setCountry(effectiveInitialData.country || 'Haiti');
      setPostalCode(effectiveInitialData.postal_code || 'HT6110');
      setNotes(effectiveInitialData.notes || '');
      setIsPrimary(!!effectiveInitialData.is_primary);
    } else {
      setLabel('Home');
      setRecipientName(user?.name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || '');
      setPhone(user?.phone || user?.customer?.phone || '');
      setStreet('');
      setCity('Port-au-Prince');
      setState('Ouest');
      setCountry('Haiti');
      setPostalCode('HT6110');
      setNotes('');
      setIsPrimary(false);
    }
  }, [effectiveInitialData, user, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!street.trim()) {
      toast.error('Please enter a street or building address.');
      return;
    }
    if (!recipientName.trim()) {
      toast.error('Please enter the recipient full name.');
      return;
    }
    if (!phone.trim()) {
      toast.error('Please enter a contact phone number for delivery.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        label: label.trim() || 'Home',
        recipient_name: recipientName.trim(),
        phone: phone.trim(),
        street: street.trim(),
        house: street.trim(),
        city: city.trim(),
        state: state.trim(),
        country: country.trim(),
        postal_code: postalCode.trim() || 'HT6110',
        managed_state_code: state.slice(0, 2).toUpperCase(),
        notes: notes.trim() || null,
        is_primary: isPrimary,
      };

      let result;
      if (effectiveInitialData?.id) {
        result = await api.updateAddress(effectiveInitialData.id, payload);
        toast.success('Address updated successfully!');
      } else {
        result = await api.createAddress(payload);
        toast.success('Address saved to your address book!');
      }

      if (onSuccess) onSuccess(result);
      if (onAddressSaved) onAddressSaved(result);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to save address.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
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
          maxWidth: '560px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-xl)',
          padding: '1.75rem',
          position: 'relative',
          zIndex: 111,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MapPin size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                {initialData?.id ? t('addressModal.titleEdit') : t('addressModal.titleAdd')}
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {t('profile.addressesSubtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-light)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {/* Address Tag Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              {t('addressModal.labelType')}
            </label>
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              {TAG_PRESETS.map((preset) => {
                const Icon = preset.icon;
                const isSelected = label.toLowerCase() === preset.id.toLowerCase();
                const translatedLabel = t(`addressModal.label${preset.id}`, preset.label);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setLabel(preset.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.75rem',
                      borderRadius: 'var(--radius-full)',
                      border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                      backgroundColor: isSelected ? 'var(--primary-light)' : '#ffffff',
                      color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon size={13} />
                    <span>{translatedLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recipient Full Name & Phone Number */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                {t('addressModal.recipientLabel')} <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  placeholder={t('addressModal.recipientPlaceholder', 'e.g. Jean Pierre')}
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
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

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                {t('addressModal.phoneLabel')} <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="tel"
                  required
                  placeholder="+509 3700-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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
          </div>

          {/* Street Address */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              {t('addressModal.streetLabel')} <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder={t('addressModal.streetPlaceholder')}
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontSize: '0.875rem',
              }}
            />
          </div>

          {/* City / Commune & State / Department */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                {t('addressModal.cityLabel')}
              </label>
              <input
                type="text"
                required
                placeholder="Port-au-Prince"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                {t('addressModal.stateLabel')}
              </label>
              <input
                type="text"
                required
                placeholder="Ouest"
                value={state}
                onChange={(e) => setState(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                {t('common.country', 'Country')}
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '0.875rem',
                  backgroundColor: '#ffffff',
                }}
              >
                <option value="Haiti">Haiti (Haïti)</option>
                <option value="United States">United States</option>
                <option value="Dominican Republic">Dominican Republic</option>
                <option value="Canada">Canada</option>
              </select>
            </div>
          </div>

          {/* Delivery Notes / Landmarks */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              {t('addressModal.notesLabel')}
            </label>
            <input
              type="text"
              placeholder={t('addressModal.notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontSize: '0.875rem',
              }}
            />
          </div>

          {/* Default Address Checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
            />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {t('addressModal.defaultCheckbox')}
            </span>
          </label>

          {/* Submit Button */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '0.75rem' }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ flex: 1, padding: '0.75rem', fontWeight: 700 }}
            >
              {submitting ? t('addressModal.savingBtn') : t('addressModal.saveBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
