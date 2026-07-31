"use client";

import { useState } from "react";

type FormFieldProps = {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
};

export function FormField({
  id,
  label,
  type = "text",
  autoComplete,
  required,
  minLength,
}: FormFieldProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && isRevealed ? "text" : type;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-foreground"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={inputType}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          className={`w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] ${
            isPassword ? "pr-10" : ""
          }`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setIsRevealed((revealed) => !revealed)}
            aria-label={isRevealed ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted transition-colors hover:text-foreground"
          >
            <span
              className="material-symbols-outlined text-[20px]"
              aria-hidden="true"
            >
              {isRevealed ? "visibility_off" : "visibility"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
