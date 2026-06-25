"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";

interface TimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface TutorDetail {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  hourlyRate: number | null;
  subjects: { subject: { id: string; name: string } }[];
  timeSlots: TimeSlot[];
}

export default function TutorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [tutor, setTutor] = useState<TutorDetail | null>(null);
  const [message, setMessage] = useState("");
  const { data: session } = useSession();

  useEffect(() => {
    async function fetchTutor() {
      const res = await fetch(`/api/tutors/${id}`);
      if (res.ok) {
        const data = await res.json();
        setTutor(data);
      }
    }
    fetchTutor();
  }, [id]);

  async function handleBook(slotId: string) {
    if (!session) {
      setMessage("Please login to book a slot");
      return;
    }
    const user = session.user as any;

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: user.id,
        tutorId: id,
        slotId,
      }),
    });

    if (res.ok) {
      setMessage("Booking request sent! Waiting for tutor confirmation.");
      // Refresh tutor data
      const tutorRes = await fetch(`/api/tutors/${id}`);
      if (tutorRes.ok) setTutor(await tutorRes.json());
    } else {
      const data = await res.json();
      setMessage(data.error || "Booking failed");
    }
  }

  if (!tutor) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold">{tutor.name}</h1>
      {tutor.bio && <p className="text-gray-600 mt-2">{tutor.bio}</p>}
      {tutor.hourlyRate && (
        <p className="text-xl font-bold text-green-600 mt-2">
          ${tutor.hourlyRate}/hr
        </p>
      )}

      <div className="flex gap-2 mt-4">
        {tutor.subjects.map((s) => (
          <span
            key={s.subject.id}
            className="px-3 py-1 bg-blue-100 text-blue-800 rounded"
          >
            {s.subject.name}
          </span>
        ))}
      </div>

      <h2 className="text-2xl font-semibold mt-8 mb-4">Available Slots</h2>
      {message && (
        <p className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          {message}
        </p>
      )}

      <div className="grid gap-3">
        {tutor.timeSlots.map((slot) => (
          <div
            key={slot.id}
            className="flex justify-between items-center p-4 border rounded-lg"
          >
            <div>
              <p className="font-medium">
                {new Date(slot.date).toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-600">
                {new Date(slot.startTime).toLocaleTimeString()} -{" "}
                {new Date(slot.endTime).toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={() => handleBook(slot.id)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              Book
            </button>
          </div>
        ))}
        {tutor.timeSlots.length === 0 && (
          <p className="text-gray-500">No available slots at the moment.</p>
        )}
      </div>
    </div>
  );
}
