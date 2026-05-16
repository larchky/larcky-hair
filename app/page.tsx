"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*");

      if (!error) {
        setProducts(data || []);
      }
    };

    fetchProducts();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white">

      {/* HERO */}
      <section className="text-center px-6 py-20">
        <h1 className="text-5xl font-bold text-pink-500">
          LACKY HAIR
        </h1>

        <p className="mt-4 text-gray-300 text-lg">
          Luxury hair for confident queens 💖
        </p>

        <button className="mt-8 bg-pink-500 text-black px-6 py-3 rounded-full font-semibold">
          Shop Now
        </button>
      </section>

      {/* PRODUCTS (DYNAMIC) */}
      <section className="px-6 py-16">
        <h2 className="text-3xl font-bold text-pink-500 mb-6">
          Featured Products
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {products.map((p) => {
    const imageUrl = p.image_url
      ? supabase.storage
          .from("product-images")
          .getPublicUrl(p.image_url).data.publicUrl
      : null;

    return (
      <div key={p.id} className="bg-zinc-900 p-4 rounded-xl">

        {imageUrl && (
          <img
            src={imageUrl}
            className="h-40 w-full object-cover rounded"
          />
        )}

        <h3 className="mt-4 font-semibold">
          {p.name}
        </h3>

        <p className="text-pink-400">
          ₦{p.price}
        </p>

      </div>
    );
  })}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="text-center py-10 text-gray-500">
        © 2026 Lacky Hair. All rights reserved.
      </footer>

    </main>
  );
}