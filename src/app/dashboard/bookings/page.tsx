"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface Booking {
  id: string;
  status: string;
  student: { id: string; name: string; email: string };
  tutor: { id: string; name: string; email: string };
  slot: { id: string; date: string; startTime: string; endTime: string };
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const { data: session } = useSession();

  useEffect(() => {
    if (session) {
      const user = session.user as any;
      fetchBookings(user.id, user.role);
    }
  }, [session]);

  async function fetchBookings(userId: string, role: string) {
    const res = await fetch(
      `/api/bookings?userId=${userId}&role=${role}`
    );
    if (res.ok) {
      const data = await res.json();
      setBookings(data);
    }
  }

  async function handleStatusChange(bookingId: string, status: string) {
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (res.ok && session) {
      const user = session.user as any;
      fetchBookings(user.id, user.role);
    }
  }

  const user = session?.user as any;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Bookings</h1>

      <div className="grid gap-4">
        {bookings.map((booking) => (
          <div key={booking.id} className="p-6 border rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">
                  {user?.role === "TUTOR"
                    ? `Student: ${booking.student.name}`
                    : `Tutor: ${booking.tutor.name}`}
                </p>
                <p className="text-sm text-gray-600">
                  {new Date(booking.slot.date).toLocaleDateString()} |{" "}
                  {new Date(booking.slot.startTime).toLocaleTimeString()} -{" "}
                  {new Date(booking.slot.endTime).toLocaleTimeString()}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded text-sm ${
                  booking.status === "CONFIRMED"
                    ? "bg-green-100 text-green-800"
                    : booking.status === "PENDING"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                }`}
              >
                {booking.status}
              </span>
            </div>

            {user?.role === "TUTOR" && booking.status === "PENDING" && (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleStatusChange(booking.id, "CONFIRMED")}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                >
                  Confirm
                </button>
                <button
                  onClick={() => handleStatusChange(booking.id, "REJECTED")}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                >
                  Reject
                </button>
              </div>
            )}

            {user?.role === "STUDENT" && booking.status === "PENDING" && (
              <div className="mt-4">
                <button
                  onClick={() => handleStatusChange(booking.id, "CANCELLED")}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}
        {bookings.length === 0 && (
          <p className="text-gray-500 text-center py-8">No bookings yet.</p>
        )}
      </div>
    </div>
  );
}
