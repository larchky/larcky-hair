"use client";

import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";
import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { FiCreditCard, FiX } from "react-icons/fi";

type CheckoutItem = {
  name: string;
  price: number;
  quantity: number;
};

type Props = {
  amount: number;
  productName: string;
  buttonLabel?: string;
  checkoutItems?: CheckoutItem[];
  disabled?: boolean;
  onPaymentSuccess?: () => void;
};

type CheckoutForm = {
  name: string;
  phone: string;
  email: string;
  deliveryAddress: string;
};

type FlutterwavePaymentResponse = {
  transaction_id?: number | string;
  tx_ref?: string;
};

const DEFAULT_PAYMENT_EMAIL = "buyer@dolapocreator.com";
const UNPROVIDED_EMAIL = "Not provided";

const emptyForm: CheckoutForm = {
  name: "",
  phone: "",
  email: "",
  deliveryAddress: "",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-NG", {
    currency: "NGN",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function PayButton({
  amount,
  productName,
  buttonLabel = "Proceed to Payment",
  checkoutItems = [],
  disabled = false,
  onPaymentSuccess,
}: Props) {
  const [form, setForm] = useState(emptyForm);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txRef, setTxRef] = useState("pending");

  useEffect(() => {
    if (!isOpen) return;

    const bodyOverflow = document.body.style.overflow;
    const bodyPaddingRight = document.body.style.paddingRight;
    const bodyPosition = document.body.style.position;
    const bodyTop = document.body.style.top;
    const bodyWidth = document.body.style.width;
    const htmlOverflow = document.documentElement.style.overflow;
    const scrollY = window.scrollY;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.documentElement.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = bodyOverflow;
      document.body.style.paddingRight = bodyPaddingRight;
      document.body.style.position = bodyPosition;
      document.body.style.top = bodyTop;
      document.body.style.width = bodyWidth;
      document.documentElement.style.overflow = htmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  const customerName = form.name.trim();
  const customerPhone = form.phone.trim();
  const customerEmail = form.email.trim();
  const deliveryAddress = form.deliveryAddress.trim();
  const paymentEmail = customerEmail || DEFAULT_PAYMENT_EMAIL;
  const hasCheckoutItems = checkoutItems.length > 0;
  const itemCount = checkoutItems.reduce(
    (total, item) => total + item.quantity,
    0
  );
  const orderItemsSummary = hasCheckoutItems
    ? checkoutItems
        .map((item) => `${item.name} x${item.quantity}`)
        .join(" | ")
    : productName;
  const paymentLogo =
    typeof window !== "undefined" ? `${window.location.origin}/api/logo` : "";
  const config = {
    public_key: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY!,
    tx_ref: txRef,
    amount: safeAmount,
    currency: "NGN",
    payment_options: "card,banktransfer,ussd",
    meta: {
      order_source: "dolapo_cart_checkout",
      product_name: productName,
      order_items: orderItemsSummary,
      item_count: itemCount || 1,
      order_amount: safeAmount,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail || UNPROVIDED_EMAIL,
      delivery_address: deliveryAddress,
      tx_ref: txRef,
      currency: "NGN",
    },
    customer: {
      email: paymentEmail,
      phone_number: customerPhone,
      name: customerName,
    },
    customizations: {
      title: "DOLAPO",
      description: productName,
      logo: paymentLogo,
    },
  };

  const handleFlutterPayment = useFlutterwave(config);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const resetCheckout = () => {
    setForm(emptyForm);
    setTxRef("pending");
    setIsSubmitting(false);
    setIsOpen(false);
  };

  const openCheckout = () => {
    if (disabled || safeAmount <= 0) return;

    setTxRef(`DOLAPO-${Date.now()}-${Math.floor(Math.random() * 100000)}`);
    setIsOpen(true);
  };

  const confirmPaidOrder = async (
    paymentResponse: FlutterwavePaymentResponse
  ) => {
    if (!paymentResponse.transaction_id) {
      throw new Error("Flutterwave did not return a transaction id.");
    }

    const response = await fetch("/api/orders/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transactionId: paymentResponse.transaction_id,
        txRef: paymentResponse.tx_ref || txRef,
        order: {
          productName,
          amount: safeAmount,
          customerName,
          customerPhone,
          customerEmail: customerEmail || UNPROVIDED_EMAIL,
          deliveryAddress,
          currency: "NGN",
        },
      }),
    });

    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      throw new Error(result?.error || "Payment could not be confirmed.");
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!customerName || !customerPhone || !deliveryAddress) {
      alert("Please enter your name, phone number, and delivery address.");
      return;
    }

    if (!process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY) {
      alert("Payment key is missing. Please contact the store owner.");
      return;
    }

    setIsSubmitting(true);

    handleFlutterPayment({
      callback: async (response) => {
        try {
          await confirmPaidOrder(response);
          alert("Payment successful! Your order has been received.");
          onPaymentSuccess?.();
          resetCheckout();
        } catch (error) {
          alert(
            error instanceof Error
              ? `Payment could not be confirmed: ${error.message}`
              : "Payment could not be confirmed."
          );
          setIsSubmitting(false);
        }

        closePaymentModal();
      },
      onClose: () => {
        setIsSubmitting(false);
      },
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openCheckout}
        disabled={disabled || safeAmount <= 0}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-primary transition hover:bg-[#ddb357] disabled:cursor-not-allowed disabled:opacity-55"
      >
        <FiCreditCard aria-hidden="true" />
        {buttonLabel}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-primary/70 px-4">
          <form
            onSubmit={handleSubmit}
            className="fixed left-1/2 top-1/2 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-accent/30 bg-[#fffaf0] p-6 text-champagne shadow-[0_18px_42px_rgba(99,69,22,0.16)]"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">
                  Checkout
                </p>
                <h2 className="mt-1 text-xl font-bold text-primary">
                  Delivery Details
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!isSubmitting) {
                    setIsOpen(false);
                  }
                }}
                disabled={isSubmitting}
                aria-label="Close checkout"
                className="rounded-md border border-[#eadbb8] bg-white/85 p-2 text-[#8c6518] transition hover:border-accent/50 disabled:opacity-50"
              >
                <FiX aria-hidden="true" />
              </button>
            </div>

            {hasCheckoutItems && (
              <div className="mb-5 rounded-md border border-[#eadbb8] bg-white/80 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-black uppercase tracking-[0.14em] text-accent">
                    Cart Summary
                  </p>
                  <p className="font-black text-primary">
                    {formatCurrency(safeAmount)}
                  </p>
                </div>

                <div className="space-y-2">
                  {checkoutItems.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-champagne/80">
                        {item.name} x{item.quantity}
                      </span>
                      <span className="font-semibold text-primary">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <input
              name="name"
              placeholder="Full Name"
              value={form.name}
              onChange={handleChange}
              required
              className="mb-4 w-full rounded-md border border-accent/35 bg-white/90 p-3 text-primary outline-none transition placeholder:text-champagne/45 focus:border-accent"
            />

            <input
              name="phone"
              placeholder="Phone Number"
              value={form.phone}
              onChange={handleChange}
              required
              className="mb-4 w-full rounded-md border border-accent/35 bg-white/90 p-3 text-primary outline-none transition placeholder:text-champagne/45 focus:border-accent"
            />

            <input
              name="email"
              type="email"
              placeholder="Email (optional)"
              value={form.email}
              onChange={handleChange}
              className="mb-4 w-full rounded-md border border-accent/35 bg-white/90 p-3 text-primary outline-none transition placeholder:text-champagne/45 focus:border-accent"
            />

            <textarea
              name="deliveryAddress"
              placeholder="Delivery Address"
              value={form.deliveryAddress}
              onChange={handleChange}
              required
              rows={4}
              className="mb-5 w-full resize-none rounded-md border border-accent/35 bg-white/90 p-3 text-primary outline-none transition placeholder:text-champagne/45 focus:border-accent"
            />

            <div className="mb-5 rounded-md border border-accent/30 bg-accent/10 p-4 text-sm leading-6 text-[#5c4214]">
              Payment does not include delivery. You will be contacted by
              Dolapo Store to make arrangements for delivery.
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-accent px-4 py-3 font-black uppercase tracking-[0.14em] text-primary transition hover:bg-[#ddb357] disabled:opacity-60"
            >
              {isSubmitting ? "Opening payment..." : "Proceed to Payment"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export { PayButton };
export default PayButton;
