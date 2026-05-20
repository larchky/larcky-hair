import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type OrderPatchBody = {
  id?: unknown;
  order_status?: unknown;
  assigned_vendor?: unknown;
};

class AdminOrdersError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AdminOrdersError";
    this.statusCode = statusCode;
  }
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new AdminOrdersError(
      "Missing Supabase server credentials. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      500
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  return scheme.toLowerCase() === "bearer" ? token?.trim() : "";
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function getAuthorizedSupabaseAdmin(request: Request) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    throw new AdminOrdersError("Please log in again to manage orders.", 401);
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new AdminOrdersError("Please log in again to manage orders.", 401);
  }

  return supabaseAdmin;
}

function errorResponse(error: unknown) {
  const status =
    error instanceof AdminOrdersError ? error.statusCode : 500;

  return Response.json(
    {
      error:
        error instanceof Error ? error.message : "Could not manage orders.",
    },
    { status }
  );
}

export async function GET(request: Request) {
  try {
    const supabaseAdmin = await getAuthorizedSupabaseAdmin(request);
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new AdminOrdersError(error.message, 500);
    }

    return Response.json({ orders: data || [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const supabaseAdmin = await getAuthorizedSupabaseAdmin(request);
    const body = (await request.json()) as OrderPatchBody;
    const id = asString(body.id);
    const orderStatus = asString(body.order_status);
    const assignedVendor = asString(body.assigned_vendor);
    const updates: Record<string, string> = {};

    if (!id) {
      throw new AdminOrdersError("Missing order id.");
    }

    if (orderStatus) {
      updates.order_status = orderStatus;
    }

    if (assignedVendor) {
      updates.assigned_vendor = assignedVendor;
    }

    if (!Object.keys(updates).length) {
      throw new AdminOrdersError("No order updates were provided.");
    }

    const { data, error } = await supabaseAdmin
      .from("orders")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new AdminOrdersError(error.message, 500);
    }

    return Response.json({ order: data });
  } catch (error) {
    return errorResponse(error);
  }
}
