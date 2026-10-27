import React from 'react';
import { useRouter } from '../../context/RouterContext';
import { useCart } from '../../context/CartContext';
import { useTranslation } from '../../context/LanguageContext';
import {
  LayoutDashboard,
  Link2,
  Package,
  Wallet,
  User,
} from 'lucide-react';

export default function MobileNav() {
  const { currentPath, navigate } = useRouter();
  const { t } = useTranslation();

  const tabs = [
    { label: t('nav.home'), path: '/', icon: LayoutDashboard },
    { label: t('nav.orderByLink'), path: '/order', icon: Link2 },
    { label: t('nav.orders'), path: '/orders', icon: Package },
    { label: t('nav.wallet'), path: '/wallet', icon: Wallet },
    { label: t('nav.profile'), path: '/profile', icon: User },
  ];

  return (
    <nav
      className="mobile-bottom-nav"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        minHeight: '60px',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        backgroundColor: '#ffffff',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 50,
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)',
      }}
    >
      {tabs.map((tab) => {
        const isActive =
          tab.path === '/'
            ? currentPath === '/'
            : currentPath.startsWith(tab.path);
        const Icon = tab.icon;

        return (
          <button
            key={tab.label}
            onClick={() => navigate(tab.path)}
            style={{
              background: 'none',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              position: 'relative',
              padding: '6px clamp(2px, 1.2vw, 8px)',
              flex: '1 1 0',
              minWidth: 0,
            }}
          >
            <div style={{ position: 'relative' }}>
              <Icon size={20} />
              {tab.badge && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-8px',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.6875rem', fontWeight: isActive ? 600 : 500 }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
