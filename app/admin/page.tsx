"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  FiChevronDown,
  FiChevronUp,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiLogOut,
  FiPackage,
  FiShoppingBag,
  FiTrash2,
  FiTruck,
} from "react-icons/fi";
import { supabase } from "@/lib/supabaseClient";
import {
  getProductImageUrl,
  getProductImageRows,
  getProductImageUrls,
  getProductStock,
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
    stockQuantity: "",
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

  const [updatingStockProductId, setUpdatingStockProductId] = useState<
    Product["id"] | null
  >(null);

  const [productRotationRows, setProductRotationRows] = useState<
    Record<string, File[][]>
  >({});

  const [productStockForms, setProductStockForms] = useState<
    Record<string, string>
  >({});

  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

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

  const updateProductStock = async (product: Product) => {
    if (updatingStockProductId) return;

    const productKey = String(product.id);
    const stockQuantity = Number(
      productStockForms[productKey] ?? getProductStock(product)
    );

    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      alert("Please enter a whole number for items in stock.");
      return;
    }

    setUpdatingStockProductId(product.id);

    try {
      const { error } = await supabase
        .from("products")
        .update({
          stock_quantity: stockQuantity,
        })
        .eq("id", product.id);

      if (error) {
        throw new Error(error.message);
      }

      setProductStockForms((currentForms) => {
        const nextForms = { ...currentForms };
        delete nextForms[productKey];
        return nextForms;
      });

      await fetchProducts();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Could not update stock."
      );
    } finally {
      setUpdatingStockProductId(null);
    }
  };

  // -----------------------------------
  // ADD PRODUCT
  // -----------------------------------
  const handleSubmit = async () => {
    if (saving) return;

    if (!form.name.trim() || !form.price.trim() || !form.stockQuantity.trim()) {
      alert("Please enter product name, price, and stock quantity.");
      return;
    }

    const price = Number(form.price);
    const stockQuantity = Number(form.stockQuantity);

    if (!Number.isFinite(price) || price <= 0) {
      alert("Please enter a valid product price.");
      return;
    }

    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      alert("Please enter a whole number for items in stock.");
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
            price,
            stock_quantity: stockQuantity,
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
        stockQuantity: "",
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

  // -----------------------------------
  // DELETE ORDER
  // -----------------------------------
  const deleteOrder = async (order: Order) => {
    const confirmDelete = confirm(
      `Delete order for ${order.customer_name || order.product_name}?`
    );

    if (!confirmDelete || deletingOrderId) return;

    setDeletingOrderId(order.id);

    try {
      const token = await getAdminAccessToken();
      const response = await fetch("/api/admin/orders", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: order.id,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        alert(result?.error || "Could not delete order.");
        return;
      }

      setExpandedOrderId((currentOrderId) =>
        currentOrderId === order.id ? null : currentOrderId
      );

      await fetchOrders();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not delete order.");
    } finally {
      setDeletingOrderId(null);
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
        <div className="mb-8 flex flex-col justify-between gap-5 border-b border-[#eadbb8] pb-6 md:flex-row md:items-center">

          <BrandLogo compact />

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex w-fit items-center gap-2 rounded-md border border-accent/45 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-[#8c6518] transition hover:border-accent hover:text-primary"
          >
            <FiLogOut aria-hidden="true" />
            Logout
          </button>

        </div>

        {/* ADD PRODUCT */}
        <div className="rounded-lg border border-accent/25 bg-white/90 p-6 shadow-[0_30px_80px_rgba(99,69,22,0.14)]">

          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.22em] text-accent">
            <FiPackage aria-hidden="true" />
            Inventory
          </p>

          <h2 className="mt-2 text-3xl font-bold text-primary">
            Add creator tool
          </h2>

          <input
            name="name"
            placeholder="Tool name"
            value={form.name}
            onChange={handleChange}
            className="mb-4 w-full rounded-md border border-accent/35 bg-white/90 p-3 text-primary outline-none transition placeholder:text-champagne/45 focus:border-accent"
          />

          <input
            name="price"
            type="number"
            min="0"
            step="1"
            placeholder="Price"
            value={form.price}
            onChange={handleChange}
            className="mb-4 w-full rounded-md border border-accent/35 bg-white/90 p-3 text-primary outline-none transition placeholder:text-champagne/45 focus:border-accent"
          />

          <input
            name="stockQuantity"
            type="number"
            min="0"
            step="1"
            placeholder="Items in stock"
            value={form.stockQuantity}
            onChange={handleChange}
            className="mb-4 w-full rounded-md border border-accent/35 bg-white/90 p-3 text-primary outline-none transition placeholder:text-champagne/45 focus:border-accent"
          />

          <input
            name="description"
            placeholder="Short product description"
            value={form.description}
            onChange={handleChange}
            className="mb-4 w-full rounded-md border border-accent/35 bg-white/90 p-3 text-primary outline-none transition placeholder:text-champagne/45 focus:border-accent"
          />

          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              setImage(e.target.files?.[0] || null)
            }
            className="mb-4 w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-accent file:px-4 file:py-2 file:font-bold file:text-primary"
          />

          <p className="mb-2 text-sm font-semibold text-[#8c6518]">
            Multi-row 360 photos
          </p>

          <div className="mb-2 grid gap-3 md:grid-cols-3">
            {ROTATION_ROW_LABELS.map((label, rowIndex) => (
              <label
                key={label}
                className="rounded-md border border-[#eadbb8] bg-[#fff8ea] p-3 text-sm"
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
                  className="w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:font-bold file:text-primary"
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
            className="w-full rounded-md bg-accent py-3 font-black uppercase tracking-[0.14em] text-primary transition hover:bg-[#ddb357] disabled:opacity-60"
          >
            {saving ? "Adding..." : "Add Tool"}
          </button>

        </div>

        {/* PRODUCTS */}
        <div className="mt-12">

          <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold text-primary">
            <FiShoppingBag className="text-accent" aria-hidden="true" />
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
              const stockQuantity = getProductStock(p);
              const productStockValue =
                productStockForms[String(p.id)] ?? String(stockQuantity);

              return (
                <div
                  key={p.id}
                  className="rounded-lg border border-[#eadbb8] bg-white/90 p-4 shadow-[0_18px_45px_rgba(99,69,22,0.10)]"
                >

                  <Product360Viewer
                    alt={p.name}
                    imageUrl={imageUrl}
                    frameUrls={rotationImageUrls}
                    frameRows={rotationImageRows}
                    className="mb-4 h-56"
                  />

                  <h3 className="text-lg font-bold text-primary">
                    {p.name}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-champagne/68">
                    {p.description || "Premium creator tool for studio work."}
                  </p>

                  <p className="mt-3 text-2xl font-black text-accent">
                    ₦{p.price}
                  </p>

                  <p
                    className={[
                      "mt-3 inline-flex rounded-md px-3 py-1 text-xs font-black uppercase tracking-[0.14em]",
                      stockQuantity > 0
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-50 text-red-700",
                    ].join(" ")}
                  >
                    {stockQuantity > 0
                      ? `${stockQuantity} in stock`
                      : "Out of stock"}
                  </p>

                  <div className="mt-4 flex flex-col gap-3 rounded-md border border-[#eadbb8] bg-[#fff8ea] p-3 sm:flex-row sm:items-end">
                    <label className="flex-1 text-sm font-semibold text-champagne/80">
                      <span className="mb-2 block">Items in stock</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={productStockValue}
                        onChange={(e) =>
                          setProductStockForms((currentForms) => ({
                            ...currentForms,
                            [String(p.id)]: e.target.value,
                          }))
                        }
                        className="w-full rounded-md border border-accent/35 bg-white/90 p-3 text-primary outline-none transition focus:border-accent"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={Boolean(updatingStockProductId)}
                      onClick={() => updateProductStock(p)}
                      className="rounded-md border border-accent/55 px-4 py-3 text-sm font-bold text-[#8c6518] transition hover:border-accent hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {updatingStockProductId === p.id
                        ? "Updating..."
                        : "Update Stock"}
                    </button>
                  </div>

                  <button
                    onClick={() => deleteProduct(p)}
                    className="mt-4 rounded-md bg-red-500 px-4 py-2 font-bold text-white transition hover:bg-red-400"
                  >
                    Delete
                  </button>

                  <div className="mt-4 border-t border-[#eadbb8] pt-4">
                    <p className="mb-2 text-sm font-semibold text-[#8c6518]">
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
                          className="rounded-md border border-[#eadbb8] bg-[#fff8ea] p-3 text-sm"
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
                            className="w-full text-xs disabled:opacity-60 file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:font-bold file:text-primary"
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
                      className="mt-3 rounded-md border border-accent/55 px-4 py-2 text-sm font-bold text-[#8c6518] transition hover:border-accent hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
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

          <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold text-primary">
            <FiTruck className="text-accent" aria-hidden="true" />
            Orders
          </h2>

          {ordersError && (
            <div className="mb-6 rounded-lg border border-red-300/30 bg-red-500/10 p-4 text-sm font-semibold text-red-100">
              {ordersError}
            </div>
          )}

          <div className="mb-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-[#eadbb8] bg-white/90 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-champagne/70">
                <FiCreditCard className="text-accent" aria-hidden="true" />
                Paid orders
              </p>
              <p className="mt-2 text-3xl font-black text-primary">
                {orders.length}
              </p>
            </div>

            <div className="rounded-lg border border-[#eadbb8] bg-white/90 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-champagne/70">
                <FiClock className="text-accent" aria-hidden="true" />
                Processing
              </p>
              <p className="mt-2 text-3xl font-black text-primary">
                {processingOrderCount}
              </p>
            </div>

            <div className="rounded-lg border border-[#eadbb8] bg-white/90 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-champagne/70">
                <FiCheckCircle className="text-accent" aria-hidden="true" />
                Delivered
              </p>
              <p className="mt-2 text-3xl font-black text-primary">
                {deliveredOrderCount}
              </p>
              <p className="mt-1 text-sm text-champagne/55">
                NGN {totalOrderValue.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="space-y-4">

            {orders.length === 0 && !ordersError ? (
              <div className="rounded-lg border border-accent/25 bg-white/85 p-8 text-center">
                <h3 className="text-2xl font-bold text-primary">
                  No paid orders yet
                </h3>
                <p className="mx-auto mt-2 max-w-lg text-champagne/65">
                  Successful Flutterwave payments will appear here after the
                  transaction is verified.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-[#eadbb8] bg-white/90 shadow-[0_18px_45px_rgba(99,69,22,0.10)]">
                <div className="border-b border-[#eadbb8] px-4 py-4">
                  <h3 className="text-xl font-bold text-primary">
                    Order list
                  </h3>
                  <p className="mt-1 text-sm text-champagne/65">
                    Brief order details are shown here. Open an order to view
                    the full report.
                  </p>
                </div>

                <div className="divide-y divide-[#eadbb8]">
                  {orders.map((order) => {
                    const isDelivered = order.order_status === "delivered";
                    const isExpanded = expandedOrderId === order.id;
                    const isDeleting = deletingOrderId === order.id;
                    const isUpdating = updatingOrderId === order.id;

                    return (
                      <article key={order.id} className="p-4">
                        <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
                          <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.85fr)_auto] md:items-center">
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">
                                {formatOrderDate(order.created_at)}
                              </p>
                              <h4 className="mt-2 text-lg font-bold text-primary">
                                {order.product_name}
                              </h4>
                              <p className="mt-1 text-sm text-champagne/70">
                                {order.customer_name}
                              </p>
                            </div>

                            <div>
                              <p className="font-black text-accent">
                                NGN {Number(order.amount || 0).toLocaleString()}
                              </p>
                              <p className="mt-1 text-sm text-champagne/65">
                                {order.customer_phone || "No phone provided"}
                              </p>
                            </div>

                            <span
                              className={[
                                "inline-flex w-fit items-center gap-2 rounded-md px-3 py-2 text-sm font-black uppercase tracking-[0.12em]",
                                isDelivered
                                  ? "bg-emerald-300 text-emerald-950"
                                  : "bg-accent text-primary",
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

                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            onClick={() =>
                              setExpandedOrderId((currentOrderId) =>
                                currentOrderId === order.id ? null : order.id
                              )
                            }
                            className="inline-flex w-fit items-center justify-center gap-2 rounded-md border border-accent/55 px-4 py-2 text-sm font-bold uppercase tracking-[0.12em] text-[#8c6518] transition hover:border-accent hover:text-primary"
                          >
                            {isExpanded ? (
                              <FiChevronUp aria-hidden="true" />
                            ) : (
                              <FiChevronDown aria-hidden="true" />
                            )}
                            {isExpanded ? "Hide Details" : "View Details"}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="mt-5 rounded-md border border-[#eadbb8] bg-[#fff8ea] p-4">
                            <div className="flex flex-col justify-between gap-3 border-b border-[#eadbb8] pb-4 sm:flex-row sm:items-start">
                              <div>
                                <p className="text-xs font-black uppercase tracking-[0.22em] text-accent">
                                  Order report
                                </p>
                                <h4 className="mt-2 text-2xl font-bold text-primary">
                                  {order.product_name}
                                </h4>
                              </div>

                              <button
                                type="button"
                                onClick={() => deleteOrder(order)}
                                disabled={isDeleting}
                                className="inline-flex w-fit items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <FiTrash2 aria-hidden="true" />
                                {isDeleting ? "Deleting..." : "Delete Order"}
                              </button>
                            </div>

                            <dl className="mt-5 grid gap-x-6 gap-y-4 md:grid-cols-2">
                              <div>
                                <dt className="text-xs font-black uppercase tracking-[0.18em] text-champagne/45">
                                  Customer
                                </dt>
                                <dd className="mt-1 text-primary">
                                  {order.customer_name}
                                </dd>
                              </div>

                              <div>
                                <dt className="text-xs font-black uppercase tracking-[0.18em] text-champagne/45">
                                  Amount
                                </dt>
                                <dd className="mt-1 font-black text-accent">
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

                            <div className="mt-6 flex flex-wrap gap-2 border-t border-[#eadbb8] pt-5">
                              <button
                                type="button"
                                onClick={() =>
                                  assignVendor(order.id, "Studio Desk A")
                                }
                                disabled={isDeleting}
                                className="rounded-md bg-signal px-4 py-2 font-bold text-white disabled:opacity-60"
                              >
                                Assign Desk A
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  assignVendor(order.id, "Studio Desk B")
                                }
                                disabled={isDeleting}
                                className="rounded-md bg-accent px-4 py-2 font-bold text-primary disabled:opacity-60"
                              >
                                Assign Desk B
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  updateOrderStatus(order.id, "processing")
                                }
                                disabled={
                                  isDeleting ||
                                  isUpdating ||
                                  (order.order_status || "processing") ===
                                    "processing"
                                }
                                className="rounded-md border border-accent/55 px-4 py-2 font-bold text-[#8c6518] disabled:opacity-60"
                              >
                                Processing
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  updateOrderStatus(order.id, "delivered")
                                }
                                disabled={
                                  isDeleting ||
                                  isUpdating ||
                                  order.order_status === "delivered"
                                }
                                className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 font-bold text-primary disabled:opacity-60"
                              >
                                <FiCheckCircle aria-hidden="true" />
                                {order.order_status === "delivered"
                                  ? "Delivered"
                                  : "Mark Delivered"}
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

    </main>
  );
}
