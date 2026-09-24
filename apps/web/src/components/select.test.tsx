// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Select } from "@report-platform/ui/select";

afterEach(cleanup);

describe("shared Select", () => {
  it("selects by pointer and submits its value with the form", () => {
    const submit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      return new FormData(event.currentTarget).get("templateId");
    });
    function Form() {
      const [value, setValue] = useState("");
      return <form onSubmit={submit}><Select aria-label="模板版本" name="templateId" onValueChange={setValue} options={[{ value: "one", label: "模板一" }]} placeholder="选择模板" value={value} /><button type="submit">提交</button></form>;
    }
    render(<Form />);
    fireEvent.click(screen.getByRole("combobox", { name: "模板版本" }));
    fireEvent.click(screen.getByRole("option", { name: "模板一" }));
    fireEvent.click(screen.getByRole("button", { name: "提交" }));
    expect(submit.mock.results[0].value).toBe("one");
    expect(screen.getByRole("combobox", { name: "模板版本" }).textContent).toContain("模板一");
  });

  it("supports arrow keys, Enter and Escape", () => {
    function Picker() {
      const [value, setValue] = useState("");
      return <Select aria-label="指标" onValueChange={setValue} options={[{ value: "a", label: "甲" }, { value: "b", label: "乙" }]} value={value} />;
    }
    render(<Picker />);
    const trigger = screen.getByRole("combobox", { name: "指标" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(trigger.textContent).toContain("乙");
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
