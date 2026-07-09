"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Booking {
  id: string;
  status: string;
  student: { id: string; name: string; email: string };
  tutor: { id: string; name: string; email: string };
  slot: { id: string; date: string; startTime: string; endTime: string };
}

function statusBadgeClass(status: string): string {
  if (status === "CONFIRMED") return "bg-green-100 text-green-800";
  if (status === "PENDING") return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function statusDotClass(status: string): string {
  if (status === "CONFIRMED") return "bg-green-500";
  if (status === "PENDING") return "bg-yellow-500";
  return "bg-red-500";
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export default function CalendarPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [current, setCurrent] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!session) return;
    const { id, role } = session.user;
    let active = true;
    (async () => {
      const res = await fetch(`/api/bookings?userId=${id}&role=${role}`);
      if (res.ok && active) {
        const data = await res.json();
        setBookings(data);
      }
    })();
    return () => {
      active = false;
    };
  }, [session]);

  // Group bookings by day-of-month key.
  const bookingsByDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const booking of bookings) {
      const key = dayKey(new Date(booking.slot.date));
      const existing = map.get(key);
      if (existing) {
        existing.push(booking);
      } else {
        map.set(key, [booking]);
      }
    }
    return map;
  }, [bookings]);

  const year = current.getFullYear();
  const month = current.getMonth();

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      result.push(new Date(year, month, d));
    }
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [year, month]);

  if (status === "loading") {
    return <div className="p-8">Loading...</div>;
  }

  if (!session) {
    router.push("/login");
    return <div className="p-8">Redirecting...</div>;
  }

  const user = session.user;
  const exportUrl = `/api/calendar?userId=${user.id}&role=${user.role}`;

  const selectedBookings = selectedKey
    ? (bookingsByDay.get(selectedKey) ?? [])
    : [];

  const today = new Date();
  const todayKey = dayKey(today);

  async function handleCopy() {
    try {
      const absolute = `${window.location.origin}${exportUrl}`;
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">Calendar</h1>
        <div className="flex gap-2">
          <a
            href={exportUrl}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm"
          >
            Export to Calendar (.ics)
          </a>
          <button
            onClick={handleCopy}
            className="px-4 py-2 border rounded hover:bg-gray-50 transition text-sm"
          >
            {copied ? "Copied!" : "Copy subscription URL"}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrent(new Date(year, month - 1, 1))}
          className="px-3 py-1 border rounded hover:bg-gray-50 transition"
          aria-label="Previous month"
        >
          &larr;
        </button>
        <h2 className="text-xl font-semibold">
          {MONTHS[month]} {year}
        </h2>
        <button
          onClick={() => setCurrent(new Date(year, month + 1, 1))}
          className="px-3 py-1 border rounded hover:bg-gray-50 transition"
          aria-label="Next month"
        >
          &rarr;
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="bg-gray-50 text-center text-xs font-medium text-gray-600 py-2"
          >
            {day}
          </div>
        ))}
        {cells.map((date, idx) => {
          if (!date) {
            return <div key={`empty-${idx}`} className="bg-white min-h-24" />;
          }
          const key = dayKey(date);
          const dayBookings = bookingsByDay.get(key) ?? [];
          const isSelected = key === selectedKey;
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              onClick={() => setSelectedKey(key)}
              className={`bg-white min-h-24 p-1 text-left align-top hover:bg-gray-50 transition ${
                isSelected ? "ring-2 ring-blue-500 ring-inset" : ""
              }`}
            >
              <span
                className={`inline-flex items-center justify-center text-xs w-6 h-6 rounded-full mb-1 ${
                  isToday ? "bg-blue-600 text-white" : "text-gray-700"
                }`}
              >
                {date.getDate()}
              </span>
              <div className="space-y-1">
                {dayBookings.slice(0, 3).map((booking) => (
                  <div
                    key={booking.id}
                    className={`flex items-center gap-1 text-xs px-1 py-0.5 rounded ${statusBadgeClass(
                      booking.status
                    )}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${statusDotClass(
                        booking.status
                      )}`}
                    />
                    <span className="truncate">
                      {user.role === "TUTOR"
                        ? booking.student.name
                        : booking.tutor.name}
                    </span>
                  </div>
                ))}
                {dayBookings.length > 3 && (
                  <div className="text-xs text-gray-500 px-1">
                    +{dayBookings.length - 3} more
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedKey && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">
            {selectedBookings.length > 0
              ? `Bookings on ${new Date(
                  selectedBookings[0].slot.date
                ).toLocaleDateString()}`
              : "No bookings on this day"}
          </h3>
          <div className="grid gap-3">
            {selectedBookings.map((booking) => (
              <div key={booking.id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      {user.role === "TUTOR"
                        ? `Student: ${booking.student.name}`
                        : `Tutor: ${booking.tutor.name}`}
                    </p>
                    <p className="text-sm text-gray-600">
                      {new Date(
                        booking.slot.startTime
                      ).toLocaleTimeString()}{" "}
                      - {new Date(booking.slot.endTime).toLocaleTimeString()}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded text-sm ${statusBadgeClass(
                      booking.status
                    )}`}
                  >
                    {booking.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
