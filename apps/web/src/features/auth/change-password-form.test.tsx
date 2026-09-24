// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn() }));
vi.mock("next-auth/react", () => ({ signOut: signOutMock }));

import { ChangePasswordForm } from "./change-password-form";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeEach(() => { signOutMock.mockReset().mockResolvedValue(undefined); });

describe("change password form", () => {
  it("signs out to the login page after changing the password", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<ChangePasswordForm />);
    fireEvent.change(screen.getByLabelText("当前密码"), { target: { value: "old-password" } });
    fireEvent.change(screen.getByLabelText("新密码"), { target: { value: "new-password-123" } });
    fireEvent.change(screen.getByLabelText("确认新密码"), { target: { value: "new-password-123" } });
    fireEvent.submit(screen.getByRole("button", { name: "修改密码" }).closest("form")!);
    await waitFor(() => expect(signOutMock).toHaveBeenCalledWith({ redirectTo: "/login?passwordChanged=1" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ currentPassword: "old-password", newPassword: "new-password-123", confirmPassword: "new-password-123" });
  });

  it("shows a mismatch before sending the request", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ChangePasswordForm />);
    fireEvent.change(screen.getByLabelText("当前密码"), { target: { value: "old-password" } });
    fireEvent.change(screen.getByLabelText("新密码"), { target: { value: "new-password-123" } });
    fireEvent.change(screen.getByLabelText("确认新密码"), { target: { value: "different-12345" } });
    fireEvent.submit(screen.getByRole("button", { name: "修改密码" }).closest("form")!);
    expect(screen.getByRole("alert").textContent).toContain("不一致");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("keeps the form open and explains when automatic sign-out fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));
    signOutMock.mockRejectedValue(new Error("sign-out failed"));
    render(<ChangePasswordForm />);
    fireEvent.change(screen.getByLabelText("当前密码"), { target: { value: "old-password" } });
    fireEvent.change(screen.getByLabelText("新密码"), { target: { value: "new-password-123" } });
    fireEvent.change(screen.getByLabelText("确认新密码"), { target: { value: "new-password-123" } });
    fireEvent.submit(screen.getByRole("button", { name: "修改密码" }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("自动退出失败"));
  });
});
