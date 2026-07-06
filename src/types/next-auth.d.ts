import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "TUTOR" | "STUDENT";
    } & DefaultSession["user"];
  }

  interface User {
    role: "TUTOR" | "STUDENT";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "TUTOR" | "STUDENT";
  }
}
