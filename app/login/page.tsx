"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiLock } from "react-icons/fi";
import { supabase } from "@/lib/supabaseClient";
import BrandLogo from "@/app/components/BrandLogo";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push("/admin");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-studio px-5 py-10 text-champagne">
      <div className="w-full max-w-md rounded-lg border border-accent/30 bg-white/90 p-7 shadow-[0_30px_80px_rgba(99,69,22,0.16)]">
        <BrandLogo />

        <div className="mt-8">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.22em] text-accent">
            <FiLock aria-hidden="true" />
            Admin Access
          </p>
          <h1 className="mt-2 text-3xl font-bold text-primary">
            Manage Dolapo stock
          </h1>
        </div>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-6 w-full rounded-md border border-accent/35 bg-white/90 p-3 text-primary outline-none transition placeholder:text-champagne/45 focus:border-accent"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-4 w-full rounded-md border border-accent/35 bg-white/90 p-3 text-primary outline-none transition placeholder:text-champagne/45 focus:border-accent"
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          className="mt-6 w-full rounded-md bg-accent px-4 py-3 font-black uppercase tracking-[0.14em] text-primary transition hover:bg-[#ddb357] disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>
    </main>
  );
}
