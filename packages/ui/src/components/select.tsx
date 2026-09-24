"use client";

import { useEffect, useId, useRef, useState } from "react";

import { cn } from "../lib/utils";

export type SelectOption = { value: string; label: string; disabled?: boolean };

type SelectProps = {
  "aria-label": string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  className?: string;
};

export function Select({ "aria-label": label, value, onValueChange, options, placeholder = "请选择", disabled = false, name, className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const enabled = options.map((option, index) => !option.disabled ? index : -1).filter((index) => index !== -1);

  function move(direction: number) {
    if (!enabled.length) return;
    const current = enabled.indexOf(activeIndex);
    const next = current === -1 ? direction > 0 ? 0 : enabled.length - 1 : (current + direction + enabled.length) % enabled.length;
    setActiveIndex(enabled[next]);
    setOpen(true);
  }

  function choose(index: number) {
    if (options[index]?.disabled) return;
    onValueChange(options[index].value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return <div className="relative min-w-0" ref={rootRef}>
    {name ? <input name={name} type="hidden" value={value} /> : null}
    <button
      aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
      aria-controls={listId}
      aria-expanded={open}
      aria-label={label}
      aria-haspopup="listbox"
      className={cn("flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border bg-background px-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50", className)}
      disabled={disabled}
      onClick={() => { setActiveIndex(selectedIndex >= 0 && !selected?.disabled ? selectedIndex : enabled[0] ?? -1); setOpen((previous) => !previous); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); move(event.key === "ArrowDown" ? 1 : -1); }
        else if (event.key === "Home" && enabled.length) { event.preventDefault(); setActiveIndex(enabled[0]); setOpen(true); }
        else if (event.key === "End" && enabled.length) { event.preventDefault(); setActiveIndex(enabled[enabled.length - 1]); setOpen(true); }
        else if (open && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); if (activeIndex >= 0) choose(activeIndex); }
        else if (event.key === "Tab") setOpen(false);
      }}
      ref={triggerRef}
      role="combobox"
      type="button"
    >
      <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected?.label ?? placeholder}</span>
      <span aria-hidden="true" className="shrink-0">▾</span>
    </button>
    {open ? <div aria-label={label} className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full min-w-48 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md" id={listId} role="listbox">
      {options.length ? options.map((option, index) => <div
        aria-disabled={option.disabled || undefined}
        aria-selected={option.value === value}
        className={cn("cursor-pointer rounded-sm px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground", activeIndex === index && "bg-accent text-accent-foreground", option.disabled && "cursor-not-allowed opacity-50")}
        id={`${listId}-${index}`}
        key={option.value}
        onClick={() => choose(index)}
        onMouseEnter={() => { if (!option.disabled) setActiveIndex(index); }}
        role="option"
      >{option.label}</div>) : <p className="px-2 py-2 text-sm text-muted-foreground">暂无可选项</p>}
    </div> : null}
  </div>;
}
