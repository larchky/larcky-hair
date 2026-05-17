"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  getProductImageUrl,
  getProductImageUrls,
  PRODUCT_IMAGE_BUCKET,
  type Product,
} from "@/lib/productImages";
import Product360Viewer from "@/app/components/Product360Viewer";

const ADMIN_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const ADMIN_IDLE_CHECK_MS = 60 * 1000;
const ADMIN_LAST_ACTIVITY_KEY = "lacky-hair-admin-last-activity";

const ADMIN_ACTIVITY_EVENTS = [
  "click",
  "keydown",
  "mousemove",
  "scroll",
  "touchstart",
] as const;

type Order = {
  id: string;
  product_name: string;
  amount: number;
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  delivery_address: string | null;
  payment_status: string;
  transaction_id: string;
  order_status: string;
  assigned_vendor: string | null;
};

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: "",
    price: "",
    description: "",
  });

  const [image, setImage] = useState<File | null>(null);

  const [rotationImages, setRotationImages] = useState<File[]>([]);

  const [products, setProducts] = useState<Product[]>([]);

  const [orders, setOrders] = useState<Order[]>([]);

  const [saving, setSaving] = useState(false);

  const [updatingProductId, setUpdatingProductId] = useState<Product["id"] | null>(
    null
  );

  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // -----------------------------------
  // FETCH PRODUCTS
  // -----------------------------------
  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("id", { ascending: false });

    if (!error) {
      setProducts(data || []);
    }
  }, []);

  // -----------------------------------
  // FETCH ORDERS
  // -----------------------------------
  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) {
      setOrders(data || []);
    }
  }, []);

  // -----------------------------------
  // AUTH CHECK
  // -----------------------------------
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.push("/login");
        return;
      }

      await fetchProducts();
      await fetchOrders();

      setLoading(false);
    };

    checkUser();
  }, [fetchProducts, fetchOrders, router]);

  // -----------------------------------
  // INACTIVITY LOGOUT
  // -----------------------------------
  useEffect(() => {
    let signingOut = false;

    const getLastActivity = () => {
      const value = window.localStorage.getItem(
        ADMIN_LAST_ACTIVITY_KEY
      );

      const timestamp = value ? Number(value) : null;

      return timestamp && Number.isFinite(timestamp)
        ? timestamp
        : null;
    };

    const markActivity = () => {
      if (!signingOut) {
        window.localStorage.setItem(
          ADMIN_LAST_ACTIVITY_KEY,
          String(Date.now())
        );
      }
    };

    const signOutForInactivity = async () => {
      if (signingOut) return;

      signingOut = true;

      window.localStorage.removeItem(
        ADMIN_LAST_ACTIVITY_KEY
      );

      await supabase.auth.signOut();

      router.replace("/login");
    };

    const checkIdle = () => {
      const lastActivity = getLastActivity();

      if (!lastActivity) {
        markActivity();
        return false;
      }

      if (
        Date.now() - lastActivity >=
        ADMIN_IDLE_TIMEOUT_MS
      ) {
        void signOutForInactivity();
        return true;
      }

      return false;
    };

    const handleActivity = () => {
      if (!checkIdle()) {
        markActivity();
      }
    };

    const intervalId = window.setInterval(
      checkIdle,
      ADMIN_IDLE_CHECK_MS
    );

    checkIdle();

    ADMIN_ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(
        eventName,
        handleActivity
      );
    });

    window.addEventListener("focus", checkIdle);

    document.addEventListener(
      "visibilitychange",
      checkIdle
    );

    return () => {
      window.clearInterval(intervalId);

      ADMIN_ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(
          eventName,
          handleActivity
        );
      });

      window.removeEventListener("focus", checkIdle);

      document.removeEventListener(
        "visibilitychange",
        checkIdle
      );
    };
  }, [router]);

  // -----------------------------------
  // HANDLE INPUT
  // -----------------------------------
  const handleChange = (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // -----------------------------------
  // LOGOUT
  // -----------------------------------
  const handleLogout = async () => {
    window.localStorage.removeItem(
      ADMIN_LAST_ACTIVITY_KEY
    );

    await supabase.auth.signOut();

    router.replace("/login");
  };

  // -----------------------------------
  // UPLOAD IMAGE
  // -----------------------------------
  const uploadImageFile = async (file: File) => {
    const { data: sessionData } =
      await supabase.auth.getSession();

    if (!sessionData.session) {
      await supabase.auth.signOut();

      throw new Error(
        "Please log in again before uploading."
      );
    }

    const formData = new FormData();

    formData.append("image", file);

    const response = await fetch(
      "/api/admin/upload-product-image",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: formData,
      }
    );

    const result = (await response.json()) as {
      path?: string;
      error?: string;
    };

    if (!response.ok || !result.path) {
      throw new Error(
        result.error || "Image upload failed."
      );
    }

    return result.path;
  };

  const uploadImage = async () => {
    if (!image) return null;

    return uploadImageFile(image);
  };

  // -----------------------------------
  // ADD PRODUCT
  // -----------------------------------
  const handleSubmit = async () => {
    if (saving) return;

    if (!form.name.trim() || !form.price.trim()) {
      alert("Please enter product name and price.");
      return;
    }

    setSaving(true);

    let imagePath: string | null = null;
    const rotationImagePaths: string[] = [];

    try {
      imagePath = await uploadImage();

      for (const rotationImage of rotationImages) {
        rotationImagePaths.push(await uploadImageFile(rotationImage));
      }

      const { error } = await supabase
        .from("products")
        .insert([
          {
            name: form.name.trim(),
            price: Number(form.price),
            description: form.description.trim(),
            image_url: imagePath,
            rotation_image_urls: rotationImagePaths,
          },
        ]);

      if (error) {
        throw new Error(error.message);
      }

      alert("Product added!");

      setForm({
        name: "",
        price: "",
        description: "",
      });

      setImage(null);
      setRotationImages([]);

      fetchProducts();
    } catch (error) {
      const uploadedPaths = [imagePath, ...rotationImagePaths].filter(
        (path): path is string => Boolean(path)
      );

      if (uploadedPaths.length) {
        await supabase.storage
          .from(PRODUCT_IMAGE_BUCKET)
          .remove(uploadedPaths);
      }

      alert(
        error instanceof Error
          ? error.message
          : "Could not add product."
      );
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------
  // DELETE PRODUCT
  // -----------------------------------
  const deleteProduct = async (
    product: Product
  ) => {
    const confirmDelete = confirm(
      "Delete this product?"
    );

    if (!confirmDelete) return;

    const productImagePaths = [
      product.image_url,
      ...(product.rotation_image_urls || []),
    ].filter((path): path is string => Boolean(path));

    if (productImagePaths.length) {
      await supabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .remove(productImagePaths);
    }

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", product.id);

    if (error) {
      alert(error.message);
      return;
    }

    fetchProducts();
  };

  // -----------------------------------
  // UPDATE PRODUCT 360 PHOTOS
  // -----------------------------------
  const updateProductRotationImages = async (
    product: Product,
    files: File[]
  ) => {
    if (!files.length || updatingProductId) return;

    setUpdatingProductId(product.id);

    const newImagePaths: string[] = [];

    try {
      for (const file of files) {
        newImagePaths.push(await uploadImageFile(file));
      }

      const { error } = await supabase
        .from("products")
        .update({
          rotation_image_urls: newImagePaths,
        })
        .eq("id", product.id);

      if (error) {
        throw new Error(error.message);
      }

      if (product.rotation_image_urls?.length) {
        await supabase.storage
          .from(PRODUCT_IMAGE_BUCKET)
          .remove(product.rotation_image_urls);
      }

      await fetchProducts();
    } catch (error) {
      if (newImagePaths.length) {
        await supabase.storage
          .from(PRODUCT_IMAGE_BUCKET)
          .remove(newImagePaths);
      }

      alert(
        error instanceof Error
          ? error.message
          : "Could not update 360 photos."
      );
    } finally {
      setUpdatingProductId(null);
    }
  };

  // -----------------------------------
  // UPDATE ORDER STATUS
  // -----------------------------------
  const updateOrderStatus = async (
    id: string,
    status: string
  ) => {
    setUpdatingOrderId(id);

    try {
      const { error } = await supabase
        .from("orders")
        .update({
          order_status: status,
        })
        .eq("id", id);

      if (error) {
        alert(error.message);
        return;
      }

      await fetchOrders();
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // -----------------------------------
  // ASSIGN VENDOR
  // -----------------------------------
  const assignVendor = async (
    id: string,
    vendor: string
  ) => {
    const { error } = await supabase
      .from("orders")
      .update({
        assigned_vendor: vendor,
      })
      .eq("id", id);

    if (!error) {
      fetchOrders();
    }
  };

  // -----------------------------------
  // LOADING
  // -----------------------------------
  if (loading) {
    return (
      <div className="text-white bg-black min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  // -----------------------------------
  // UI
  // -----------------------------------
  return (
    <main className="min-h-screen bg-black text-white p-6">

      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="mb-6 flex items-center justify-between gap-4">

          <h1 className="text-3xl font-bold text-pink-500">
            Admin Dashboard
          </h1>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded bg-zinc-800 px-4 py-2 font-semibold text-pink-300 hover:bg-zinc-700"
          >
            Logout
          </button>

        </div>

        {/* ADD PRODUCT */}
        <div className="bg-zinc-900 p-6 rounded-xl">

          <h2 className="text-2xl font-bold text-pink-400 mb-6">
            Add Product
          </h2>

          <input
            name="name"
            placeholder="Product Name"
            value={form.name}
            onChange={handleChange}
            className="w-full mb-4 p-3 rounded bg-black border border-pink-500"
          />

          <input
            name="price"
            placeholder="Price"
            value={form.price}
            onChange={handleChange}
            className="w-full mb-4 p-3 rounded bg-black border border-pink-500"
          />

          <input
            name="description"
            placeholder="Description"
            value={form.description}
            onChange={handleChange}
            className="w-full mb-4 p-3 rounded bg-black border border-pink-500"
          />

          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              setImage(e.target.files?.[0] || null)
            }
            className="w-full mb-4"
          />

          <p className="mb-2 text-sm font-semibold text-pink-200">
            360 Photos (optional)
          </p>

          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) =>
              setRotationImages(Array.from(e.target.files || []))
            }
            className="w-full mb-2"
          />

          {rotationImages.length > 0 && (
            <p className="mb-6 text-sm text-zinc-300">
              {rotationImages.length} photos selected
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-pink-500 text-black py-3 rounded font-bold"
          >
            {saving ? "Adding..." : "Add Product"}
          </button>

        </div>

        {/* PRODUCTS */}
        <div className="mt-12">

          <h2 className="text-2xl font-bold mb-6 text-pink-400">
            Products
          </h2>

          <div className="grid md:grid-cols-2 gap-6">

            {products.map((p) => {
              const imageUrl = getProductImageUrl(
                p.image_url
              );
              const rotationImageUrls = getProductImageUrls(
                p.rotation_image_urls
              );

              return (
                <div
                  key={p.id}
                  className="border border-pink-500 p-4 rounded"
                >

                  <Product360Viewer
                    alt={p.name}
                    imageUrl={imageUrl}
                    frameUrls={rotationImageUrls}
                    className="mb-3"
                  />

                  <h3 className="font-bold text-lg">
                    {p.name}
                  </h3>

                  <p>{p.description}</p>

                  <p className="text-pink-400 mt-2">
                    ₦{p.price}
                  </p>

                  <button
                    onClick={() => deleteProduct(p)}
                    className="mt-4 bg-red-600 px-4 py-2 rounded"
                  >
                    Delete
                  </button>

                  <div className="mt-4 border-t border-zinc-700 pt-4">
                    <p className="mb-2 text-sm text-pink-200">
                      {updatingProductId === p.id
                        ? "Updating 360 photos..."
                        : `${rotationImageUrls.length} 360 photos`}
                    </p>

                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={Boolean(updatingProductId)}
                      onChange={async (e) => {
                        const input = e.currentTarget;
                        await updateProductRotationImages(
                          p,
                          Array.from(input.files || [])
                        );
                        input.value = "";
                      }}
                      className="w-full text-sm disabled:opacity-60"
                    />
                  </div>

                </div>
              );
            })}

          </div>

        </div>

        {/* ORDERS */}
        <div className="mt-12">

          <h2 className="text-2xl font-bold mb-6 text-pink-400">
            Orders
          </h2>

          <div className="space-y-6">

            {orders.map((order) => (
              <div
                key={order.id}
                className="border border-pink-500 p-6 rounded"
              >

                <h3 className="text-xl font-bold">
                  {order.product_name}
                </h3>

                <p className="mt-2">
                  Customer: {order.customer_name}
                </p>

                <p>
                  Email: {order.customer_email}
                </p>

                <p>
                  Phone: {order.customer_phone || "Not provided"}
                </p>

                <p>
                  Address: {order.delivery_address || "Not provided"}
                </p>

                <p>
                  Amount: ₦{order.amount}
                </p>

                <p>
                  Payment: {order.payment_status}
                </p>

                <p>
                  Status: {order.order_status || "processing"}
                </p>

                <p>
                  Vendor:{" "}
                  {order.assigned_vendor ||
                    "Not Assigned"}
                </p>

                {/* ASSIGN VENDOR */}
                <div className="flex gap-2 mt-4 flex-wrap">

                  <button
                    onClick={() =>
                      assignVendor(
                        order.id,
                        "Vendor A"
                      )
                    }
                    className="bg-blue-500 text-black px-4 py-2 rounded"
                  >
                    Assign Vendor A
                  </button>

                  <button
                    onClick={() =>
                      assignVendor(
                        order.id,
                        "Vendor B"
                      )
                    }
                    className="bg-green-500 text-black px-4 py-2 rounded"
                  >
                    Assign Vendor B
                  </button>

                </div>

                {/* UPDATE STATUS */}
                <div className="flex gap-2 mt-4 flex-wrap">

                  <button
                    onClick={() =>
                      updateOrderStatus(
                        order.id,
                        "processing"
                      )
                    }
                    disabled={
                      updatingOrderId === order.id ||
                      (order.order_status || "processing") === "processing"
                    }
                    className="bg-yellow-500 text-black px-4 py-2 rounded disabled:opacity-60"
                  >
                    Processing
                  </button>

                  <button
                    onClick={() =>
                      updateOrderStatus(
                        order.id,
                        "delivered"
                      )
                    }
                    disabled={
                      updatingOrderId === order.id ||
                      order.order_status === "delivered"
                    }
                    className="bg-pink-500 text-black px-4 py-2 rounded disabled:opacity-60"
                  >
                    {order.order_status === "delivered"
                      ? "Delivered"
                      : "Mark Delivered"}
                  </button>

                </div>

              </div>
            ))}

          </div>

        </div>

      </div>

    </main>
  );
}
