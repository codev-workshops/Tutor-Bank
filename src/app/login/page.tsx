"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed");
        return;
      }

      const user = await res.json();
      // TODO: Store user session properly (e.g., cookies/JWT)
      localStorage.setItem("user", JSON.stringify(user));
      router.push("/dashboard");
    } catch {
      setError("Something went wrong");
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">Login</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full p-3 border rounded-lg"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={formData.password}
          onChange={(e) =>
            setFormData({ ...formData, password: e.target.value })
          }
          className="w-full p-3 border rounded-lg"
          required
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          className="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Login
        </button>
      </form>
      <p className="mt-4 text-gray-600">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-blue-600 hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}
