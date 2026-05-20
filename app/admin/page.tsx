"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiLogOut,
  FiPackage,
  FiShoppingBag,
  FiTruck,
} from "react-icons/fi";
import { supabase } from "@/lib/supabaseClient";
import {
  getProductImageUrl,
  getProductImageUrls,
  PRODUCT_IMAGE_BUCKET,
  type Product,
} from "@/lib/productImages";
import BrandLogo from "@/app/components/BrandLogo";
import Product360Viewer from "@/app/components/Product360Viewer";

const ADMIN_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const ADMIN_IDLE_CHECK_MS = 60 * 1000;
const ADMIN_LAST_ACTIVITY_KEY = "dolapo-admin-last-activity";

const ADMIN_ACTIVITY_EVENTS = [
  "click",
  "keydown",
  "mousemove",
  "scroll",
  "touchstart",
] as const;

type Order = {
  id: string;
  created_at: string;
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

function formatOrderDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

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

  const deliveredOrderCount = orders.filter(
    (order) => order.order_status === "delivered"
  ).length;
  const processingOrderCount = orders.length - deliveredOrderCount;
  const totalOrderValue = orders.reduce(
    (total, order) => total + Number(order.amount || 0),
    0
  );

  // -----------------------------------
  // LOADING
  // -----------------------------------
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-studio text-champagne">
        Loading...
      </div>
    );
  }

  // -----------------------------------
  // UI
  // -----------------------------------
  return (
    <main className="min-h-screen bg-studio p-5 text-champagne sm:p-8">

      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="mb-8 flex flex-col justify-between gap-5 border-b border-white/10 pb-6 md:flex-row md:items-center">

          <BrandLogo compact />

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex w-fit items-center gap-2 rounded-md border border-amber-200/35 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-amber-100 transition hover:border-amber-100 hover:text-white"
          >
            <FiLogOut aria-hidden="true" />
            Logout
          </button>

        </div>

        {/* ADD PRODUCT */}
        <div className="rounded-lg border border-amber-200/20 bg-white/[0.045] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.32)]">

          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.22em] text-amber-200">
            <FiPackage aria-hidden="true" />
            Inventory
          </p>

          <h2 className="mt-2 text-3xl font-bold text-white">
            Add creator tool
          </h2>

          <input
            name="name"
            placeholder="Tool name"
            value={form.name}
            onChange={handleChange}
            className="mb-4 w-full rounded-md border border-amber-200/30 bg-black/45 p-3 text-white outline-none transition placeholder:text-champagne/35 focus:border-amber-200"
          />

          <input
            name="price"
            placeholder="Price"
            value={form.price}
            onChange={handleChange}
            className="mb-4 w-full rounded-md border border-amber-200/30 bg-black/45 p-3 text-white outline-none transition placeholder:text-champagne/35 focus:border-amber-200"
          />

          <input
            name="description"
            placeholder="Short product description"
            value={form.description}
            onChange={handleChange}
            className="mb-4 w-full rounded-md border border-amber-200/30 bg-black/45 p-3 text-white outline-none transition placeholder:text-champagne/35 focus:border-amber-200"
          />

          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              setImage(e.target.files?.[0] || null)
            }
            className="mb-4 w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-amber-200 file:px-4 file:py-2 file:font-bold file:text-black"
          />

          <p className="mb-2 text-sm font-semibold text-amber-100">
            360 photos
          </p>

          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) =>
              setRotationImages(Array.from(e.target.files || []))
            }
            className="mb-2 w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-amber-200 file:px-4 file:py-2 file:font-bold file:text-black"
          />

          {rotationImages.length > 0 && (
            <p className="mb-6 text-sm text-champagne/70">
              {rotationImages.length} photos selected
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full rounded-md bg-amber-200 py-3 font-black uppercase tracking-[0.14em] text-black transition hover:bg-white disabled:opacity-60"
          >
            {saving ? "Adding..." : "Add Tool"}
          </button>

        </div>

        {/* PRODUCTS */}
        <div className="mt-12">

          <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold text-white">
            <FiShoppingBag className="text-amber-200" aria-hidden="true" />
            Products
          </h2>

          <div className="grid gap-5 md:grid-cols-2">

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
                  className="rounded-lg border border-white/10 bg-white/[0.045] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.24)]"
                >

                  <Product360Viewer
                    alt={p.name}
                    imageUrl={imageUrl}
                    frameUrls={rotationImageUrls}
                    className="mb-4 h-56"
                  />

                  <h3 className="text-lg font-bold text-white">
                    {p.name}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-champagne/68">
                    {p.description || "Premium creator tool for studio work."}
                  </p>

                  <p className="mt-3 text-2xl font-black text-amber-200">
                    ₦{p.price}
                  </p>

                  <button
                    onClick={() => deleteProduct(p)}
                    className="mt-4 rounded-md bg-red-500 px-4 py-2 font-bold text-white transition hover:bg-red-400"
                  >
                    Delete
                  </button>

                  <div className="mt-4 border-t border-white/10 pt-4">
                    <p className="mb-2 text-sm font-semibold text-amber-100">
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
                      className="w-full text-sm disabled:opacity-60 file:mr-4 file:rounded-md file:border-0 file:bg-amber-200 file:px-4 file:py-2 file:font-bold file:text-black"
                    />
                  </div>

                </div>
              );
            })}

          </div>

        </div>

        {/* ORDERS */}
        <div className="mt-12">

          <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold text-white">
            <FiTruck className="text-amber-200" aria-hidden="true" />
            Orders
          </h2>

          <div className="mb-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-champagne/70">
                <FiCreditCard className="text-amber-200" aria-hidden="true" />
                Paid orders
              </p>
              <p className="mt-2 text-3xl font-black text-white">
                {orders.length}
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-champagne/70">
                <FiClock className="text-amber-200" aria-hidden="true" />
                Processing
              </p>
              <p className="mt-2 text-3xl font-black text-white">
                {processingOrderCount}
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-champagne/70">
                <FiCheckCircle className="text-amber-200" aria-hidden="true" />
                Delivered
              </p>
              <p className="mt-2 text-3xl font-black text-white">
                {deliveredOrderCount}
              </p>
              <p className="mt-1 text-sm text-champagne/55">
                NGN {totalOrderValue.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="space-y-6">

            {orders.length === 0 ? (
              <div className="rounded-lg border border-amber-200/20 bg-white/[0.04] p-8 text-center">
                <h3 className="text-2xl font-bold text-white">
                  No paid orders yet
                </h3>
                <p className="mx-auto mt-2 max-w-lg text-champagne/65">
                  Successful Flutterwave payments will appear here after the
                  transaction is verified.
                </p>
              </div>
            ) : (
              orders.map((order) => {
                const isDelivered = order.order_status === "delivered";

                return (
                  <div
                    key={order.id}
                    className="rounded-lg border border-white/10 bg-white/[0.045] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.24)]"
                  >

                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">
                          Order report
                        </p>
                        <h3 className="mt-2 text-2xl font-bold text-white">
                          {order.product_name}
                        </h3>
                        <p className="mt-1 text-sm text-champagne/55">
                          {formatOrderDate(order.created_at)}
                        </p>
                      </div>

                      <span
                        className={[
                          "inline-flex w-fit items-center gap-2 rounded-md px-3 py-2 text-sm font-black uppercase tracking-[0.12em]",
                          isDelivered
                            ? "bg-emerald-300 text-emerald-950"
                            : "bg-amber-200 text-black",
                        ].join(" ")}
                      >
                        {isDelivered ? (
                          <FiCheckCircle aria-hidden="true" />
                        ) : (
                          <FiClock aria-hidden="true" />
                        )}
                        {isDelivered ? "Delivered" : "Processing"}
                      </span>
                    </div>

                    <dl className="mt-6 grid gap-x-6 gap-y-4 md:grid-cols-2">
                      <div>
                        <dt className="text-xs font-black uppercase tracking-[0.18em] text-champagne/45">
                          Customer
                        </dt>
                        <dd className="mt-1 text-white">
                          {order.customer_name}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-black uppercase tracking-[0.18em] text-champagne/45">
                          Amount
                        </dt>
                        <dd className="mt-1 font-black text-amber-200">
                          NGN {Number(order.amount || 0).toLocaleString()}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-black uppercase tracking-[0.18em] text-champagne/45">
                          Email
                        </dt>
                        <dd className="mt-1 break-words text-champagne/78">
                          {order.customer_email}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-black uppercase tracking-[0.18em] text-champagne/45">
                          Phone
                        </dt>
                        <dd className="mt-1 text-champagne/78">
                          {order.customer_phone || "Not provided"}
                        </dd>
                      </div>

                      <div className="md:col-span-2">
                        <dt className="text-xs font-black uppercase tracking-[0.18em] text-champagne/45">
                          Delivery address
                        </dt>
                        <dd className="mt-1 text-champagne/78">
                          {order.delivery_address || "Not provided"}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-black uppercase tracking-[0.18em] text-champagne/45">
                          Transaction
                        </dt>
                        <dd className="mt-1 break-all text-champagne/78">
                          {order.transaction_id}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-black uppercase tracking-[0.18em] text-champagne/45">
                          Payment
                        </dt>
                        <dd className="mt-1 text-champagne/78">
                          {order.payment_status}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-black uppercase tracking-[0.18em] text-champagne/45">
                          Fulfillment
                        </dt>
                        <dd className="mt-1 text-champagne/78">
                          {order.assigned_vendor || "Not assigned"}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5">
                      <button
                        onClick={() =>
                          assignVendor(
                            order.id,
                            "Studio Desk A"
                          )
                        }
                        className="rounded-md bg-signal px-4 py-2 font-bold text-black"
                      >
                        Assign Desk A
                      </button>

                      <button
                        onClick={() =>
                          assignVendor(
                            order.id,
                            "Studio Desk B"
                          )
                        }
                        className="rounded-md bg-amber-200 px-4 py-2 font-bold text-black"
                      >
                        Assign Desk B
                      </button>

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
                        className="rounded-md border border-amber-200/45 px-4 py-2 font-bold text-amber-100 disabled:opacity-60"
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
                        className="inline-flex items-center gap-2 rounded-md bg-amber-200 px-4 py-2 font-bold text-black disabled:opacity-60"
                      >
                        <FiCheckCircle aria-hidden="true" />
                        {order.order_status === "delivered"
                          ? "Delivered"
                          : "Mark Delivered"}
                      </button>
                    </div>

                  </div>
                );
              })
            )}

          </div>

        </div>

      </div>

    </main>
  );
}
