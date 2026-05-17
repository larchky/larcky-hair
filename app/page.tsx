"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  FiCamera,
  FiCreditCard,
  FiMic,
  FiSearch,
  FiShield,
  FiTruck,
} from "react-icons/fi";
import { supabase } from "@/lib/supabaseClient";
import {
  getProductImageUrl,
  getProductImageUrls,
  type Product,
} from "@/lib/productImages";
import BrandLogo from "@/app/components/BrandLogo";
import PayButton from "@/app/components/PayButton";
import Product360Viewer from "@/app/components/Product360Viewer";

const categories = [
  "Cameras",
  "Ring lights",
  "Microphones",
  "Tripods",
  "Phone rigs",
  "Creator kits",
];

const promises = [
  {
    icon: FiShield,
    label: "Studio-tested gear",
  },
  {
    icon: FiTruck,
    label: "Fast local delivery",
  },
  {
    icon: FiCreditCard,
    label: "Secure checkout",
  },
];

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase.from("products").select("*");

      if (!error) {
        setProducts(data || []);
      }
    };

    fetchProducts();
  }, []);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    const searchableText = `${product.name} ${product.description || ""}`;
    return searchableText.toLowerCase().includes(normalizedSearch);
  });
  const featuredProducts = filteredProducts.slice(0, 6);
  const hasMoreProducts = filteredProducts.length > featuredProducts.length;

  return (
    <main className="min-h-screen overflow-hidden bg-studio text-champagne">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <BrandLogo compact />

        <nav className="hidden items-center gap-6 text-sm font-semibold text-champagne/75 md:flex">
          <a className="transition hover:text-amber-200" href="#catalog">
            Shop
          </a>
          <Link className="transition hover:text-amber-200" href="/products">
            Products
          </Link>
          <Link className="transition hover:text-amber-200" href="/reviews">
            Reviews
          </Link>
          <Link className="transition hover:text-amber-200" href="/login">
            Admin
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto grid w-full max-w-7xl gap-10 px-5 pb-12 pt-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="absolute right-[-18rem] top-[-12rem] h-[44rem] w-[44rem] rounded-full border border-amber-200/10 bg-amber-200/5 blur-3xl" />

        <div className="relative z-10">
          <p className="mb-4 inline-flex items-center gap-2 rounded-md border border-amber-200/25 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-[0.24em] text-amber-200">
            <FiCamera aria-hidden="true" />
            Tools to create
          </p>

          <h1 className="max-w-3xl font-serif text-4xl font-bold leading-[1.02] text-white sm:text-5xl lg:text-6xl">
            Creator gear with a premium studio finish.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-champagne/78">
            Shop cameras, lights, microphones, tripods, and mobile rigs curated
            for creators who need sharp visuals, clean audio, and a setup that
            looks as good as it performs.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#catalog"
              className="rounded-md bg-amber-200 px-6 py-3 text-sm font-black uppercase tracking-[0.16em] text-black shadow-[0_16px_34px_rgba(247,216,121,0.22)] transition hover:bg-white"
            >
              Shop Gear
            </a>
            <Link
              href="/products"
              className="rounded-md border border-white/18 px-6 py-3 text-sm font-bold uppercase tracking-[0.16em] text-champagne transition hover:border-amber-200 hover:text-amber-100"
            >
              View Catalog
            </Link>
            <Link
              href="/reviews"
              className="rounded-md border border-white/18 px-6 py-3 text-sm font-bold uppercase tracking-[0.16em] text-champagne transition hover:border-amber-200 hover:text-amber-100"
            >
              Reviews
            </Link>
          </div>

          <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
            {promises.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="flex items-center gap-3 border-l border-amber-200/30 bg-white/[0.03] px-4 py-3"
                >
                  <Icon className="text-amber-200" aria-hidden="true" />
                  <span className="text-sm font-semibold text-champagne/82">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 min-h-[21rem]">
          <Image
            src="/api/logo"
            alt="Dolapo creator tools logo"
            width={560}
            height={560}
            priority
            unoptimized
            className="mx-auto w-full max-w-[25rem] drop-shadow-[0_30px_54px_rgba(0,0,0,0.65)]"
          />

          <div className="absolute bottom-4 left-1/2 flex w-[min(92%,25rem)] -translate-x-1/2 items-center justify-between rounded-md border border-amber-200/30 bg-black/72 px-4 py-3 text-sm shadow-2xl backdrop-blur">
            <span className="font-semibold text-amber-100">Ready-made kits</span>
            <span className="text-champagne/70">shoot, stream, record</span>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-black/28 px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-3">
          {categories.map((category) => (
            <span
              key={category}
              className="rounded-md border border-white/12 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-champagne/78"
            >
              {category}
            </span>
          ))}
        </div>
      </section>

      <section id="catalog" className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-200">
              Featured Stock
            </p>
            <h2 className="mt-2 font-serif text-4xl font-bold text-white">
              Creator tools for every setup
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-champagne/68">
            From pocket rigs to studio kits, every listing is curated for
            creators who want dependable tools and a sharper final image.
          </p>
        </div>

        <label className="mb-8 flex max-w-xl items-center gap-3 rounded-md border border-amber-200/25 bg-black/35 px-4 py-3 text-champagne shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
          <FiSearch className="shrink-0 text-amber-200" aria-hidden="true" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search cameras, microphones, lights..."
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-champagne/38"
          />
        </label>

        {products.length === 0 ? (
          <div className="border border-amber-200/20 bg-white/[0.04] p-8 text-center">
            <FiMic className="mx-auto text-4xl text-amber-200" aria-hidden="true" />
            <h3 className="mt-4 text-2xl font-bold text-white">
              No creator tools listed yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-champagne/65">
              Once products are added, cameras, lights, microphones, and kits
              will appear here.
            </p>
          </div>
        ) : featuredProducts.length === 0 ? (
          <div className="border border-amber-200/20 bg-white/[0.04] p-8 text-center">
            <h3 className="text-2xl font-bold text-white">
              No matching products
            </h3>
            <p className="mx-auto mt-2 max-w-md text-champagne/65">
              Try searching for camera, tripod, mic, light, or kit.
            </p>
          </div>
        ) : (
          <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {featuredProducts.map((p) => {
              const imageUrl = getProductImageUrl(p.image_url);
              const rotationImageUrls = getProductImageUrls(
                p.rotation_image_urls
              );

              return (
                <article
                  key={p.id}
                  className="group border border-white/10 bg-white/[0.045] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.28)] transition hover:-translate-y-1 hover:border-amber-200/45"
                >
                  <Product360Viewer
                    alt={p.name}
                    imageUrl={imageUrl}
                    frameUrls={rotationImageUrls}
                    className="h-60 rounded-md"
                  />

                  <div className="mt-5">
                    <h3 className="text-xl font-bold text-white">{p.name}</h3>
                    <p className="mt-2 min-h-12 text-sm leading-6 text-champagne/68">
                      {p.description || "Premium creator tool for studio work."}
                    </p>
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <p className="text-2xl font-black text-amber-200">
                        NGN {p.price}
                      </p>
                      <PayButton amount={Number(p.price)} productName={p.name} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {hasMoreProducts && (
            <div className="mt-8 text-center">
              <Link
                href="/products"
                className="inline-flex rounded-md border border-amber-200/35 px-5 py-3 text-sm font-bold uppercase tracking-[0.14em] text-amber-100 transition hover:border-amber-100 hover:text-white"
              >
                View All Products
              </Link>
            </div>
          )}
          </>
        )}
      </section>

      <footer className="border-t border-white/10 px-5 py-8 text-center text-sm text-champagne/55 sm:px-8">
        Copyright 2026 Dolapo. Tools to create. Content that connects.
      </footer>
    </main>
  );
}
