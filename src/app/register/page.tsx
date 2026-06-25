"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "STUDENT",
  });
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registration failed");
        return;
      }

      router.push("/login");
    } catch {
      setError("Something went wrong");
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">Register</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <input
          type="text"
          placeholder="Full Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full p-3 border rounded-lg"
          required
        />
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
        <select
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          className="w-full p-3 border rounded-lg"
        >
          <option value="STUDENT">Student</option>
          <option value="TUTOR">Tutor</option>
        </select>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          className="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Register
        </button>
      </form>
      <p className="mt-4 text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="text-blue-600 hover:underline">
          Login
        </Link>
      </p>
    </div>
  );
}
