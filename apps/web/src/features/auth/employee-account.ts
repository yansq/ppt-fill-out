import { randomUUID } from "node:crypto";

export const employeeNumberSchema = /^\d{6}$/;

export function pendingUsername(employeeNumber: string) {
  return `pending-${employeeNumber}-${randomUUID()}`;
}
