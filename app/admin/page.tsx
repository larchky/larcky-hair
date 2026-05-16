"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminPage() {
  const [form, setForm] = useState({
    name: "",
    price: "",
    description: "",
  });

  const [image, setImage] = useState<File | null>(null);

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const uploadImage = async () => {
    if (!image) return null;

    const fileName = `${Date.now()}-${image.name}`;

    const { data, error } = await supabase.storage
      .from("product-images")
      .upload(fileName, image);

    if (error) {
      alert(error.message);
      return null;
    }

    return data.path;
  };

  const handleSubmit = async () => {
    const imagePath = await uploadImage();

    const { error } = await supabase.from("products").insert([
      {
        name: form.name,
        price: Number(form.price),
        description: form.description,
        image_url: imagePath,
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Product added!");

    setForm({ name: "", price: "", description: "" });
    setImage(null);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Admin Page</h1>

      <input
        name="name"
        placeholder="Name"
        style={{
        border: "1px solid red",
        color: "white",
        background: "black",
        }}
        value={form.name}
        onChange={handleChange}
      />

      <input
        name="price"
        placeholder="Price"
        style={{
        border: "1px solid red",
        color: "white",
        background: "black",
        }}
        value={form.price}
        onChange={handleChange}
      />

      <input
        name="description"
        placeholder="Description"
        style={{
        border: "1px solid red",
        color: "white",
        background: "black",
        }}
        value={form.description}
        onChange={handleChange}
      />

      <input
        type="file"
        onChange={(e) => setImage(e.target.files?.[0] || null)}
      />

      <button onClick={handleSubmit}>
        Add Product
      </button>
    </div>
  );
}