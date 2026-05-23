"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiGrid, FiSearch } from "react-icons/fi";
import { supabase } from "@/lib/supabaseClient";
import {
  getProductImageUrl,
  getProductImageRows,
  getProductImageUrls,
  type Product,
} from "@/lib/productImages";
import BrandLogo from "@/app/components/BrandLogo";
import PayButton from "@/app/components/PayButton";
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
        <header className="flex flex-col justify-between gap-6 border-b border-white/10 pb-8 md:flex-row md:items-center">
          <BrandLogo compact />

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="w-fit rounded-md border border-amber-200/35 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-amber-100 transition hover:border-amber-100 hover:text-white"
            >
              Home
            </Link>
            <Link
              href="/reviews"
              className="w-fit rounded-md border border-white/15 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-champagne transition hover:border-amber-200/60 hover:text-white"
            >
              Reviews
            </Link>
          </div>
        </header>

        <section className="py-10">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.24em] text-amber-200">
            <FiGrid aria-hidden="true" />
            Catalog
          </p>
          <h1 className="mt-3 font-serif text-5xl font-bold text-white">
            Creator tools
          </h1>
          <label className="mt-8 flex max-w-2xl items-center gap-3 rounded-md border border-amber-200/25 bg-black/35 px-4 py-3 text-champagne shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
            <FiSearch className="shrink-0 text-amber-200" aria-hidden="true" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search all creator tools..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-champagne/38"
            />
          </label>
        </section>

        {products.length === 0 ? (
          <div className="border border-amber-200/20 bg-white/[0.04] p-8 text-center">
            <h2 className="text-2xl font-bold text-white">
              No products available
            </h2>
            <p className="mt-2 text-champagne/65">
              New cameras, lights, microphones, and kits will appear here.
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="border border-amber-200/20 bg-white/[0.04] p-8 text-center">
            <h2 className="text-2xl font-bold text-white">
              No matching products
            </h2>
            <p className="mt-2 text-champagne/65">
              Try searching for camera, tripod, mic, light, or kit.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((p) => {
              const imageUrl = getProductImageUrl(p.image_url);
              const rotationImageUrls = getProductImageUrls(
                p.rotation_image_urls
              );
              const rotationImageRows = getProductImageRows(
                p.rotation_image_rows,
                p.rotation_image_urls
              );

              return (
                <article
                  key={p.id}
                  className="border border-white/10 bg-white/[0.045] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.28)] transition hover:-translate-y-1 hover:border-amber-200/45"
                >
                  <Product360Viewer
                    alt={p.name}
                    imageUrl={imageUrl}
                    frameUrls={rotationImageUrls}
                    frameRows={rotationImageRows}
                    className="h-60 rounded-md"
                  />

                  <h2 className="mt-5 text-xl font-bold text-white">{p.name}</h2>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-champagne/68">
                    {p.description || "Premium creator tool for studio work."}
                  </p>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <p className="text-2xl font-black text-amber-200">
                      NGN {p.price}
                    </p>
                    <PayButton amount={Number(p.price)} productName={p.name} />
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
