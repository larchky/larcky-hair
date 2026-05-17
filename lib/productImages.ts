import { supabase } from "@/lib/supabaseClient";

export const PRODUCT_IMAGE_BUCKET = "product-images";

export type Product = {
  id: number | string;
  name: string;
  price: number;
  description: string | null;
  image_url: string | null;
  rotation_image_urls?: string[] | null;
};

export function getProductImageUrl(path?: string | null) {
  if (!path) return null;

  const { data } = supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

export function getProductImageUrls(paths?: string[] | null) {
  return (paths || []).flatMap((path) => {
    const url = getProductImageUrl(path);
    return url ? [url] : [];
  });
}
