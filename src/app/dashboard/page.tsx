"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="p-8">Loading...</div>;
  }

  if (!session) {
    router.push("/login");
    return <div className="p-8">Redirecting...</div>;
  }

  const user = session.user as any;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-600 mb-8">
        Welcome, {user.name} ({user.role})
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {user.role === "TUTOR" && (
          <Link
            href="/dashboard/slots"
            className="p-6 border rounded-lg hover:shadow-md transition"
          >
            <h2 className="text-xl font-semibold mb-2">Manage Slots</h2>
            <p className="text-gray-600">
              Add and manage your available time slots
            </p>
          </Link>
        )}
        <Link
          href="/dashboard/bookings"
          className="p-6 border rounded-lg hover:shadow-md transition"
        >
          <h2 className="text-xl font-semibold mb-2">Bookings</h2>
          <p className="text-gray-600">View and manage your bookings</p>
        </Link>
        <Link
          href="/dashboard/notifications"
          className="p-6 border rounded-lg hover:shadow-md transition"
        >
          <h2 className="text-xl font-semibold mb-2">Notifications</h2>
          <p className="text-gray-600">Check your latest notifications</p>
        </Link>
        <Link
          href="/tutors"
          className="p-6 border rounded-lg hover:shadow-md transition"
        >
          <h2 className="text-xl font-semibold mb-2">Find Tutors</h2>
          <p className="text-gray-600">Search and browse available tutors</p>
        </Link>
      </div>
    </div>
  );
}
