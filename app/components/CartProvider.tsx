"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type CartProductInput = {
  id: number | string;
  name: string;
  price: number;
  description?: string | null;
  imageUrl?: string | null;
  stockQuantity: number;
};

export type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  description: string | null;
  imageUrl: string | null;
  stockQuantity: number;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (product: CartProductInput) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
};

const CART_STORAGE_KEY = "dolapo-cart-items";
const CartContext = createContext<CartContextValue | null>(null);

function normalizeStockQuantity(value: unknown) {
  const stockQuantity = Number(value);

  return Number.isFinite(stockQuantity) && stockQuantity > 0
    ? Math.floor(stockQuantity)
    : 0;
}

function normalizeCartItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];

    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "";
    const name = typeof record.name === "string" ? record.name : "";
    const price = Number(record.price);
    const quantity = Number(record.quantity);
    const stockQuantity = normalizeStockQuantity(record.stockQuantity);

    if (
      !id ||
      !name ||
      !Number.isFinite(price) ||
      price <= 0 ||
      stockQuantity <= 0
    ) {
      return [];
    }

    return [
      {
        id,
        name,
        price,
        quantity:
          Number.isFinite(quantity) && quantity > 0
            ? Math.min(Math.floor(quantity), stockQuantity)
            : 1,
        description:
          typeof record.description === "string" ? record.description : null,
        imageUrl: typeof record.imageUrl === "string" ? record.imageUrl : null,
        stockQuantity,
      },
    ];
  });
}

function getStoredCartItems() {
  if (typeof window === "undefined") return [];

  try {
    const storedItems = window.localStorage.getItem(CART_STORAGE_KEY);
    return storedItems ? normalizeCartItems(JSON.parse(storedItems)) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(getStoredCartItems);

  useEffect(() => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((product: CartProductInput) => {
    setItems((currentItems) => {
      const productId = String(product.id);
      const stockQuantity = normalizeStockQuantity(product.stockQuantity);

      if (stockQuantity <= 0) return currentItems;

      const existingItem = currentItems.find((item) => item.id === productId);

      if (existingItem) {
        if (existingItem.quantity >= stockQuantity) return currentItems;

        return currentItems.map((item) =>
          item.id === productId
            ? {
                ...item,
                description: product.description || item.description,
                imageUrl: product.imageUrl || item.imageUrl,
                price: Number(product.price),
                quantity: Math.min(item.quantity + 1, stockQuantity),
                stockQuantity,
              }
            : item
        );
      }

      return [
        ...currentItems,
        {
          id: productId,
          name: product.name,
          price: Number(product.price),
          quantity: 1,
          description: product.description || null,
          imageUrl: product.imageUrl || null,
          stockQuantity,
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems((currentItems) => {
      if (quantity <= 0) {
        return currentItems.filter((item) => item.id !== id);
      }

      return currentItems.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: Math.min(
                Math.floor(quantity),
                normalizeStockQuantity(item.stockQuantity)
              ),
            }
          : item
      );
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((currentItems) => currentItems.filter((item) => item.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = items.reduce((total, item) => total + item.quantity, 0);
    const subtotal = items.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );

    return {
      items,
      itemCount,
      subtotal,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    };
  }, [addItem, clearCart, items, removeItem, updateQuantity]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider.");
  }

  return context;
}
