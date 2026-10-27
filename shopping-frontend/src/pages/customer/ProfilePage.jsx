import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../context/LanguageContext';
import api from '../../api/client';
import AddressModal from '../../components/modals/AddressModal';
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  MapPin,
  Lock,
  LogOut,
  Copy,
  CheckCircle2,
  Plus,
  Home,
  Briefcase,
  Building,
  Edit2,
  Trash2,
  Star,
} from 'lucide-react';

export default function ProfilePage() {
  const { user, isAuthenticated, logout, login, register, refreshUser } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const { t } = useTranslation();

  const [addresses, setAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAddresses = async () => {
    if (!isAuthenticated) return;
    setLoadingAddresses(true);
    try {
      const list = await api.getAddresses();
      setAddresses(list || []);
    } catch (err) {
      console.warn('Failed to fetch addresses:', err);
    } finally {
      setLoadingAddresses(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, [isAuthenticated]);

  const handleSetDefault = async (addrId) => {
    try {
      await api.setDefaultAddress(addrId);
      toast.success('Default delivery address updated!');
      await fetchAddresses();
      await refreshUser();
    } catch (err) {
      toast.error(err.message || 'Failed to update default address.');
    }
  };

  const handleDeleteAddress = async (addrId) => {
    if (!window.confirm('Are you sure you want to delete this saved address?')) return;
    try {
      await api.deleteAddress(addrId);
      toast.success('Address removed.');
      await fetchAddresses();
      await refreshUser();
    } catch (err) {
      toast.error(err.message || 'Failed to delete address.');
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isRegisterMode) {
        await register({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          phone: userPhone,
        });
      } else {
        await login(email, password);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: '480px', margin: '2rem auto' }}>
        <div className="impex-card" style={{ padding: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.75rem',
                fontWeight: 800,
                fontSize: '1.25rem',
              }}
            >
              IX
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
              {isRegisterMode ? t('auth.createAccount', 'Create an IMPEX Account') : t('auth.signIn', 'Sign in to IMPEX Shopping')}
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {t('auth.existingAccountDesc', 'Use your existing IMPEX account to access your wallet and international orders')}
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {isRegisterMode && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      {t('profile.firstNameLabel', 'First Name')}
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      {t('profile.lastNameLabel', 'Last Name')}
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    {t('profile.phoneLabel', 'Phone Number')}
                  </label>
                  <input
                    type="tel"
                    placeholder="+509 3700-0000"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    className="input-field"
                  />
                </div>
              </>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                {t('profile.emailLabel', 'Email Address')}
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                {t('auth.password', 'Password')}
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}
            >
              {submitting ? t('common.loading') : isRegisterMode ? t('auth.createAccountBtn', 'Create Account') : t('auth.signInBtn', 'Sign In')}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
            <button
              type="button"
              onClick={() => setIsRegisterMode(!isRegisterMode)}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
            >
              {isRegisterMode ? t('auth.alreadyHaveAccount', 'Already have an account? Sign In') : t('auth.dontHaveAccount', "Don't have an account? Create one")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getTagIcon = (lbl) => {
    switch ((lbl || '').toLowerCase()) {
      case 'work':
        return <Briefcase size={13} />;
      case 'office':
        return <Building size={13} />;
      default:
        return <Home size={13} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1080px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{t('profile.title')}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {t('profile.subtitle')}
          </p>
        </div>

        <button
          onClick={logout}
          className="btn btn-secondary btn-sm"
          style={{ gap: '0.4rem', color: 'var(--danger)' }}
        >
          <LogOut size={14} />
          <span>{t('nav.logout')}</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        {/* Personal Details Card */}
        <div className="impex-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.25rem',
                border: '2px solid #c7d2fe',
              }}
            >
              {(user?.first_name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.name || 'Customer'}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {user?.email}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Account ID:</span>
              <strong style={{ fontFamily: 'monospace' }}>#{user?.id ? user.id.slice(0, 8) : '—'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Role:</span>
              <span className="badge badge-primary">{user?.role || 'Customer'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Contact Phone:</span>
              <span style={{ fontWeight: 600 }}>{user?.phone || user?.customer?.phone || 'Not configured'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Account Status:</span>
              <span className="badge badge-success">
                <CheckCircle2 size={12} />
                <span>Active & Verified</span>
              </span>
            </div>
          </div>
        </div>

        {/* Saved Addresses / Address Book */}
        <div className="impex-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MapPin size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{t('profile.addressesTitle')}</h3>
            </div>
            <button
              onClick={() => {
                setEditingAddress(null);
                setAddressModalOpen(true);
              }}
              className="btn btn-primary btn-sm"
              style={{ gap: '0.35rem' }}
            >
              <Plus size={14} />
              <span>{t('profile.addNewAddressBtn')}</span>
            </button>
          </div>

          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {t('profile.addressesSubtitle')}
          </p>

          {loadingAddresses ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {t('common.loading')}
            </div>
          ) : addresses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', border: '1.5px dashed var(--border)', borderRadius: '12px' }}>
              <MapPin size={32} style={{ color: 'var(--text-light)', margin: '0 auto 0.75rem' }} />
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.3rem' }}>{t('profile.noSavedAddresses')}</h4>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                {t('profile.addressesSubtitle')}
              </p>
              <button
                onClick={() => {
                  setEditingAddress(null);
                  setAddressModalOpen(true);
                }}
                className="btn btn-secondary btn-sm"
                style={{ gap: '0.35rem' }}
              >
                <Plus size={14} />
                <span>{t('profile.addNewAddressBtn')}</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  style={{
                    padding: '1rem',
                    borderRadius: '10px',
                    border: `1.5px solid ${addr.is_primary ? 'var(--primary)' : 'var(--border)'}`,
                    backgroundColor: addr.is_primary ? 'rgba(99, 102, 241, 0.03)' : '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: 'var(--bg-muted)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {getTagIcon(addr.label)}
                        <span>{addr.label || 'Home'}</span>
                      </span>

                      {addr.is_primary && (
                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                          {t('profile.defaultBadge', 'Default')}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      {!addr.is_primary && (
                        <button
                          onClick={() => handleSetDefault(addr.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem', gap: '0.2rem' }}
                          title={t('profile.setDefaultBtn', 'Set as Default')}
                        >
                          <Star size={11} />
                          <span>{t('profile.setDefaultBtn', 'Set as Default')}</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingAddress(addr);
                          setAddressModalOpen(true);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                        title="Edit Address"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteAddress(addr.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                        title="Delete Address"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    <strong>{addr.recipient_name || user?.name}</strong>
                    {addr.phone && <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>• {addr.phone}</span>}
                  </div>

                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    {addr.street || addr.address_line}, {addr.city}, {addr.state} ({addr.country || 'Haiti'})
                  </div>

                  {addr.notes && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Landmark: {addr.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Address Create / Edit Modal */}
      <AddressModal
        isOpen={addressModalOpen}
        initialData={editingAddress}
        onClose={() => {
          setAddressModalOpen(false);
          setEditingAddress(null);
        }}
        onSuccess={() => {
          fetchAddresses();
          refreshUser();
        }}
      />
    </div>
  );
}
