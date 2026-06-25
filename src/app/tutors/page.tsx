"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Tutor {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  hourlyRate: number | null;
  subjects: { subject: { id: string; name: string } }[];
}

export default function TutorsPage() {
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [searchName, setSearchName] = useState("");
  const [searchSubject, setSearchSubject] = useState("");

  useEffect(() => {
    fetchTutors();
  }, []);

  async function fetchTutors() {
    const params = new URLSearchParams();
    if (searchName) params.set("name", searchName);
    if (searchSubject) params.set("subject", searchSubject);

    const res = await fetch(`/api/tutors?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setTutors(data);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchTutors();
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Find a Tutor</h1>

      <form onSubmit={handleSearch} className="flex gap-4 mb-8">
        <input
          type="text"
          placeholder="Search by name..."
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          className="flex-1 p-3 border rounded-lg"
        />
        <input
          type="text"
          placeholder="Search by subject..."
          value={searchSubject}
          onChange={(e) => setSearchSubject(e.target.value)}
          className="flex-1 p-3 border rounded-lg"
        />
        <button
          type="submit"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Search
        </button>
      </form>

      <div className="grid gap-4">
        {tutors.map((tutor) => (
          <Link
            key={tutor.id}
            href={`/tutors/${tutor.id}`}
            className="block p-6 border rounded-lg hover:shadow-md transition"
          >
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold">{tutor.name}</h2>
                {tutor.bio && (
                  <p className="text-gray-600 mt-1">{tutor.bio}</p>
                )}
                <div className="flex gap-2 mt-2">
                  {tutor.subjects.map((s) => (
                    <span
                      key={s.subject.id}
                      className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded"
                    >
                      {s.subject.name}
                    </span>
                  ))}
                </div>
              </div>
              {tutor.hourlyRate && (
                <span className="text-lg font-bold text-green-600">
                  ${tutor.hourlyRate}/hr
                </span>
              )}
            </div>
          </Link>
        ))}
        {tutors.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            No tutors found. Try adjusting your search.
          </p>
        )}
      </div>
    </div>
  );
}
