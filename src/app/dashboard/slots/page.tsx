"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface TimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
}

export default function ManageSlotsPage() {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [formData, setFormData] = useState({
    date: "",
    startTime: "",
    endTime: "",
  });
  const { data: session } = useSession();

  useEffect(() => {
    if (session) {
      const user = session.user as any;
      fetchSlots(user.id);
    }
  }, [session]);

  async function fetchSlots(tutorId: string) {
    const res = await fetch(`/api/tutors/${tutorId}/slots`);
    if (res.ok) {
      const data = await res.json();
      setSlots(data);
    }
  }

  async function handleAddSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;

    const user = session.user as any;
    const { date, startTime, endTime } = formData;
    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = new Date(`${date}T${endTime}`);

    const res = await fetch(`/api/tutors/${user.id}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: new Date(date).toISOString(),
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
      }),
    });

    if (res.ok) {
      setFormData({ date: "", startTime: "", endTime: "" });
      fetchSlots(user.id);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Manage Time Slots</h1>

      <form
        onSubmit={handleAddSlot}
        className="mb-8 p-6 border rounded-lg space-y-4"
      >
        <h2 className="text-xl font-semibold">Add New Slot</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Start Time</label>
            <input
              type="time"
              value={formData.startTime}
              onChange={(e) =>
                setFormData({ ...formData, startTime: e.target.value })
              }
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Time</label>
            <input
              type="time"
              value={formData.endTime}
              onChange={(e) =>
                setFormData({ ...formData, endTime: e.target.value })
              }
              className="w-full p-2 border rounded"
              required
            />
          </div>
        </div>
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Add Slot
        </button>
      </form>

      <h2 className="text-xl font-semibold mb-4">Your Slots</h2>
      <div className="grid gap-3">
        {slots.map((slot) => (
          <div
            key={slot.id}
            className={`p-4 border rounded-lg ${slot.isBooked ? "bg-gray-50" : ""}`}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">
                  {new Date(slot.date).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-600">
                  {new Date(slot.startTime).toLocaleTimeString()} -{" "}
                  {new Date(slot.endTime).toLocaleTimeString()}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded text-sm ${
                  slot.isBooked
                    ? "bg-red-100 text-red-800"
                    : "bg-green-100 text-green-800"
                }`}
              >
                {slot.isBooked ? "Booked" : "Available"}
              </span>
            </div>
          </div>
        ))}
        {slots.length === 0 && (
          <p className="text-gray-500">No slots added yet.</p>
        )}
      </div>
    </div>
  );
}
