"use client";

import Link from "next/link";
import { FiShoppingCart } from "react-icons/fi";
import { useCart } from "@/app/components/CartProvider";

type CartLinkProps = {
  className?: string;
};

export default function CartLink({ className = "" }: CartLinkProps) {
  const { itemCount } = useCart();

  return (
    <Link
      href="/cart"
      className={[
        "inline-flex items-center gap-2 rounded-md border border-accent/45 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-[#8c6518] transition hover:border-accent hover:text-primary",
        className,
      ].join(" ")}
    >
      <FiShoppingCart aria-hidden="true" />
      Cart
      <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-xs text-primary">
        {itemCount}
      </span>
    </Link>
  );
}
