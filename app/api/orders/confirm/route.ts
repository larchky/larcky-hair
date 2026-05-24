import {
  OrderProcessingError,
  processFlutterwaveOrder,
  type OrderInput,
} from "@/lib/orderProcessing";

export const runtime = "nodejs";

type ConfirmOrderBody = {
  transactionId?: unknown;
  transaction_id?: unknown;
  txRef?: unknown;
  tx_ref?: unknown;
  order?: OrderInput;
};

function redirectToProducts(request: Request, payment: string) {
  const redirectUrl = new URL("/cart", request.url);
  redirectUrl.searchParams.set("payment", payment);

  return Response.redirect(redirectUrl, 303);
}

function getTransactionId(body: ConfirmOrderBody) {
  const value = body.transactionId || body.transaction_id;
  return typeof value === "number" || typeof value === "string"
    ? String(value).trim()
    : "";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = String(url.searchParams.get("status") || "").toLowerCase();
  const transactionId = String(
    url.searchParams.get("transaction_id") || url.searchParams.get("id") || ""
  ).trim();
  const txRef = String(
    url.searchParams.get("tx_ref") || url.searchParams.get("txRef") || ""
  ).trim();

  if (status && status !== "successful") {
    return redirectToProducts(
      request,
      status === "cancelled" ? "cancelled" : "failed"
    );
  }

  if (!transactionId) {
    return redirectToProducts(request, "failed");
  }

  try {
    await processFlutterwaveOrder(transactionId, {
      txRef: txRef || undefined,
    });

    return redirectToProducts(request, "success");
  } catch {
    return redirectToProducts(request, "unconfirmed");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ConfirmOrderBody;
    const transactionId = getTransactionId(body);

    if (!transactionId) {
      return Response.json(
        { error: "Missing Flutterwave transaction id." },
        { status: 400 }
      );
    }

    const order = body.order || {};
    const result = await processFlutterwaveOrder(transactionId, {
      ...order,
      txRef: body.txRef || body.tx_ref || order.txRef,
    });

    return Response.json({
      order: result.order,
      created: result.created,
      emailSent: result.emailSent,
      emailSkipped: result.emailSkipped,
      emailError: result.emailError,
    });
  } catch (error) {
    const status =
      error instanceof OrderProcessingError ? error.statusCode : 500;

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not confirm order.",
      },
      { status }
    );
  }
}
