import { jest } from "@jest/globals";

jest.mock("next-auth", () => ({ getServerSession: jest.fn(async () => ({ user: { id: "e2e-user", role: "STUDENT" } })) }));
jest.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));
