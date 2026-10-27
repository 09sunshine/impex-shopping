import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { Truck, Package, ArrowRight, ShieldCheck, Clock, MapPin } from 'lucide-react';

export default function ShipmentsPage() {
  const { navigate } = useRouter();
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (isAuthenticated) {
      api.getOrders({ limit: 50 })
        .then((res) => {
          if (mounted) {
            const all = res?.orders || res?.items || res || [];
            // filter for active shipments in transit or arrived
            const shipments = all.filter((o) =>
              ['IN_TRANSIT', 'INTERNATIONAL_SHIPPING', 'PURCHASE_COMPLETED', 'ARRIVED_IN_HAITI', 'AVAILABLE_FOR_PICKUP'].includes(o.status)
            );
            setOrders(shipments);
          }
        })
        .catch(() => {
          if (mounted) setOrders([]);
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    } else {
      setLoading(false);
    }
    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="impex-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
        <Truck size={48} style={{ color: 'var(--text-light)', margin: '0 auto 1rem' }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Sign In to View Shipments
        </h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Track all international air cargo flights carrying your packages to Haiti.
        </p>
        <button onClick={() => navigate('/profile')} className="btn btn-primary">
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Active Shipments & Air Cargo</h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Monitor packages moving from US / global facilities to Port-au-Prince, Haiti
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="skeleton" style={{ height: '120px', borderRadius: 'var(--radius-lg)' }} />
          <div className="skeleton" style={{ height: '120px', borderRadius: 'var(--radius-lg)' }} />
        </div>
      ) : orders.length === 0 ? (
        <div className="impex-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <Truck size={48} style={{ color: 'var(--text-light)', margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            No Active Shipments in Transit
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            When you place an international order, real-time cargo tracking will appear here.
          </p>
          <button onClick={() => navigate('/shop')} className="btn btn-primary">
            Start Shopping
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {orders.map((o) => {
            const isArrived = ['ARRIVED_IN_HAITI', 'AVAILABLE_FOR_PICKUP'].includes(o.status);

            return (
              <div
                key={o.id}
                className="impex-card impex-card-interactive"
                onClick={() => navigate(`/orders/${o.id}`)}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        backgroundColor: isArrived ? 'var(--success-bg)' : 'var(--primary-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isArrived ? 'var(--success)' : 'var(--primary)',
                      }}
                    >
                      <Truck size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        Shipment for Order #{o.order_number || o.id}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Route: Miami Logistics Hub (MIA) → Port-au-Prince (PAP)
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className={`badge ${isArrived ? 'badge-success' : 'badge-primary'}`}>
                      {isArrived ? 'Arrived in Haiti' : 'In Flight / Transit'}
                    </span>
                    <button className="btn btn-subtle btn-sm">
                      <span>Track</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--bg-muted)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.875rem 1rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Tracking Code: </span>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>
                      {o.tracking_number || o.merchant_tracking_number || `IX-AIR-${o.id}`}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Carrier: </span>
                    <strong>IMPEX Air Freight Direct</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Destination: </span>
                    <strong>Port-au-Prince Central Depot</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
