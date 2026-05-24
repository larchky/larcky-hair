"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiGrid, FiSearch } from "react-icons/fi";
import { supabase } from "@/lib/supabaseClient";
import {
  getProductDisplayImageUrl,
  getProductImageRows,
  getProductImageUrls,
  getProductStock,
  type Product,
} from "@/lib/productImages";
import AddToCartButton from "@/app/components/AddToCartButton";
import BrandLogo from "@/app/components/BrandLogo";
import CartLink from "@/app/components/CartLink";
import Product360Viewer from "@/app/components/Product360Viewer";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase.from("products").select("*");
      setProducts(data || []);
    };

    fetchProducts();

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

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    const searchableText = `${product.name} ${product.description || ""}`;
    return searchableText.toLowerCase().includes(normalizedSearch);
  });

  return (
    <main className="min-h-screen bg-studio px-5 py-8 text-champagne sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-6 border-b border-[#eadbb8] pb-8 md:flex-row md:items-center">
          <BrandLogo compact />

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="w-fit rounded-md border border-accent/45 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-[#8c6518] transition hover:border-accent hover:text-primary"
            >
              Home
            </Link>
            <Link
              href="/reviews"
              className="w-fit rounded-md border border-[#d9c28c] px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-champagne transition hover:border-accent/60 hover:text-primary"
            >
              Reviews
            </Link>
            <CartLink />
          </div>
        </header>

        <section className="py-10">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.24em] text-accent">
            <FiGrid aria-hidden="true" />
            Catalog
          </p>
          <h1 className="mt-3 font-serif text-5xl font-bold text-primary">
            Creator tools
          </h1>
          <label className="mt-8 flex max-w-2xl items-center gap-3 rounded-md border border-accent/30 bg-white/90 px-4 py-3 text-champagne shadow-[0_18px_48px_rgba(99,69,22,0.12)]">
            <FiSearch className="shrink-0 text-accent" aria-hidden="true" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search all creator tools..."
              className="w-full bg-transparent text-sm text-primary outline-none placeholder:text-champagne/45"
            />
          </label>
        </section>

        {products.length === 0 ? (
          <div className="rounded-lg border border-accent/25 bg-white/85 p-8 text-center">
            <h2 className="text-2xl font-bold text-primary">
              No products available
            </h2>
            <p className="mt-2 text-champagne/65">
              New cameras, lights, microphones, and kits will appear here.
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-lg border border-accent/25 bg-white/85 p-8 text-center">
            <h2 className="text-2xl font-bold text-primary">
              No matching products
            </h2>
            <p className="mt-2 text-champagne/65">
              Try searching for camera, tripod, mic, light, or kit.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((p) => {
              const imageUrl = getProductDisplayImageUrl(p);
              const rotationImageUrls = getProductImageUrls(
                p.rotation_image_urls
              );
              const rotationImageRows = getProductImageRows(
                p.rotation_image_rows,
                p.rotation_image_urls
              );
              const stockQuantity = getProductStock(p);

              return (
                <article
                  key={p.id}
                  className="rounded-lg border border-[#eadbb8] bg-white/90 p-4 shadow-[0_18px_45px_rgba(99,69,22,0.12)] transition hover:-translate-y-1 hover:border-accent/55"
                >
                  <Product360Viewer
                    alt={p.name}
                    imageUrl={imageUrl}
                    frameUrls={rotationImageUrls}
                    frameRows={rotationImageRows}
                    className="h-60 rounded-md"
                  />

                  <h2 className="mt-5 text-xl font-bold text-primary">{p.name}</h2>
                  <p
                    className={[
                      "mt-2 inline-flex rounded-md px-3 py-1 text-xs font-black uppercase tracking-[0.14em]",
                      stockQuantity > 0
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-50 text-red-700",
                    ].join(" ")}
                  >
                    {stockQuantity > 0
                      ? `${stockQuantity} in stock`
                      : "Out of stock"}
                  </p>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-champagne/68">
                    {p.description || "Premium creator tool for studio work."}
                  </p>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <p className="text-2xl font-black text-accent">
                      NGN {p.price}
                    </p>
                    <AddToCartButton product={p} imageUrl={imageUrl} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
