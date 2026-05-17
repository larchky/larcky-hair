"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { FiMessageSquare, FiStar } from "react-icons/fi";
import BrandLogo from "@/app/components/BrandLogo";

type Review = {
  id: number;
  name: string;
  product: string;
  rating: string;
  comment: string;
};

const starterReviews: Review[] = [
  {
    id: 1,
    name: "Ada C.",
    product: "Ring Light Kit",
    rating: "5",
    comment:
      "The light quality changed my videos immediately. Strong stand, clean glow, and the setup looks premium.",
  },
  {
    id: 2,
    name: "Timi A.",
    product: "Wireless Microphone",
    rating: "5",
    comment:
      "Audio is much clearer for interviews and reels. Dolapo Store helped me choose the right mic for my phone.",
  },
  {
    id: 3,
    name: "Mira Studios",
    product: "Creator Starter Kit",
    rating: "4",
    comment:
      "Great bundle for small studio shoots. Everything arrived neat, and the team followed up on delivery.",
  },
];

const emptyReview = {
  name: "",
  product: "",
  rating: "5",
  comment: "",
};

export default function ReviewsPage() {
  const [reviews, setReviews] = useState(starterReviews);
  const [form, setForm] = useState(emptyReview);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !form.comment.trim()) {
      alert("Please add your name and review.");
      return;
    }

    setReviews([
      {
        id: Date.now(),
        name: form.name.trim(),
        product: form.product.trim() || "Dolapo creator tool",
        rating: form.rating,
        comment: form.comment.trim(),
      },
      ...reviews,
    ]);
    setForm(emptyReview);
  };

  return (
    <main className="min-h-screen bg-studio px-5 py-8 text-champagne sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-6 border-b border-white/10 pb-8 md:flex-row md:items-center">
          <BrandLogo compact />

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="w-fit rounded-md border border-amber-200/35 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-amber-100 transition hover:border-amber-100 hover:text-white"
            >
              Home
            </Link>
            <Link
              href="/products"
              className="w-fit rounded-md border border-white/15 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-champagne transition hover:border-amber-200/60 hover:text-white"
            >
              Products
            </Link>
          </div>
        </header>

        <section className="grid gap-8 py-10 lg:grid-cols-[0.92fr_1.08fr]">
          <div>
            <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.24em] text-amber-200">
              <FiMessageSquare aria-hidden="true" />
              Customer Reviews
            </p>
            <h1 className="mt-3 max-w-2xl font-serif text-5xl font-bold leading-tight text-white">
              What creators say after upgrading their setup.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-champagne/70">
              Real feedback from creators, streamers, and small studios buying
              cameras, lights, microphones, and complete creator kits.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-amber-200/20 bg-white/[0.045] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.32)]"
          >
            <h2 className="text-2xl font-bold text-white">Leave a review</h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <input
                name="name"
                placeholder="Your name"
                value={form.name}
                onChange={handleChange}
                className="rounded-md border border-amber-200/30 bg-black/45 p-3 text-white outline-none transition placeholder:text-champagne/35 focus:border-amber-200"
              />
              <input
                name="product"
                placeholder="Product bought"
                value={form.product}
                onChange={handleChange}
                className="rounded-md border border-amber-200/30 bg-black/45 p-3 text-white outline-none transition placeholder:text-champagne/35 focus:border-amber-200"
              />
              <select
                name="rating"
                value={form.rating}
                onChange={handleChange}
                className="rounded-md border border-amber-200/30 bg-black/45 p-3 text-white outline-none transition focus:border-amber-200 sm:col-span-2"
              >
                <option value="5">5/5</option>
                <option value="4">4/5</option>
                <option value="3">3/5</option>
                <option value="2">2/5</option>
                <option value="1">1/5</option>
              </select>
              <textarea
                name="comment"
                placeholder="How was your experience?"
                value={form.comment}
                onChange={handleChange}
                rows={5}
                className="resize-none rounded-md border border-amber-200/30 bg-black/45 p-3 text-white outline-none transition placeholder:text-champagne/35 focus:border-amber-200 sm:col-span-2"
              />
            </div>

            <button
              type="submit"
              className="mt-5 w-full rounded-md bg-amber-200 px-4 py-3 font-black uppercase tracking-[0.14em] text-black transition hover:bg-white"
            >
              Submit Review
            </button>
          </form>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="border border-white/10 bg-white/[0.045] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.24)]"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="font-bold text-white">{review.name}</p>
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-200/12 px-3 py-1 text-sm font-black text-amber-100">
                  <FiStar aria-hidden="true" />
                  {review.rating}/5
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-amber-100">
                {review.product}
              </p>
              <p className="mt-4 leading-7 text-champagne/72">
                {review.comment}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
