"use client";

import { useEffect, useState } from "react";
import { FiCheck, FiShoppingCart } from "react-icons/fi";
import { getProductStock, type Product } from "@/lib/productImages";
import { useCart } from "@/app/components/CartProvider";

type AddToCartButtonProps = {
  product: Product;
  imageUrl?: string | null;
};

export default function AddToCartButton({
  product,
  imageUrl,
}: AddToCartButtonProps) {
  const { addItem, items } = useCart();
  const [added, setAdded] = useState(false);
  const stockQuantity = getProductStock(product);
  const cartItem = items.find((item) => item.id === String(product.id));
  const cartQuantity = cartItem?.quantity || 0;
  const isOutOfStock = stockQuantity <= 0;
  const isMaxInCart = stockQuantity > 0 && cartQuantity >= stockQuantity;
  const disabled = isOutOfStock || isMaxInCart;
  const label = added
    ? "Added"
    : isOutOfStock
      ? "Out of Stock"
      : isMaxInCart
        ? "Max in Cart"
        : "Add to Cart";

  useEffect(() => {
    if (!added) return;

    const timeoutId = window.setTimeout(() => {
      setAdded(false);
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [added]);

  return (
    <button
      type="button"
      onClick={() => {
        if (disabled) return;

        addItem({
          id: product.id,
          name: product.name,
          price: Number(product.price),
          description: product.description,
          imageUrl,
          stockQuantity,
        });
        setAdded(true);
      }}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-black uppercase tracking-[0.12em] text-primary transition hover:bg-[#ddb357] disabled:cursor-not-allowed disabled:opacity-55"
    >
      {added ? <FiCheck aria-hidden="true" /> : <FiShoppingCart aria-hidden="true" />}
      {label}
    </button>
  );
}
