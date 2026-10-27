import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { useTranslation } from '../../context/LanguageContext';
import { useExchangeRate } from '../../context/ExchangeRateContext';
import api from '../../api/client';
import TopUpModal from '../../components/modals/TopUpModal';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Lock,
  Plus,
  Receipt,
  CheckCircle2,
  Clock,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

export default function WalletPage() {
  const { user, wallet, isAuthenticated, refreshUser } = useAuth();
  const { navigate } = useRouter();
  const { t } = useTranslation();
  const { toHtg, rate } = useExchangeRate();
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [topUpOpen, setTopUpOpen] = useState(false);

  const fetchTransactions = () => {
    setLoadingTx(true);
    return api.getWalletTransactions({ limit: 20 })
      .then((res) => {
        setTransactions(res?.transactions || res?.items || res || []);
      })
      .catch(() => {
        setTransactions([]);
      })
      .finally(() => {
        setLoadingTx(false);
      });
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchTransactions();
    } else {
      setLoadingTx(false);
    }
  }, [isAuthenticated]);

  const handleRefresh = async () => {
    await Promise.all([refreshUser(), fetchTransactions()]);
  };

  if (!isAuthenticated) {
    return (
      <div className="impex-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
        <Wallet size={48} style={{ color: 'var(--text-light)', margin: '0 auto 1rem' }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Sign In to Access Your Wallet
        </h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Manage your balance, top up funds via MonCash or bank transfer, and view transaction statements.
        </p>
        <button onClick={() => navigate('/profile')} className="btn btn-primary">
          Sign In
        </button>
      </div>
    );
  }

  const spendable = Number(wallet?.spendable_balance ?? wallet?.spendable_balance_usd ?? wallet?.balance ?? wallet?.balance_usd ?? 0);
  const reserved = Number(wallet?.reserved_balance ?? wallet?.reserved_balance_usd ?? 0);
  const total = spendable + reserved;
  const htgSpendable = wallet?.spendable_balance_htg !== undefined && wallet?.spendable_balance_htg !== null
    ? Math.round(Number(wallet.spendable_balance_htg))
    : toHtg(spendable);

  const getTxTypeBadge = (type, direction) => {
    const normType = String(type || '').toUpperCase();
    const normDir = String(direction || '').toUpperCase();

    if (['CREDIT', 'TOPUP', 'DEPOSIT', 'SEED'].includes(normType) || normDir === 'CREDIT') {
      return (
        <span className="badge badge-success" style={{ gap: '0.25rem' }}>
          <ArrowDownLeft size={12} />
          <span>{t('wallet.credit')}</span>
        </span>
      );
    }
    if (['ESCROW_HOLD', 'HOLD', 'RESERVATION'].includes(normType)) {
      return (
        <span className="badge badge-warning" style={{ gap: '0.25rem' }}>
          <Lock size={12} />
          <span>{t('wallet.reservation')}</span>
        </span>
      );
    }
    if (['ESCROW_RELEASE', 'REFUND'].includes(normType)) {
      return (
        <span className="badge badge-primary" style={{ gap: '0.25rem' }}>
          <CheckCircle2 size={12} />
          <span>{t('wallet.release')}</span>
        </span>
      );
    }
    if (['DEBIT', 'PURCHASE', 'PAYMENT', 'CAPTURE'].includes(normType) || normDir === 'DEBIT') {
      return (
        <span className="badge badge-danger" style={{ gap: '0.25rem' }}>
          <ArrowUpRight size={12} />
          <span>{t('wallet.purchaseCapture')}</span>
        </span>
      );
    }
    return <span className="badge badge-muted">{type || direction || 'Transaction'}</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{t('wallet.title')}</h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {t('wallet.subtitle')}
          </p>
        </div>

        <button onClick={() => setTopUpOpen(true)} className="btn btn-primary" style={{ gap: '0.5rem' }}>
          <Plus size={16} />
          <span>{t('wallet.depositFunds')}</span>
        </button>
      </div>

      {/* Main Balance Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '1.25rem' }}>
        {/* Spendable Balance Card */}
        <div
          className="impex-card"
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
            color: '#ffffff',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.85)' }}>
                {t('wallet.availableBalance')}
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Wallet size={16} style={{ color: '#ffffff' }} />
              </div>
            </div>

            <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
              ${spendable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'rgba(255, 255, 255, 0.85)', marginTop: '0.25rem' }}>
              ≈ {htgSpendable.toLocaleString()} HTG at live rate
            </div>
          </div>

          <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.8)' }}>
              Ready for instant checkout with 0 fees
            </span>
          </div>
        </div>

        {/* Reserved in Escrow Card */}
        <div className="impex-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                {t('wallet.reservedBalance')}
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--warning-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--warning)',
                }}
              >
                <Lock size={16} />
              </div>
            </div>

            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              ${reserved.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {t('orderDetail.timelineSteps.fundsReserved')}
            </div>
          </div>

          <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {t('orderDetail.timelineSteps.fundsReserved')}
            </span>
          </div>
        </div>

        {/* Total Ledger Balance */}
        <div className="impex-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                {t('wallet.totalBalance')}
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                }}
              >
                <ShieldCheck size={16} />
              </div>
            </div>

            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Combined available & escrow holdings
            </div>
          </div>

          <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Currency: USD / HTG Dual Support
            </span>
          </div>
        </div>
      </div>

      {/* Transaction History Section */}
      <div className="impex-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Transaction History</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              All wallet debits, credits, and escrow balance adjustments
            </p>
          </div>
          <button onClick={handleRefresh} className="btn btn-secondary btn-sm">
            Refresh
          </button>
        </div>

        {loadingTx ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="skeleton" style={{ height: '40px', width: '100%' }} />
            <div className="skeleton" style={{ height: '40px', width: '100%' }} />
            <div className="skeleton" style={{ height: '40px', width: '100%' }} />
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <Receipt size={40} style={{ color: 'var(--text-light)', margin: '0 auto 0.75rem' }} />
            <h4 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-secondary)' }}>
              No transactions recorded yet
            </h4>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Your top-up deposits and checkout purchases will be logged here with complete timestamps.
            </p>
            <button onClick={() => setTopUpOpen(true)} className="btn btn-primary btn-sm">
              Top Up Wallet Now
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="desktop-table-view">
              <div className="impex-table-container">
                <table className="impex-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Description / Reference</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t, idx) => {
                      const amt = Number(t.amount !== undefined ? t.amount : (t.amount_usd !== undefined ? t.amount_usd : 0));
                      const normType = String(t.type || t.entry_type || '').toUpperCase();
                      const isPositive = t.direction === 'CREDIT' || ['CREDIT', 'TOPUP', 'DEPOSIT', 'REFUND', 'ESCROW_RELEASE', 'SEED'].includes(normType);

                      return (
                        <tr key={t.id || idx}>
                          <td>{getTxTypeBadge(t.type || t.entry_type, t.direction)}</td>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {t.description || t.reference || `Transaction #${t.id}`}
                            </div>
                            {t.reference && (
                              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                Ref: {t.reference}
                              </div>
                            )}
                          </td>
                          <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            {new Date(t.created_at || Date.now()).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td>
                            <span className="badge badge-success">Completed</span>
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontWeight: 800,
                              color: isPositive ? 'var(--success)' : 'var(--text-primary)',
                            }}
                          >
                            {isPositive ? '+' : '-'}${Math.abs(amt).toFixed(2)} USD
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="mobile-card-view">
              {transactions.map((t, idx) => {
                const amt = Number(t.amount !== undefined ? t.amount : (t.amount_usd !== undefined ? t.amount_usd : 0));
                const normType = String(t.type || t.entry_type || '').toUpperCase();
                const isPositive = t.direction === 'CREDIT' || ['CREDIT', 'TOPUP', 'DEPOSIT', 'REFUND', 'ESCROW_RELEASE', 'SEED'].includes(normType);

                return (
                  <div
                    key={t.id || idx}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      backgroundColor: '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      {getTxTypeBadge(t.type || t.entry_type, t.direction)}
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '1rem',
                          color: isPositive ? 'var(--success)' : 'var(--text-primary)',
                        }}
                      >
                        {isPositive ? '+' : '-'}${Math.abs(amt).toFixed(2)} USD
                      </span>
                    </div>

                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                      {t.description || t.reference || `Transaction #${t.id}`}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>
                        {new Date(t.created_at || Date.now()).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {t.reference && (
                        <span style={{ fontFamily: 'monospace' }}>Ref: {t.reference}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <TopUpModal isOpen={topUpOpen} onClose={() => setTopUpOpen(false)} />
    </div>
  );
}
