"use client";

import { useState, useEffect } from "react";

interface Notification {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
}

async function loadNotifications(userId: string): Promise<Notification[]> {
  const res = await fetch(`/api/notifications?userId=${userId}`);
  if (res.ok) return res.json();
  return [];
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      loadNotifications(user.id).then(setNotifications);
    }
  }, []);

  async function markAsRead(notificationId: string) {
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId }),
    });

    if (res.ok) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Notifications</h1>

      <div className="grid gap-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`p-4 border rounded-lg ${
              notification.read ? "bg-gray-50" : "bg-blue-50 border-blue-200"
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className={notification.read ? "text-gray-600" : "font-medium"}>
                  {notification.message}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {new Date(notification.createdAt).toLocaleString()}
                </p>
              </div>
              {!notification.read && (
                <button
                  onClick={() => markAsRead(notification.id)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Mark read
                </button>
              )}
            </div>
          </div>
        ))}
        {notifications.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            No notifications yet.
          </p>
        )}
      </div>
    </div>
  );
}
