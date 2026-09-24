// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { signInMock, replaceMock, refreshMock } = vi.hoisted(() => ({
  signInMock: vi.fn(), replaceMock: vi.fn(), refreshMock: vi.fn()
}));
vi.mock("next-auth/react", () => ({ signIn: signInMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: replaceMock, refresh: refreshMock }) }));

import { RegisterForm } from "./register-form";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeEach(() => {
  vi.resetAllMocks();
  signInMock.mockResolvedValue({ ok: true, error: null });
});

function submitRegistration() {
  render(<RegisterForm />);
  fireEvent.change(screen.getByLabelText("工号"), { target: { value: "001234" } });
  fireEvent.change(screen.getByLabelText("姓名"), { target: { value: "张三" } });
  fireEvent.change(screen.getByLabelText("密码", { exact: true }), { target: { value: "pass123" } });
  fireEvent.change(screen.getByLabelText("确认密码"), { target: { value: "pass123" } });
  fireEvent.submit(screen.getByRole("button", { name: "注册并进入工作台" }).closest("form")!);
}

describe("register form", () => {
  it("signs in and enters the workspace immediately after registration", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: { employeeNumber: "001234" } }) });
    vi.stubGlobal("fetch", fetchMock);
    submitRegistration();

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
    expect(signInMock).toHaveBeenCalledWith("credentials", {
      employeeNumber: "001234", password: "pass123", redirect: false, redirectTo: "/"
    });
    expect(refreshMock).toHaveBeenCalledOnce();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      employeeNumber: "001234", name: "张三", password: "pass123", confirmPassword: "pass123"
    });
  });

  it("explains that the account exists when automatic login fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: { employeeNumber: "001234" } }) }));
    signInMock.mockResolvedValue({ ok: false, error: "CredentialsSignin" });
    submitRegistration();

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("账号已创建，但自动登录失败"));
    expect(screen.getByRole("button", { name: "账号已创建" }).hasAttribute("disabled")).toBe(true);
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
