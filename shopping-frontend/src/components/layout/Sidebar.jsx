import React from 'react';
import { useRouter, Link } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useTranslation } from '../../context/LanguageContext';
import LanguageToggle from '../common/LanguageToggle';
import {
  LayoutDashboard,
  Link2,
  Package,
  Truck,
  Wallet,
  Receipt,
  User,
  ShieldCheck,
  HelpCircle,
  LogOut,
  ChevronRight,
  ExternalLink,
  Store,
  ShoppingBag,
  Database,
  Layers,
  X,
} from 'lucide-react';

export default function Sidebar({ onCloseMobile }) {
  const { currentPath, navigate } = useRouter();
  const { user, wallet, isAdmin, logout, isAuthenticated } = useAuth();
  const { t } = useTranslation();

  const handleNavClick = (path) => {
    navigate(path);
    if (onCloseMobile) onCloseMobile();
  };

  const navItems = [
    {
      group: t('nav.internationalShopping'),
      items: [
        { label: t('nav.dashboard'), path: '/', icon: LayoutDashboard },
        { label: t('nav.orderByLink'), path: '/order', icon: Link2, highlight: true },
        { label: t('nav.orders'), path: '/orders', icon: Package },
        { label: t('nav.shipments'), path: '/shipments', icon: Truck },
      ],
    },
    {
      group: t('nav.walletAndFunds'),
      items: [
        { label: t('nav.wallet'), path: '/wallet', icon: Wallet },
        { label: t('nav.transactions'), path: '/wallet?tab=transactions', icon: Receipt },
      ],
    },
    {
      group: t('nav.account'),
      items: [
        { label: t('nav.profile'), path: '/profile', icon: User },
        { label: t('nav.help'), path: '/help', icon: HelpCircle },
      ],
    },
  ];

  if (isAdmin) {
    navItems.push({
      group: t('nav.operations'),
      items: [
        { label: t('nav.admin'), path: '/admin', icon: ShieldCheck, badge: 'Staff' },
        { label: t('nav.adminOrders'), path: '/admin/orders', icon: Package },
        { label: t('nav.adminCatalog'), path: '/admin/catalog', icon: Database },
      ],
    });
  }

  const spendable = Number(wallet?.spendable_balance ?? wallet?.spendable_balance_usd ?? wallet?.balance ?? wallet?.balance_usd ?? 0);

  return (
    <aside
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#ffffff',
        borderRight: onCloseMobile ? 'none' : '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-light)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '1.125rem',
              letterSpacing: '-0.03em',
              boxShadow: '0 4px 10px rgba(99, 102, 241, 0.35)',
            }}
          >
            IX
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                IMPEX
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  backgroundColor: 'var(--primary-light)',
                  color: 'var(--primary)',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                SHOP
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              International Shopping
            </div>
          </div>
        </div>

        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close Navigation"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.25rem 0.875rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {navItems.map((sec, idx) => (
          <div key={idx}>
            <div
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-light)',
                padding: '0 0.75rem 0.5rem',
              }}
            >
              {sec.group}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {sec.items.map((item) => {
                const isActive =
                  item.path === '/'
                    ? currentPath === '/'
                    : currentPath.startsWith(item.path.split('?')[0]);
                const Icon = item.icon;

                return (
                  <button
                    key={item.label}
                    onClick={() => handleNavClick(item.path)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.625rem 0.875rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isActive ? 'var(--primary-light)' : 'transparent',
                      color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: isActive ? 600 : 500,
                      fontSize: '0.875rem',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-muted)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Icon size={18} style={{ color: isActive ? 'var(--primary)' : 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge !== null && item.badge !== undefined && (
                      <span
                        style={{
                          backgroundColor: isActive ? 'var(--primary)' : '#e2e8f0',
                          color: isActive ? '#ffffff' : 'var(--text-secondary)',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '9999px',
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Link back to Main Impex Website */}
        <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
          <a
            href="https://www.impexht.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.625rem 0.875rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#f8fafc',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontSize: '0.8125rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>{t('nav.website')}</span>
            </span>
            <ExternalLink size={14} style={{ color: 'var(--text-light)' }} />
          </a>
        </div>
      </div>

      {/* User Footer Card */}
      <div
        style={{
          padding: '1rem',
          borderTop: '1px solid var(--border-light)',
          backgroundColor: '#fafbfc',
          flexShrink: 0,
        }}
      >
        {/* Language selector in sidebar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.85rem',
            padding: '0 0.25rem',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {t('common.language')}
          </span>
          <LanguageToggle variant="pill" />
        </div>

        {isAuthenticated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.875rem',
                border: '1px solid #c7d2fe',
                flexShrink: 0,
              }}
            >
              {(user?.first_name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.name || user?.email}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                ${Number(spendable).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <button
              onClick={logout}
              title={t('nav.logout')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-light)',
                cursor: 'pointer',
                padding: '0.35rem',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-light)')}
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => handleNavClick('/profile')}
            className="btn btn-primary btn-sm"
            style={{ width: '100%' }}
          >
            {t('nav.signIn')}
          </button>
        )}
      </div>
    </aside>
  );
}
