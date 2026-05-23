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
  getProductImageRows,
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

const ROTATION_ROW_LABELS = [
  "Low angle row",
  "Straight angle row",
  "High angle row",
] as const;

const MAIN_IMAGE_COMPRESSION = {
  maxDimension: 1400,
  quality: 0.86,
};

const ROTATION_IMAGE_COMPRESSION = {
  maxDimension: 900,
  quality: 0.78,
};

type ImageCompressionOptions = {
  maxDimension: number;
  quality: number;
};

type LoadedImageSource = HTMLImageElement | ImageBitmap;

function createEmptyRotationImageRows() {
  return ROTATION_ROW_LABELS.map(() => [] as File[]);
}

function getCompressedFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") + ".webp";
}

function getImageSourceSize(source: LoadedImageSource) {
  if (source instanceof HTMLImageElement) {
    return {
      height: source.naturalHeight,
      width: source.naturalWidth,
    };
  }

  return {
    height: Number(source.height),
    width: Number(source.width),
  };
}

function loadImageSource(file: File): Promise<LoadedImageSource> {
  if ("createImageBitmap" in window) {
    return createImageBitmap(file);
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const imageUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("Could not read image."));
    };
    image.src = imageUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

async function compressImageFile(
  file: File,
  options: ImageCompressionOptions
) {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file;
  }

  const imageSource = await loadImageSource(file);
  const { height, width } = getImageSourceSize(imageSource);

  if (!height || !width) return file;

  const scale = Math.min(1, options.maxDimension / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) return file;

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  context.drawImage(imageSource, 0, 0, targetWidth, targetHeight);

  if (imageSource instanceof ImageBitmap) {
    imageSource.close();
  }

  const blob = await canvasToBlob(canvas, "image/webp", options.quality);

  if (!blob || blob.size >= file.size) {
    return file;
  }

  return new File([blob], getCompressedFileName(file.name), {
    lastModified: Date.now(),
    type: "image/webp",
  });
}

function sortFilesByName(files: File[]) {
  return [...files].sort((first, second) =>
    first.name.localeCompare(second.name, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
}

function countRotationRowFiles(rows: File[][]) {
  return rows.reduce((count, row) => count + row.length, 0);
}

function countRotationRows(rows?: string[][] | null) {
  return (rows || []).filter((row) => row.length > 0).length;
}

function getProductRotationPaths(product: Product) {
  return Array.from(
    new Set([
      ...(product.rotation_image_urls || []),
      ...(product.rotation_image_rows || []).flat(),
    ])
  );
}

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

  const [rotationImageRows, setRotationImageRows] = useState<File[][]>(
    createEmptyRotationImageRows
  );

  const [products, setProducts] = useState<Product[]>([]);

  const [orders, setOrders] = useState<Order[]>([]);

  const [ordersError, setOrdersError] = useState("");

  const [saving, setSaving] = useState(false);

  const [updatingProductId, setUpdatingProductId] = useState<Product["id"] | null>(
    null
  );

  const [productRotationRows, setProductRotationRows] = useState<
    Record<string, File[][]>
  >({});

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

  const getAdminAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      router.push("/login");
      throw new Error("Please log in again to manage orders.");
    }

    return token;
  }, [router]);

  // -----------------------------------
  // FETCH ORDERS
  // -----------------------------------
  const fetchOrders = useCallback(async () => {
    setOrdersError("");

    try {
      const token = await getAdminAccessToken();
      const response = await fetch("/api/admin/orders", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = (await response.json().catch(() => null)) as {
        orders?: Order[];
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(result?.error || "Could not load orders.");
      }

      setOrders(result?.orders || []);
    } catch (error) {
      setOrders([]);
      setOrdersError(
        error instanceof Error ? error.message : "Could not load orders."
      );
    }
  }, [getAdminAccessToken]);

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
  const uploadImageFile = async (
    file: File,
    compressionOptions: ImageCompressionOptions
  ) => {
    const { data: sessionData } =
      await supabase.auth.getSession();

    if (!sessionData.session) {
      await supabase.auth.signOut();

      throw new Error(
        "Please log in again before uploading."
      );
    }

    const formData = new FormData();
    const uploadFile = await compressImageFile(file, compressionOptions);

    formData.append("image", uploadFile);

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

    return uploadImageFile(image, MAIN_IMAGE_COMPRESSION);
  };

  const uploadRotationImageRows = async (rows: File[][]) => {
    const uploadedRows: string[][] = [];

    for (const row of rows) {
      const uploadedRow: string[] = [];

      for (const rotationImage of row) {
        uploadedRow.push(
          await uploadImageFile(rotationImage, ROTATION_IMAGE_COMPRESSION)
        );
      }

      if (uploadedRow.length > 0) {
        uploadedRows.push(uploadedRow);
      }
    }

    return uploadedRows;
  };

  const updateNewProductRotationRow = (rowIndex: number, files: File[]) => {
    setRotationImageRows((currentRows) =>
      currentRows.map((row, index) =>
        index === rowIndex ? sortFilesByName(files) : row
      )
    );
  };

  const updateExistingProductRotationRow = (
    productId: Product["id"],
    rowIndex: number,
    files: File[]
  ) => {
    const productKey = String(productId);

    setProductRotationRows((currentRows) => {
      const selectedRows =
        currentRows[productKey]?.map((row) => [...row]) ||
        createEmptyRotationImageRows();

      selectedRows[rowIndex] = sortFilesByName(files);

      return {
        ...currentRows,
        [productKey]: selectedRows,
      };
    });
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
    let rotationImageRowsPaths: string[][] = [];

    try {
      imagePath = await uploadImage();
      rotationImageRowsPaths = await uploadRotationImageRows(rotationImageRows);

      const { error } = await supabase
        .from("products")
        .insert([
          {
            name: form.name.trim(),
            price: Number(form.price),
            description: form.description.trim(),
            image_url: imagePath,
            rotation_image_urls: rotationImageRowsPaths.flat(),
            rotation_image_rows: rotationImageRowsPaths,
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
      setRotationImageRows(createEmptyRotationImageRows());

      fetchProducts();
    } catch (error) {
      const uploadedPaths = [imagePath, ...rotationImageRowsPaths.flat()].filter(
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
      ...getProductRotationPaths(product),
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
    rows: File[][]
  ) => {
    if (!countRotationRowFiles(rows) || updatingProductId) return;

    setUpdatingProductId(product.id);

    let newImageRows: string[][] = [];

    try {
      newImageRows = await uploadRotationImageRows(rows);

      const { error } = await supabase
        .from("products")
        .update({
          rotation_image_urls: newImageRows.flat(),
          rotation_image_rows: newImageRows,
        })
        .eq("id", product.id);

      if (error) {
        throw new Error(error.message);
      }

      const previousRotationPaths = getProductRotationPaths(product);

      if (previousRotationPaths.length) {
        await supabase.storage
          .from(PRODUCT_IMAGE_BUCKET)
          .remove(previousRotationPaths);
      }

      setProductRotationRows((currentRows) => {
        const nextRows = { ...currentRows };
        delete nextRows[String(product.id)];
        return nextRows;
      });

      await fetchProducts();
    } catch (error) {
      if (newImageRows.flat().length) {
        await supabase.storage
          .from(PRODUCT_IMAGE_BUCKET)
          .remove(newImageRows.flat());
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
      const token = await getAdminAccessToken();
      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          order_status: status,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        alert(result?.error || "Could not update order.");
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
    try {
      const token = await getAdminAccessToken();
      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          assigned_vendor: vendor,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        alert(result?.error || "Could not assign fulfillment.");
        return;
      }

      await fetchOrders();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Could not assign fulfillment."
      );
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
            Multi-row 360 photos
          </p>

          <div className="mb-2 grid gap-3 md:grid-cols-3">
            {ROTATION_ROW_LABELS.map((label, rowIndex) => (
              <label
                key={label}
                className="rounded-md border border-white/10 bg-black/25 p-3 text-sm"
              >
                <span className="mb-2 block font-semibold text-champagne/80">
                  {label}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) =>
                    updateNewProductRotationRow(
                      rowIndex,
                      Array.from(e.target.files || [])
                    )
                  }
                  className="w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-amber-200 file:px-3 file:py-2 file:font-bold file:text-black"
                />
                {rotationImageRows[rowIndex].length > 0 && (
                  <span className="mt-2 block text-xs text-champagne/60">
                    {rotationImageRows[rowIndex].length} photos selected
                  </span>
                )}
              </label>
            ))}
          </div>

          {countRotationRowFiles(rotationImageRows) > 0 && (
            <p className="mb-6 text-sm text-champagne/70">
              {countRotationRowFiles(rotationImageRows)} photos selected across{" "}
              {rotationImageRows.filter((row) => row.length > 0).length} rows
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
              const rotationImageRows = getProductImageRows(
                p.rotation_image_rows,
                p.rotation_image_urls
              );
              const selectedRotationRows =
                productRotationRows[String(p.id)] ||
                createEmptyRotationImageRows();
              const selectedRotationFileCount =
                countRotationRowFiles(selectedRotationRows);

              return (
                <div
                  key={p.id}
                  className="rounded-lg border border-white/10 bg-white/[0.045] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.24)]"
                >

                  <Product360Viewer
                    alt={p.name}
                    imageUrl={imageUrl}
                    frameUrls={rotationImageUrls}
                    frameRows={rotationImageRows}
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
                        : `${rotationImageRows.flat().length} photos in ${countRotationRows(
                            p.rotation_image_rows
                          ) || (rotationImageUrls.length ? 1 : 0)} rows`}
                    </p>

                    <div className="grid gap-3 md:grid-cols-3">
                      {ROTATION_ROW_LABELS.map((label, rowIndex) => (
                        <label
                          key={`${p.id}-${label}`}
                          className="rounded-md border border-white/10 bg-black/25 p-3 text-sm"
                        >
                          <span className="mb-2 block font-semibold text-champagne/80">
                            {label}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            disabled={Boolean(updatingProductId)}
                            onChange={(e) =>
                              updateExistingProductRotationRow(
                                p.id,
                                rowIndex,
                                Array.from(e.target.files || [])
                              )
                            }
                            className="w-full text-xs disabled:opacity-60 file:mr-3 file:rounded-md file:border-0 file:bg-amber-200 file:px-3 file:py-2 file:font-bold file:text-black"
                          />
                          {selectedRotationRows[rowIndex].length > 0 && (
                            <span className="mt-2 block text-xs text-champagne/60">
                              {selectedRotationRows[rowIndex].length} selected
                            </span>
                          )}
                        </label>
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={
                        Boolean(updatingProductId) ||
                        selectedRotationFileCount === 0
                      }
                      onClick={() =>
                        updateProductRotationImages(p, selectedRotationRows)
                      }
                      className="mt-3 rounded-md border border-amber-200/45 px-4 py-2 text-sm font-bold text-amber-100 transition hover:border-amber-100 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Replace 360 photos
                    </button>
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

          {ordersError && (
            <div className="mb-6 rounded-lg border border-red-300/30 bg-red-500/10 p-4 text-sm font-semibold text-red-100">
              {ordersError}
            </div>
          )}

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

            {orders.length === 0 && !ordersError ? (
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
