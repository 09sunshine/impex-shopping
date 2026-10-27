import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const refreshCart = useCallback(async () => {
    if (!isAuthenticated) {
      setCart(null);
      return null;
    }
    setLoading(true);
    try {
      const data = await api.getCart();
      setCart(data);
      return data;
    } catch {
      // If no cart yet or not authenticated, empty cart
      setCart(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addToCart = async (productData) => {
    if (!isAuthenticated) {
      toast.warning('Please log in to your IMPEX account to add items to your cart.');
      return false;
    }
    setLoading(true);
    try {
      const updatedCart = await api.addToCart(productData);
      setCart(updatedCart);
      toast.success(`Added "${productData.title?.slice(0, 30)}..." to your cart!`);
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to add item to cart.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId, quantity, selectedVariant) => {
    if (quantity <= 0) {
      return removeItem(itemId);
    }
    setLoading(true);
    try {
      const updatedCart = await api.updateCartItem(itemId, {
        quantity,
        selectedVariant,
      });
      setCart(updatedCart);
      return true;
    } catch (err) {
      toast.error(err.message || 'Could not update item quantity.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (itemId) => {
    setLoading(true);
    try {
      const updatedCart = await api.removeCartItem(itemId);
      setCart(updatedCart);
      toast.info('Item removed from cart.');
      return true;
    } catch (err) {
      toast.error(err.message || 'Could not remove item.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const clearCart = async () => {
    setLoading(true);
    try {
      await api.clearCart();
      setCart(null);
      toast.info('Cart cleared.');
      return true;
    } catch (err) {
      toast.error(err.message || 'Could not clear cart.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const items = cart?.items || [];
  const itemCount = items.reduce((acc, it) => acc + (it.quantity || 1), 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        items,
        itemCount,
        loading,
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
