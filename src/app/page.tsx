import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4">Tutor Bank</h1>
      <p className="text-lg text-gray-600 mb-8 text-center max-w-md">
        Find and book tutors for any subject. Tutors can register, set their
        availability, and manage bookings.
      </p>
      <div className="flex gap-4">
        <Link
          href="/register"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Register
        </Link>
        <Link
          href="/login"
          className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          Login
        </Link>
      </div>
      <div className="mt-12">
        <Link
          href="/tutors"
          className="text-blue-600 hover:underline text-lg"
        >
          Browse Tutors →
        </Link>
      </div>
    </div>
  );
}
