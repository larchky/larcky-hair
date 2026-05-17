"use client";

import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { FiCreditCard, FiX } from "react-icons/fi";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  amount: number;
  productName: string;
};

type CheckoutForm = {
  name: string;
  phone: string;
  email: string;
  deliveryAddress: string;
};

const DEFAULT_PAYMENT_EMAIL = "buyer@dolapocreator.com";
const INITIAL_ORDER_STATUS = "processing";
const SUCCESSFUL_PAYMENT_STATUS = "successful";

const emptyForm: CheckoutForm = {
  name: "",
  phone: "",
  email: "",
  deliveryAddress: "",
};

export default function PayButton({ amount, productName }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txRef, setTxRef] = useState("pending");

  const customerName = form.name.trim();
  const customerPhone = form.phone.trim();
  const customerEmail = form.email.trim();
  const deliveryAddress = form.deliveryAddress.trim();
  const paymentEmail = customerEmail || DEFAULT_PAYMENT_EMAIL;
  const paymentLogo =
    typeof window !== "undefined" ? `${window.location.origin}/api/logo` : "";

  const config = {
    public_key: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY!,
    tx_ref: txRef,
    amount,
    currency: "NGN",
    payment_options: "card,banktransfer,ussd",
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
    setTxRef(`DOLAPO-${Date.now()}-${Math.floor(Math.random() * 100000)}`);
    setIsOpen(true);
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
        if (response.status?.toLowerCase() !== SUCCESSFUL_PAYMENT_STATUS) {
          alert("Payment was not successful. Your order was not saved.");
          setIsSubmitting(false);
          closePaymentModal();
          return;
        }

        const { error } = await supabase.from("orders").insert([
          {
            product_name: productName,
            amount,
            customer_email: customerEmail || "Not provided",
            customer_name: customerName,
            customer_phone: customerPhone,
            delivery_address: deliveryAddress,
            payment_status: SUCCESSFUL_PAYMENT_STATUS,
            transaction_id: String(response.transaction_id),
            order_status: INITIAL_ORDER_STATUS,
          },
        ]);

        if (error) {
          alert(`Payment succeeded but order save failed: ${error.message}`);
          setIsSubmitting(false);
        } else {
          alert("Payment successful! Your order has been received.");
          resetCheckout();
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
        className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-200 px-4 py-2 text-sm font-black uppercase tracking-[0.12em] text-black transition hover:bg-white"
      >
        <FiCreditCard aria-hidden="true" />
        Pay Now
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/86 px-4 backdrop-blur-sm">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-lg border border-amber-200/25 bg-[#11100e] p-6 text-champagne shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">
                  Checkout
                </p>
                <h2 className="mt-1 text-xl font-bold text-white">
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
                className="rounded-md border border-white/10 bg-white/[0.04] p-2 text-amber-100 transition hover:border-amber-200/50 disabled:opacity-50"
              >
                <FiX aria-hidden="true" />
              </button>
            </div>

            <input
              name="name"
              placeholder="Full Name"
              value={form.name}
              onChange={handleChange}
              required
              className="mb-4 w-full rounded-md border border-amber-200/30 bg-black/50 p-3 text-white outline-none transition placeholder:text-champagne/35 focus:border-amber-200"
            />

            <input
              name="phone"
              placeholder="Phone Number"
              value={form.phone}
              onChange={handleChange}
              required
              className="mb-4 w-full rounded-md border border-amber-200/30 bg-black/50 p-3 text-white outline-none transition placeholder:text-champagne/35 focus:border-amber-200"
            />

            <input
              name="email"
              type="email"
              placeholder="Email (optional)"
              value={form.email}
              onChange={handleChange}
              className="mb-4 w-full rounded-md border border-amber-200/30 bg-black/50 p-3 text-white outline-none transition placeholder:text-champagne/35 focus:border-amber-200"
            />

            <textarea
              name="deliveryAddress"
              placeholder="Delivery Address"
              value={form.deliveryAddress}
              onChange={handleChange}
              required
              rows={4}
              className="mb-5 w-full resize-none rounded-md border border-amber-200/30 bg-black/50 p-3 text-white outline-none transition placeholder:text-champagne/35 focus:border-amber-200"
            />

            <div className="mb-5 rounded-md border border-amber-200/25 bg-amber-200/10 p-4 text-sm leading-6 text-amber-50">
              Payment does not include delivery. You will be contacted by
              Dolapo Store to make arrangements for delivery.
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-amber-200 px-4 py-3 font-black uppercase tracking-[0.14em] text-black transition hover:bg-white disabled:opacity-60"
            >
              {isSubmitting ? "Opening payment..." : "Proceed to Payment"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
