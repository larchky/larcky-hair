"use client";

import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";
import { useState, type ChangeEvent, type FormEvent } from "react";
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

const DEFAULT_PAYMENT_EMAIL = "buyer@lackyhair.com";
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
      title: "LACKY HAIR",
      description: productName,
      logo: "https://your-logo-url.com/logo.png",
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
    setTxRef(`LACKY-${Date.now()}-${Math.floor(Math.random() * 100000)}`);
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
        className="bg-pink-500 text-black px-4 py-2 rounded"
      >
        Pay Now
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-xl bg-zinc-900 p-6 text-white"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-pink-400">
                Delivery Details
              </h2>

              <button
                type="button"
                onClick={() => {
                  if (!isSubmitting) {
                    setIsOpen(false);
                  }
                }}
                disabled={isSubmitting}
                className="rounded bg-zinc-800 px-3 py-1 text-sm text-pink-200"
              >
                Close
              </button>
            </div>

            <input
              name="name"
              placeholder="Full Name"
              value={form.name}
              onChange={handleChange}
              required
              className="mb-4 w-full rounded border border-pink-500 bg-black p-3"
            />

            <input
              name="phone"
              placeholder="Phone Number"
              value={form.phone}
              onChange={handleChange}
              required
              className="mb-4 w-full rounded border border-pink-500 bg-black p-3"
            />

            <input
              name="email"
              type="email"
              placeholder="Email (optional)"
              value={form.email}
              onChange={handleChange}
              className="mb-4 w-full rounded border border-pink-500 bg-black p-3"
            />

            <textarea
              name="deliveryAddress"
              placeholder="Delivery Address"
              value={form.deliveryAddress}
              onChange={handleChange}
              required
              rows={4}
              className="mb-5 w-full resize-none rounded border border-pink-500 bg-black p-3"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded bg-pink-500 px-4 py-3 font-bold text-black disabled:opacity-60"
            >
              {isSubmitting ? "Opening payment..." : "Continue to Payment"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
