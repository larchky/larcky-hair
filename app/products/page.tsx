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

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase.from("products").select("*");
      setProducts(data || []);
    };

    fetchProducts();
  }, []);

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <h1 className="mb-8 text-3xl font-bold text-pink-500">Products</h1>

      <div className="grid gap-6 md:grid-cols-3">
        {products.map((p) => {
          const imageUrl = getProductImageUrl(p.image_url);
          const rotationImageUrls = getProductImageUrls(p.rotation_image_urls);

          return (
            <div key={p.id} className="rounded-xl bg-zinc-900 p-4">
              <Product360Viewer
                alt={p.name}
                imageUrl={imageUrl}
                frameUrls={rotationImageUrls}
              />

              <h2 className="mt-4 font-semibold">{p.name}</h2>
              <p className="mt-2 text-gray-300">{p.description}</p>
              <p className="mt-2 text-pink-400">₦{p.price}</p>
              <div className="mt-4">
                <PayButton amount={Number(p.price)} productName={p.name} />
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
