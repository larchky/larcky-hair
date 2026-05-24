"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo } from "react";
import {
  FiArrowLeft,
  FiMinus,
  FiPlus,
  FiShoppingCart,
  FiTrash2,
} from "react-icons/fi";
import BrandLogo from "@/app/components/BrandLogo";
import CartLink from "@/app/components/CartLink";
import PayButton from "@/app/components/PayButton";
import { useCart } from "@/app/components/CartProvider";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-NG", {
    currency: "NGN",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export default function CartPage() {
  const {
    items,
    itemCount,
    subtotal,
    updateQuantity,
    removeItem,
    clearCart,
  } = useCart();

  useEffect(() => {
    const paymentStatus = new URLSearchParams(window.location.search).get(
      "payment"
    );
    const paymentMessages: Record<string, string> = {
      success: "Payment successful! Your order has been received.",
      unconfirmed:
        "Payment was received, but the order could not be confirmed yet. Please contact Dolapo Store.",
      failed: "Payment was not completed. Your order was not saved.",
      cancelled: "Payment was cancelled. Your order was not saved.",
    };

    if (paymentStatus && paymentMessages[paymentStatus]) {
      alert(paymentMessages[paymentStatus]);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const checkoutItems = useMemo(
    () =>
      items.map((item) => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
    [items]
  );
  const orderProductName = useMemo(() => {
    if (items.length === 0) return "Cart order";
    if (items.length === 1) return items[0].name;

    return `Cart order: ${items
      .map((item) => `${item.name} x${item.quantity}`)
      .join(", ")}`;
  }, [items]);

  return (
    <main className="min-h-screen bg-studio px-5 py-8 text-champagne sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-6 border-b border-[#eadbb8] pb-8 md:flex-row md:items-center">
          <BrandLogo compact />

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex w-fit items-center gap-2 rounded-md border border-[#d9c28c] px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-champagne transition hover:border-accent/60 hover:text-primary"
            >
              <FiArrowLeft aria-hidden="true" />
              Home
            </Link>
            <Link
              href="/products"
              className="w-fit rounded-md border border-[#d9c28c] px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-champagne transition hover:border-accent/60 hover:text-primary"
            >
              Products
            </Link>
            <CartLink />
          </div>
        </header>

        <section className="py-10">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.24em] text-accent">
            <FiShoppingCart aria-hidden="true" />
            Cart
          </p>
          <h1 className="mt-3 font-serif text-5xl font-bold text-primary">
            Review your order
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-champagne/72">
            Confirm your selected cameras, lights, tripods, microphones, and
            creator tools before making payment.
          </p>
        </section>

        {items.length === 0 ? (
          <section className="rounded-lg border border-accent/25 bg-white/85 p-8 text-center shadow-[0_18px_45px_rgba(99,69,22,0.10)]">
            <FiShoppingCart
              className="mx-auto text-4xl text-accent"
              aria-hidden="true"
            />
            <h2 className="mt-4 text-2xl font-bold text-primary">
              Your cart is empty
            </h2>
            <p className="mx-auto mt-2 max-w-md text-champagne/65">
              Add products from the catalog and come back here to checkout.
            </p>
            <Link
              href="/products"
              className="mt-6 inline-flex rounded-md bg-accent px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-primary transition hover:bg-[#ddb357]"
            >
              Browse Products
            </Link>
          </section>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[1fr_24rem]">
            <div className="space-y-4">
              {items.map((item) => {
                const isAtStockLimit = item.quantity >= item.stockQuantity;

                return (
                  <article
                    key={item.id}
                    className="grid gap-4 rounded-lg border border-[#eadbb8] bg-white/90 p-4 shadow-[0_18px_45px_rgba(99,69,22,0.10)] sm:grid-cols-[8rem_1fr]"
                  >
                  <div className="aspect-square overflow-hidden rounded-md border border-[#eadbb8] bg-[#fff8ea]">
                    {item.imageUrl ? (
                      <img
                        alt={item.name}
                        src={item.imageUrl}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="grid h-full place-items-center px-3 text-center text-xs font-bold uppercase tracking-[0.14em] text-accent">
                        Dolapo
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row">
                      <div>
                        <h2 className="text-xl font-bold text-primary">
                          {item.name}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-champagne/68">
                          {item.description ||
                            "Premium creator tool for studio work."}
                        </p>
                        <p className="mt-2 inline-flex rounded-md bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-800">
                          {item.stockQuantity} in stock
                        </p>
                      </div>
                      <p className="text-2xl font-black text-accent">
                        {formatCurrency(item.price)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eadbb8] pt-4">
                      <div className="inline-flex items-center rounded-md border border-[#d9c28c] bg-white/80">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                          aria-label={`Decrease ${item.name} quantity`}
                          className="grid size-10 place-items-center text-[#8c6518] transition hover:text-primary"
                        >
                          <FiMinus aria-hidden="true" />
                        </button>
                        <span className="grid h-10 min-w-12 place-items-center border-x border-[#eadbb8] px-3 font-black text-primary">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                          disabled={isAtStockLimit}
                          aria-label={`Increase ${item.name} quantity`}
                          className="grid size-10 place-items-center text-[#8c6518] transition hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <FiPlus aria-hidden="true" />
                        </button>
                      </div>
                      {isAtStockLimit && (
                        <p className="text-xs font-semibold text-[#8c6518]">
                          Maximum stock reached
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:border-red-300 hover:bg-red-100"
                      >
                        <FiTrash2 aria-hidden="true" />
                        Remove
                      </button>
                    </div>
                  </div>
                  </article>
                );
              })}
            </div>

            <aside className="h-fit rounded-lg border border-accent/30 bg-white/90 p-6 shadow-[0_30px_80px_rgba(99,69,22,0.14)]">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-accent">
                Order Summary
              </p>

              <div className="mt-5 space-y-3 border-b border-[#eadbb8] pb-5">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-champagne/70">Items</span>
                  <span className="font-bold text-primary">{itemCount}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-champagne/70">Subtotal</span>
                  <span className="font-bold text-primary">
                    {formatCurrency(subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-champagne/70">Delivery</span>
                  <span className="font-bold text-primary">Arranged after payment</span>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-4">
                <span className="text-base font-bold text-primary">Total</span>
                <span className="text-3xl font-black text-accent">
                  {formatCurrency(subtotal)}
                </span>
              </div>

              <div className="mt-6 rounded-md border border-accent/30 bg-accent/10 p-4 text-sm leading-6 text-[#5c4214]">
                Your cart is paid together. Dolapo Store will contact you to
                confirm delivery arrangements after payment.
              </div>

              <div className="mt-6 grid gap-3">
                <PayButton
                  amount={subtotal}
                  productName={orderProductName}
                  checkoutItems={checkoutItems}
                  disabled={items.length === 0}
                  onPaymentSuccess={clearCart}
                />
                <Link
                  href="/products"
                  className="text-center text-sm font-bold uppercase tracking-[0.14em] text-[#8c6518] transition hover:text-primary"
                >
                  Continue Shopping
                </Link>
              </div>
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}
