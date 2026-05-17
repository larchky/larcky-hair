"use client";

import CheckoutPayButton from "@/app/components/PayButton";

type Product = {
  name: string;
  price: number;
};

export default function PayButton({ product }: { product: Product }) {
  return (
    <CheckoutPayButton
      amount={Number(product.price)}
      productName={product.name}
    />
  );
}
