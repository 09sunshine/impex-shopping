import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNav from './MobileNav';
import { useRouter } from '../../context/RouterContext';

export default function Layout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentPath } = useRouter();

  // If in admin mode and user wants a clean operations shell, we can still use Layout
  return (
    <div className="app-layout-root">
      {/* Desktop Sidebar */}
      <div className="desktop-sidebar-container">
        <Sidebar />
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
          }}
        >
          {/* Backdrop */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.45)',
              backdropFilter: 'blur(2px)',
            }}
          />
          {/* Drawer content */}
          <div
            style={{
              position: 'relative',
              zIndex: 101,
              width: '280px',
              maxWidth: '85vw',
              height: '100%',
              backgroundColor: '#ffffff',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <Sidebar onCloseMobile={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="app-layout-main">
        <Header onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)} />

        <main className="app-main-content">
          {children}
        </main>

        <MobileNav />
      </div>
    </div>
  );
}
