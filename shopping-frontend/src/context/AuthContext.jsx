import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [receivingAddress, setReceivingAddress] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const inFlightMePromiseRef = useRef(null);

  const refreshUser = useCallback(async () => {
    if (inFlightMePromiseRef.current) {
      return inFlightMePromiseRef.current;
    }

    inFlightMePromiseRef.current = (async () => {
      try {
        const data = await api.getMe();
      if (data && (data.user || data.id)) {
        const rawUser = data.user || data;
        const customer = data.customer || rawUser.customer || {};
        const admin = data.admin || rawUser.admin || {};
        const employee = data.employee || rawUser.employee || {};

        const firstName =
          rawUser.first_name ||
          customer.first_name ||
          admin.first_name ||
          employee.first_name ||
          (rawUser.email ? rawUser.email.split('@')[0] : 'Shopper');

        const lastName =
          rawUser.last_name ||
          customer.last_name ||
          admin.last_name ||
          employee.last_name ||
          '';

        const fullName =
          rawUser.name ||
          `${firstName} ${lastName}`.trim();

        const normalizedUser = {
          ...rawUser,
          first_name: firstName,
          last_name: lastName,
          name: fullName,
          customer: data.customer || rawUser.customer,
          admin: data.admin || rawUser.admin,
          employee: data.employee || rawUser.employee,
        };

        // Normalize wallet
        const rawWallet = data.wallet || rawUser.wallet || null;
        let normalizedWallet = null;
        if (rawWallet) {
          const spendable = Number(
            rawWallet.spendable_balance ??
            rawWallet.spendable_balance_usd ??
            rawWallet.balance ??
            rawWallet.balance_usd ??
            0
          );
          const balance = Number(
            rawWallet.balance ??
            rawWallet.balance_usd ??
            spendable
          );
          const reserved = Number(
            rawWallet.reserved_balance ??
            rawWallet.reserved_balance_usd ??
            0
          );
          const balanceHtg = Number(
            rawWallet.balance_htg !== undefined && rawWallet.balance_htg !== null
              ? rawWallet.balance_htg
              : (balance * (rawWallet.exchange_rate || 130.98))
          );
          const spendableHtg = Number(
            rawWallet.spendable_balance_htg !== undefined && rawWallet.spendable_balance_htg !== null
              ? rawWallet.spendable_balance_htg
              : (spendable * (rawWallet.exchange_rate || 130.98))
          );

          normalizedWallet = {
            ...rawWallet,
            balance,
            balance_usd: balance,
            balance_htg: balanceHtg,
            spendable_balance: spendable,
            spendable_balance_usd: spendable,
            spendable_balance_htg: spendableHtg,
            reserved_balance: reserved,
            reserved_balance_usd: reserved,
          };
        }

        // Normalize receiving address
        const rawAddr =
          data.receiving_address ||
          data.international_address ||
          customer.address ||
          null;

        const normalizedAddress = rawAddr ? {
          ...rawAddr,
          address_line: rawAddr.address_line || rawAddr.house || '8400 NW 25th St, IMPEX Depot',
          suite: rawAddr.suite || `IMX-${(normalizedUser.id || '7740').slice(0, 6).toUpperCase()}`,
          city: rawAddr.city || 'Doral',
          state: rawAddr.state || 'FL',
          zip_code: rawAddr.zip_code || '33198',
        } : {
          address_line: '8400 NW 25th St, IMPEX Logistics Hub',
          suite: `IMX-${(normalizedUser.id || '7740').slice(0, 6).toUpperCase()}`,
          city: 'Doral',
          state: 'FL',
          zip_code: '33198',
        };

        setUser(normalizedUser);
        setWallet(normalizedWallet);
        setReceivingAddress(normalizedAddress);
        return { user: normalizedUser, wallet: normalizedWallet, address: normalizedAddress };
      } else {
        setUser(null);
        setWallet(null);
        setReceivingAddress(null);
        return null;
      }
    } catch (err) {
      console.warn('Failed to refresh user:', err);
      if (!api.getToken()) {
        setUser(null);
        setWallet(null);
        setReceivingAddress(null);
      }
      return null;
    } finally {
      inFlightMePromiseRef.current = null;
    }
  })();

  return inFlightMePromiseRef.current;
}, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await refreshUser();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshUser]);

  const login = async (email, password) => {
    try {
      const res = await api.login(email, password);
      if (res && res.status === 'OTP_REQUIRED') {
        return res;
      }
      // If direct login (fallback or test)
      if (res && res.user) {
        const u = res.user || {
          id: res.user_id,
          email: res.email || email,
          role: res.role || 'customer',
        };
        const rawFirst = u.first_name || (u.customer && u.customer.first_name) || (u.email ? u.email.split('@')[0] : 'Customer');
        const rawLast = u.last_name || (u.customer && u.customer.last_name) || '';
        const initialNormalized = {
          ...u,
          first_name: rawFirst,
          last_name: rawLast,
          name: `${rawFirst} ${rawLast}`.trim(),
        };
        setUser(initialNormalized);
        if (res.wallet) {
          setWallet({
            ...res.wallet,
            spendable_balance: Number(res.wallet.spendable_balance ?? res.wallet.spendable_balance_usd ?? res.wallet.balance ?? 0),
            balance: Number(res.wallet.balance ?? res.wallet.balance_usd ?? 0),
            reserved_balance: Number(res.wallet.reserved_balance ?? res.wallet.reserved_balance_usd ?? 0),
          });
        }
      }

      let refreshed = null;
      try {
        refreshed = await refreshUser();
      } catch (meErr) {
        console.warn('Post-login refreshUser error:', meErr);
      }

      const displayName = refreshed?.user?.first_name || res.user?.first_name || (email ? email.split('@')[0] : 'Customer');
      toast.success(`Welcome back, ${displayName}!`);
      return res;
    } catch (err) {
      toast.error(err.message || 'Login failed. Please check your credentials.');
      throw err;
    }
  };

  const register = async (formData) => {
    try {
      const res = await api.register(formData);
      if (res && res.status === 'OTP_REQUIRED') {
        return res;
      }
      return res;
    } catch (err) {
      toast.error(err.message || 'Registration failed. Please try again.');
      throw err;
    }
  };

  const verifyOtp = async (email, otp, purpose) => {
    try {
      const res = await api.verifyOtp(email, otp, purpose);
      if (res && res.user) {
        const u = res.user;
        const rawFirst = u.first_name || (u.customer && u.customer.first_name) || (u.email ? u.email.split('@')[0] : 'Customer');
        const rawLast = u.last_name || (u.customer && u.customer.last_name) || '';
        const initialNormalized = {
          ...u,
          first_name: rawFirst,
          last_name: rawLast,
          name: `${rawFirst} ${rawLast}`.trim(),
        };
        setUser(initialNormalized);
        if (res.wallet) {
          setWallet({
            ...res.wallet,
            spendable_balance: Number(res.wallet.spendable_balance ?? res.wallet.spendable_balance_usd ?? res.wallet.balance ?? 0),
            balance: Number(res.wallet.balance ?? res.wallet.balance_usd ?? 0),
            reserved_balance: Number(res.wallet.reserved_balance ?? res.wallet.reserved_balance_usd ?? 0),
          });
        }
      }

      let refreshed = null;
      try {
        refreshed = await refreshUser();
      } catch (meErr) {
        console.warn('Post-otp refreshUser error:', meErr);
      }

      const displayName = refreshed?.user?.first_name || res.user?.first_name || (email ? email.split('@')[0] : 'Customer');
      toast.success(`Welcome to IMPEX, ${displayName}!`);
      return res;
    } catch (err) {
      toast.error(err.message || 'OTP verification failed. Please try again.');
      throw err;
    }
  };

  const resendOtp = async (email, purpose) => {
    try {
      const res = await api.resendOtp(email, purpose);
      toast.info(res.message || 'Verification code resent to your email.');
      return res;
    } catch (err) {
      toast.error(err.message || 'Failed to resend verification code.');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.logout();
      setUser(null);
      setWallet(null);
      setReceivingAddress(null);
      toast.info('You have been logged out.');
    } catch (err) {
      console.error('Logout error:', err);
      setUser(null);
      setWallet(null);
      setReceivingAddress(null);
    }
  };

  const isAdmin = Boolean(user && (user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'superadmin' || user.is_admin === true));

  return (
    <AuthContext.Provider
      value={{
        user,
        wallet,
        receivingAddress,
        loading,
        isAuthenticated: !!user,
        isAdmin,
        login,
        register,
        verifyOtp,
        resendOtp,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
