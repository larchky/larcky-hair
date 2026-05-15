"use client";

type Product = {
  name: string;
  price: number;
};

export default function PayButton({ product }: { product: Product }) {
  const pay = () => {
    const handler = (window as any).PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_KEY,
      email: "customer@example.com",
      amount: product.price * 100,
      currency: "NGN",
      callback: function () {
        alert("Payment successful!");
      },
      onClose: function () {
        alert("Payment cancelled");
      },
    });

    handler.openIframe();
  };

  return (
    <button
      onClick={pay}
      className="bg-pink-500 text-white px-4 py-2 rounded"
    >
      Pay Now
    </button>
  );
}