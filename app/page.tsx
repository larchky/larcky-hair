"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  getProductImageUrl,
  getProductImageUrls,
  type Product,
} from "@/lib/productImages";
import PayButton from "@/app/components/PayButton";
import Product360Viewer from "@/app/components/Product360Viewer";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);

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

      {/* PRODUCTS */}
      <section className="px-6 py-16">
        <h2 className="text-3xl font-bold text-pink-500 mb-6">
          Featured Products
        </h2>

        <div className="grid md:grid-cols-3 gap-6">

          {products.map((p) => {
            const imageUrl = getProductImageUrl(p.image_url);
            const rotationImageUrls = getProductImageUrls(
              p.rotation_image_urls
            );

            return (
              <div
                key={p.id}
                className="bg-zinc-900 p-4 rounded-xl"
              >

                {/* PRODUCT IMAGE */}
                <Product360Viewer
                  alt={p.name}
                  imageUrl={imageUrl}
                  frameUrls={rotationImageUrls}
                  className="rounded"
                />

                {/* PRODUCT NAME */}
                <h3 className="mt-4 font-semibold text-lg">
                  {p.name}
                </h3>

                {/* PRODUCT DESCRIPTION */}
                <p className="text-gray-400 mt-2">
                  {p.description}
                </p>

                {/* PRODUCT PRICE */}
                <p className="text-pink-400 mt-3 mb-4 text-xl font-bold">
                  ₦{p.price}
                </p>

                {/* PAYMENT BUTTON */}
                <PayButton
                  amount={Number(p.price)}
                  productName={p.name}
                />

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
