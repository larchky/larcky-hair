import { supabase } from "@/lib/supabaseClient";

export const PRODUCT_IMAGE_BUCKET = "product-images";

export type Product = {
  id: number | string;
  name: string;
  price: number;
  description: string | null;
  image_url: string | null;
  stock_quantity?: number | null;
  rotation_image_urls?: string[] | null;
  rotation_image_rows?: string[][] | null;
};

export function getProductStock(product: Pick<Product, "stock_quantity">) {
  const stock = Number(product.stock_quantity);

  return Number.isFinite(stock) && stock > 0 ? Math.floor(stock) : 0;
}

export function getProductImageUrl(path?: string | null) {
  if (!path) return null;

  const { data } = supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

export function getProductDisplayImageUrl(
  product: Pick<
    Product,
    "image_url" | "rotation_image_rows" | "rotation_image_urls"
  >
) {
  const displayImagePath =
    product.image_url ||
    (product.rotation_image_rows || []).flat().find(Boolean) ||
    (product.rotation_image_urls || []).find(Boolean) ||
    null;

  return getProductImageUrl(displayImagePath);
}

export function getProductImageUrls(paths?: string[] | null) {
  return (paths || []).flatMap((path) => {
    const url = getProductImageUrl(path);
    return url ? [url] : [];
  });
}

export function getProductImageRows(
  rows?: string[][] | null,
  fallbackPaths?: string[] | null
) {
  const rowUrls = (rows || [])
    .map((row) => getProductImageUrls(row))
    .filter((row) => row.length > 0);

  if (rowUrls.length > 0) {
    return rowUrls;
  }

  const fallbackUrls = getProductImageUrls(fallbackPaths);

  return fallbackUrls.length > 0 ? [fallbackUrls] : [];
}
