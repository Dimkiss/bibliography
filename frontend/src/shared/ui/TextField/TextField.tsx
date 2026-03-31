import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, MouseEventHandler } from "react";

import styles from "./TextField.module.css";
import { Icon } from "@/shared/ui/Icon";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string;
  supportingText?: string;
  error?: boolean;
  errorText?: string;
  leadingIcon?: string;
  trailingIcon?: string;
  onTrailingIconClick?: MouseEventHandler<HTMLButtonElement>;
  rootClassName?: string;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      label,
      supportingText,
      error = false,
      errorText,
      leadingIcon,
      trailingIcon,
      onTrailingIconClick,
      rootClassName = "",
      className = "",
      id,
      disabled = false,
      type = "text",
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    const resolvedSupportingText = error
      ? (errorText ?? supportingText)
      : supportingText;

    const resolvedTrailingIcon = error ? "error-filled" : trailingIcon;

    const rootClasses = [
      styles.root,
      error ? styles.error : "",
      disabled ? styles.disabled : "",
      rootClassName,
    ]
      .filter(Boolean)
      .join(" ");

    const inputClasses = [
      styles.input,
      leadingIcon ? styles.inputWithLeadingIcon : "",
      resolvedTrailingIcon ? styles.inputWithTrailingIcon : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const labelClasses = [
      styles.label,
      leadingIcon ? styles.labelWithLeadingIcon : "",
    ]
      .filter(Boolean)
      .join(" ");

    const showTrailingButton =
      Boolean(resolvedTrailingIcon) &&
      Boolean(onTrailingIconClick) &&
      !error &&
      !disabled;

    return (
      <div className={rootClasses}>
        <div className={styles.field}>
          {leadingIcon ? (
            <span className={styles.leadingIcon} aria-hidden="true">
              <Icon name={leadingIcon} size={24} />
            </span>
          ) : null}

          <input
            ref={ref}
            id={inputId}
            type={type}
            className={inputClasses}
            placeholder=" "
            disabled={disabled}
            aria-invalid={error || undefined}
            {...props}
          />

          <label htmlFor={inputId} className={labelClasses}>
            {label}
          </label>

          {resolvedTrailingIcon ? (
            showTrailingButton ? (
              <button
                type="button"
                className={styles.trailingButton}
                onClick={onTrailingIconClick}
                aria-label="action"
              >
                <Icon name={resolvedTrailingIcon} size={24} />
              </button>
            ) : (
              <span className={styles.trailingIcon} aria-hidden="true">
                <Icon name={resolvedTrailingIcon} size={24} />
              </span>
            )
          ) : null}
        </div>

        {resolvedSupportingText ? (
          <div className={styles.supportingText}>{resolvedSupportingText}</div>
        ) : null}
      </div>
    );
  },
);

TextField.displayName = "TextField";