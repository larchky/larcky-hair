import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data: products } = await supabase.from("products").select("*");

  return (
    <main className="bg-black min-h-screen text-white p-6">
      <h1 className="text-3xl font-bold text-pink-400">
        Lacky Hair
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {products?.map((p) => (
          <div key={p.id} className="bg-gray-900 p-3 rounded-xl">
            <img src={p.image_url} className="rounded-lg" />
            <h2 className="text-pink-300 mt-2">{p.name}</h2>
            <p>${p.price}</p>
            <button className="bg-pink-500 w-full mt-2 py-1 rounded">
              Buy
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}