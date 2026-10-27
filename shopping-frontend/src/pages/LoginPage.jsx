import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { useTranslation } from '../context/LanguageContext';
import LanguageToggle from '../components/common/LanguageToggle';
import {
  ShieldCheck,
  Mail,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  Sparkles,
  Wallet,
  Truck,
  AlertCircle
} from 'lucide-react';

export default function LoginPage() {
  const { login, register, verifyOtp, resendOtp, isAuthenticated } = useAuth();
  const { navigate } = useRouter();
  const { t } = useTranslation();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpPurpose, setOtpPurpose] = useState('LOGIN'); // 'LOGIN' | 'REGISTER'
  const [resendCooldown, setResendCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Auto redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!firstName.trim() || !lastName.trim()) {
          throw new Error('Please enter both your first and last name.');
        }
        const res = await register({
          email: email.trim(),
          password,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim() || undefined,
        });
        if (res && res.status === 'OTP_REQUIRED') {
          setOtpPurpose('REGISTER');
          setStep('otp');
          setResendCooldown(60);
          return;
        }
      } else {
        const res = await login(email.trim(), password);
        if (res && res.status === 'OTP_REQUIRED') {
          setOtpPurpose('LOGIN');
          setStep('otp');
          setResendCooldown(60);
          return;
        }
      }
      navigate('/');
    } catch (err) {
      setErrorMessage(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e, directCode) => {
    if (e) e.preventDefault();
    const codeToVerify = (directCode || otp || '').trim();
    if (!codeToVerify || codeToVerify.length < 6) {
      setErrorMessage('Please enter the full 6-digit verification code.');
      return;
    }
    setErrorMessage('');
    setLoading(true);
    try {
      await verifyOtp(email.trim(), codeToVerify, otpPurpose);
      navigate('/');
    } catch (err) {
      setErrorMessage(err.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setErrorMessage('');
    try {
      await resendOtp(email.trim(), otpPurpose);
      setResendCooldown(60);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to resend verification code.');
    }
  };

  return (
    <div className="login-page-container">
      {/* Header bar with collapsed hover-expandable language switcher (never overlaps card) */}
      <div className="login-header-bar">
        <LanguageToggle variant="hover-expand" />
      </div>

      <div className="login-card-wrapper">
        {/* Left Side: Brand Story & Value Props */}
        <div className="login-brand-panel">
          <div>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '2rem' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: '#6366f1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '1.25rem',
                  color: '#ffffff',
                  boxShadow: '0 8px 16px rgba(99, 102, 241, 0.35)',
                  flexShrink: 0,
                }}
              >
                IX
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  IMPEX
                </div>
                <div style={{ fontSize: '0.72rem', color: '#c7d2fe', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
                  {t('nav.internationalShopping')}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  color: '#e0e7ff',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                }}
              >
                <Sparkles size={13} style={{ color: '#fbbf24' }} />
                <span>{t('auth.badgeWorldwide')}</span>
              </span>

              <h1 style={{ fontSize: '1.875rem', fontWeight: 800, lineHeight: 1.25, letterSpacing: '-0.02em', marginBottom: '0.875rem', color: '#ffffff' }}>
                {t('auth.gatewayTitle')}
              </h1>

              <p style={{ color: '#c7d2fe', fontSize: '0.9rem', lineHeight: 1.55 }}>
                {t('auth.gatewayDesc')}
              </p>
            </div>

            {/* Feature Badges - hidden on compact screens via .login-brand-features */}
            <div className="login-brand-features" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#a5b4fc',
                    flexShrink: 0,
                  }}
                >
                  <Wallet size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Wallet Escrow Protection</div>
                  <div style={{ fontSize: '0.75rem', color: '#c7d2fe' }}>Funds only released when items are procured</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#a5b4fc',
                    flexShrink: 0,
                  }}
                >
                  <Truck size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Miami Depot & Air Freight</div>
                  <div style={{ fontSize: '0.75rem', color: '#c7d2fe' }}>Direct logistics pipeline to Port-au-Prince</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#a5b4fc',
                    flexShrink: 0,
                  }}
                >
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Zero Customs Headaches</div>
                  <div style={{ fontSize: '0.75rem', color: '#c7d2fe' }}>Clearance and inspection handled end-to-end</div>
                </div>
              </div>
            </div>
          </div>


        </div>

        {/* Right Side: Authentication Form */}
        <div className="login-form-panel">
          {step === 'otp' ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Back to credentials button */}
              <button
                type="button"
                onClick={() => {
                  setStep('credentials');
                  setOtp('');
                  setErrorMessage('');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  marginBottom: '1.5rem',
                  alignSelf: 'flex-start',
                }}
              >
                <ArrowLeft size={16} />
                <span>{mode === 'register' ? 'Back to Registration' : 'Back to Sign In'}</span>
              </button>

              <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '16px',
                    backgroundColor: '#eef2ff',
                    color: '#6366f1',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)',
                  }}
                >
                  <KeyRound size={28} />
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  Verify Your Email
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: '340px', margin: '0 auto' }}>
                  Please enter the 6-digit verification code sent to <br />
                  <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
                </p>
              </div>

              {errorMessage && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    fontSize: '0.825rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label
                    htmlFor="otp-code-input"
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--text-secondary)',
                      marginBottom: '0.5rem',
                      textAlign: 'center',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    6-Digit Verification Code
                  </label>
                  <input
                    id="otp-code-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtp(val);
                      if (val.length === 6) {
                        setTimeout(() => handleVerifyOtp(null, val), 60);
                      }
                    }}
                    autoFocus
                    placeholder="••••••"
                    style={{
                      width: '100%',
                      textAlign: 'center',
                      fontSize: '1.75rem',
                      fontWeight: 800,
                      letterSpacing: '0.45em',
                      padding: '0.85rem 1rem',
                      borderRadius: '12px',
                      border: '2px solid var(--border)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
                    onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.85rem',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    borderRadius: '10px',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                    opacity: loading || otp.length < 6 ? 0.7 : 1,
                    cursor: loading || otp.length < 6 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? (
                    <>
                      <span className="spinner" style={{ width: '18px', height: '18px' }} />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify & Continue</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>

                <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <span>Didn't receive the email? </span>
                  {resendCooldown > 0 ? (
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Resend code in {resendCooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Resend code
                    </button>
                  )}
                </div>
              </form>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div
                style={{
                  display: 'flex',
                  backgroundColor: 'var(--bg-muted)',
                  borderRadius: '10px',
                  padding: '0.25rem',
                  marginBottom: '1.75rem',
                }}
              >
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage('');
              }}
              style={{
                flex: 1,
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: mode === 'login' ? '#ffffff' : 'transparent',
                color: mode === 'login' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: mode === 'login' ? 700 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                boxShadow: mode === 'login' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {t('auth.signInTab')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage('');
              }}
              style={{
                flex: 1,
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: mode === 'register' ? '#ffffff' : 'transparent',
                color: mode === 'register' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: mode === 'register' ? 700 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                boxShadow: mode === 'register' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {t('auth.createAccountTab')}
            </button>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              {mode === 'login' ? t('auth.welcomeBack') : t('auth.createAccount')}
            </h2>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              {mode === 'login'
                ? t('auth.loginSubtitle')
                : t('auth.registerSubtitle')}
            </p>
          </div>

          {errorMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '0.825rem',
                fontWeight: 500,
                marginBottom: '1.25rem',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {mode === 'register' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      {t('auth.firstNameLabel')}
                    </label>
                    <div className="input-with-icon-wrapper">
                      <div className="input-leading-icon">
                        <User size={16} />
                      </div>
                      <input
                        type="text"
                        placeholder="Jean"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="input-field input-has-leading-icon"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      {t('auth.lastNameLabel')}
                    </label>
                    <div className="input-with-icon-wrapper">
                      <div className="input-leading-icon">
                        <User size={16} />
                      </div>
                      <input
                        type="text"
                        placeholder="Baptiste"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="input-field input-has-leading-icon"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    {t('auth.phoneLabel')}
                  </label>
                  <div className="input-with-icon-wrapper">
                    <div className="input-leading-icon">
                      <Phone size={16} />
                    </div>
                    <input
                      type="tel"
                      placeholder={t('auth.phonePlaceholder')}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input-field input-has-leading-icon"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                {t('auth.emailLabel')}
              </label>
              <div className="input-with-icon-wrapper">
                <div className="input-leading-icon">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field input-has-leading-icon"
                  required
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {t('auth.passwordLabel')}
                </label>
                {mode === 'login' && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>
                    {t('auth.forgotPassword')}
                  </span>
                )}
              </div>
              <div className="input-with-icon-wrapper">
                <div className="input-leading-icon">
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field input-has-leading-icon input-has-trailing-icon"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="input-trailing-action"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.8rem 1.25rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                marginTop: '0.35rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              {loading ? (
                <span className="spinner" />
              ) : mode === 'login' ? (
                <>
                  <span>{t('auth.signInBtn')}</span>
                  <ArrowRight size={16} />
                </>
              ) : (
                <>
                  <span>{t('auth.createAccountBtn')}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0', gap: '0.75rem' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('auth.orSeparator')}</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
          </div>

          <button
            type="button"
            onClick={() => {
              const base = import.meta.env.VITE_API_URL || '';
              window.location.href = `${base}/api/auth/sign-in/social?provider=google&callbackURL=${encodeURIComponent(window.location.origin)}`;
            }}
            className="btn btn-secondary"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.625rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              padding: '0.75rem',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>{t('auth.continueWithGoogle')}</span>
          </button>

          {/* Toggle mode helper */}
          <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            {mode === 'login' ? (
              <>
                <span>{t('auth.dontHaveAccount')} </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMessage('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {t('auth.createAccountTab')}
                </button>
              </>
            ) : (
              <>
                <span>{t('auth.alreadyHaveAccount')} </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMessage('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {t('auth.signInTab')}
                </button>
              </>
            )}
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
