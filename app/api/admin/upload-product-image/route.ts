import { createClient } from "@supabase/supabase-js";

const PRODUCT_IMAGE_BUCKET = "product-images";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getSafeFileName(file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase();
  return `products/${crypto.randomUUID()}-${safeName}`;
}

export async function POST(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();

  if (!supabaseAdmin) {
    return Response.json(
      {
        error:
          "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local and restart the dev server.",
      },
      { status: 500 }
    );
  }

  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return Response.json({ error: "Please log in again." }, { status: 401 });
  }

  const { data: userData, error: userError } =
    await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    return Response.json({ error: "Please log in again." }, { status: 401 });
  }

  const formData = await request.formData();
  const image = formData.get("image");

  if (!(image instanceof File)) {
    return Response.json({ error: "Choose an image first." }, { status: 400 });
  }

  const fileName = getSafeFileName(image);

  const { data, error } = await supabaseAdmin.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(fileName, image, {
      cacheControl: "3600",
      contentType: image.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    return Response.json(
      { error: `Image upload failed: ${error.message}` },
      { status: error.statusCode ? Number(error.statusCode) : 500 }
    );
  }

  return Response.json({ path: data.path });
}
