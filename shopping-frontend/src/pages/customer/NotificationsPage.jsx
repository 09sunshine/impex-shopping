import React from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { Bell, CheckCircle2, Truck, Package, Info, ArrowRight } from 'lucide-react';

export default function NotificationsPage() {
  const { navigate } = useRouter();
  const { user, isAuthenticated } = useAuth();

  const notifications = [
    {
      id: 1,
      title: 'Welcome to IMPEX International Shopping',
      message: 'You can now browse products from Amazon, eBay, AliExpress, and SHEIN directly with IMPEX wallet checkout.',
      time: 'Just now',
      icon: Info,
      type: 'info',
      action: '/shop',
      actionText: 'Start Browsing',
    },
    {
      id: 2,
      title: 'Guaranteed Customs Clearance in Haiti',
      message: 'All international orders through IMPEX are handled with automated customs brokerage and direct air transport to Port-au-Prince.',
      time: '1 day ago',
      icon: CheckCircle2,
      type: 'success',
      action: '/help',
      actionText: 'Learn More',
    },
  ];

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Notification Center</h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Order status updates, flight arrivals, and marketplace alerts
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {notifications.map((n) => {
          const Icon = n.icon;
          return (
            <div
              key={n.id}
              className="impex-card"
              style={{
                padding: '1.25rem',
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: n.type === 'success' ? 'var(--success-bg)' : 'var(--primary-light)',
                  color: n.type === 'success' ? 'var(--success)' : 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon size={18} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <h4 style={{ fontWeight: 700, fontSize: '0.925rem', color: 'var(--text-primary)' }}>
                    {n.title}
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{n.time}</span>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '0.75rem' }}>
                  {n.message}
                </p>

                {n.action && (
                  <button
                    onClick={() => navigate(n.action)}
                    className="btn btn-subtle btn-sm"
                    style={{ gap: '0.35rem' }}
                  >
                    <span>{n.actionText}</span>
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
