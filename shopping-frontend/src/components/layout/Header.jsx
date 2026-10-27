import React, { useState } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useTranslation } from '../../context/LanguageContext';
import { useExchangeRate } from '../../context/ExchangeRateContext';
import LanguageToggle from '../common/LanguageToggle';
import {
  Search,
  ShoppingCart,
  Wallet,
  Bell,
  Menu,
  ArrowRight,
  TrendingUp,
  Link2,
} from 'lucide-react';

export default function Header({ onToggleMobileMenu }) {
  const { navigate, queryParams } = useRouter();
  const { user, wallet, isAuthenticated } = useAuth();
  const { itemCount } = useCart();
  const { t } = useTranslation();
  const { rateText, rateDetails } = useExchangeRate();
  const [searchInput, setSearchInput] = useState(queryParams.get('query') || '');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const query = searchInput.trim();
    if (query.startsWith('http://') || query.startsWith('https://') || query.includes('.com') || query.includes('.ht') || query.includes('.org')) {
      navigate(`/order?url=${encodeURIComponent(query)}`);
    } else if (query) {
      navigate(`/order?name=${encodeURIComponent(query)}`);
    } else {
      navigate('/order');
    }
  };

  const spendable = Number(wallet?.spendable_balance ?? wallet?.spendable_balance_usd ?? wallet?.balance ?? wallet?.balance_usd ?? 0);
  const firstName = user?.first_name || user?.name || (user?.email ? user.email.split('@')[0] : t('header.shopper'));

  // Time based greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('header.goodMorning') : hour < 18 ? t('header.goodAfternoon') : t('header.goodEvening');

  return (
    <header className="app-header">
      {/* Left: Mobile hamburger & Greeting */}
      <div className="header-left">
        <button
          onClick={onToggleMobileMenu}
          className="lg-hidden"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '0.4rem',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Toggle Navigation"
        >
          <Menu size={22} />
        </button>

        <div className="header-greeting">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            {greeting}
          </div>
          <div
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {firstName}
          </div>
        </div>
      </div>

      {/* Center: Global Link Bar */}
      <div className="header-center">
        <form onSubmit={handleSearchSubmit} className="search-bar-container" style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <span className="search-bar-icon" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center', zIndex: 3, color: 'var(--primary)' }}>
            <Link2 size={16} />
          </span>
          <input
            type="text"
            className="search-bar-input"
            placeholder={t('header.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ paddingLeft: '44px' }}
          />
        </form>
        <button
          onClick={() => navigate(searchInput.trim() ? `/order?url=${encodeURIComponent(searchInput.trim())}` : '/order')}
          className="btn btn-primary btn-sm hidden-mobile"
          style={{ gap: '0.4rem', whiteSpace: 'nowrap', flexShrink: 0, minWidth: 'fit-content' }}
        >
          <Link2 size={14} />
          <span>{t('header.orderByLinkBtn')}</span>
        </button>
      </div>

      {/* Right: Exchange Rate, Language Toggle, Wallet Balance, Notifications */}
      <div className="header-right">
        {/* Language Toggle */}
        <LanguageToggle variant="pill" />

        {/* Live Exchange Rate Pill */}
        <div
          className="hidden-mobile"
          title={t('header.exchangeRateTitle')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.4rem 0.75rem',
            backgroundColor: 'var(--bg-muted)',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            fontWeight: 600,
            border: '1px solid var(--border-light)',
            flexShrink: 0,
          }}
        >
          <TrendingUp size={13} style={{ color: 'var(--primary)' }} />
          <span>{rateText}</span>
        </div>

        {/* Wallet Balance Pill */}
        <button
          onClick={() => navigate('/wallet')}
          className="header-wallet-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.4rem 0.8rem',
            backgroundColor: 'var(--primary-light)',
            border: '1px solid #c7d2fe',
            borderRadius: 'var(--radius-full)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
          title={t('header.walletTitle')}
        >
          <Wallet size={15} style={{ color: 'var(--primary)' }} />
          <span className="header-wallet-amount" style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary)' }}>
            ${Number(spendable).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </button>

        {/* Notifications Shortcut */}
        <button
          onClick={() => navigate('/notifications')}
          className="header-notif-btn"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: '#ffffff',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
          aria-label={t('header.notificationsTitle')}
          title={t('header.notificationsTitle')}
        >
          <Bell size={17} />
        </button>
      </div>
    </header>
  );
}
