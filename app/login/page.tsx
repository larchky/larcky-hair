"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

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

    // 🔍 DEBUG: check session immediately after login
    const sessionCheck = await supabase.auth.getSession();
    console.log("SESSION AFTER LOGIN:", sessionCheck.data.session);

    const userCheck = await supabase.auth.getUser();
    console.log("USER AFTER LOGIN:", userCheck.data.user);

    setLoading(false);

    router.push("/admin");
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="bg-zinc-900 p-8 rounded-xl w-full max-w-md">

        <h1 className="text-3xl font-bold text-pink-500 mb-6">
          Admin Login
        </h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 p-3 rounded bg-black border border-pink-500"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-6 p-3 rounded bg-black border border-pink-500"
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-pink-500 text-black py-3 rounded font-bold disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

      </div>
    </main>
  );
}
