"use client";

import { useId, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};

export function PasswordField({
  label,
  id,
  className,
  ...inputProps
}: Props) {
  const autoId = useId();
  const inputId = id || autoId;
  const [visible, setVisible] = useState(false);

  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <div className="relative">
        <input
          {...inputProps}
          id={inputId}
          type={visible ? "text" : "password"}
          className={`w-full pe-20 ${className || ""}`}
        />
        <button
          type="button"
          className="absolute inset-y-0 end-0 px-3 text-sm font-medium text-[var(--brand)]"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          aria-pressed={visible}
          tabIndex={0}
        >
          {visible ? "إخفاء" : "إظهار"}
        </button>
      </div>
    </div>
  );
}
