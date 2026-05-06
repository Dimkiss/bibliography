import { forwardRef, useId } from "react";
import type {
  CSSProperties,
  InputHTMLAttributes,
  MouseEventHandler,
  ReactNode,
} from "react";

import styles from "./TextField.module.css";
import { Icon } from "@/shared/ui/Icon";

type TextFieldVariant = "floating" | "plain";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: string;
  supportingText?: string;
  error?: boolean;
  errorText?: string;
  leadingIcon?: string;
  trailingIcon?: string;
  onTrailingIconClick?: MouseEventHandler<HTMLButtonElement>;
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  startContent?: ReactNode;
  endContent?: ReactNode;
  rootClassName?: string;
  fieldClassName?: string;
  inputClassName?: string;
  onRootClick?: MouseEventHandler<HTMLDivElement>;
  variant?: TextFieldVariant;
  wrapContent?: boolean;
};

function toCssSize(value: number | string | undefined): string | undefined {
  if (typeof value === "number") {
    return `${value}px`;
  }

  return value;
}

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
      width,
      height,
      radius,
      startContent,
      endContent,
      rootClassName = "",
      fieldClassName = "",
      inputClassName = "",
      onRootClick,
      variant = "floating",
      wrapContent = false,
      className = "",
      placeholder,
      style,
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
    const isPlain = variant === "plain";

    const rootStyle: CSSProperties = {
      ...style,
      "--text-field-width": toCssSize(width),
      "--text-field-height": toCssSize(height),
      "--text-field-radius": toCssSize(radius),
    } as CSSProperties;

    const rootClasses = [
      styles.root,
      isPlain ? styles.plain : "",
      wrapContent ? styles.wrapContent : "",
      error ? styles.error : "",
      disabled ? styles.disabled : "",
      rootClassName,
    ]
      .filter(Boolean)
      .join(" ");

    const inputClasses = [
      styles.input,
      leadingIcon ? styles.inputWithLeadingIcon : "",
      resolvedTrailingIcon || endContent ? styles.inputWithTrailingIcon : "",
      inputClassName,
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
      <div className={rootClasses} style={rootStyle} onClick={onRootClick}>
        <div className={[styles.field, fieldClassName].filter(Boolean).join(" ")}>
          {startContent}

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
            placeholder={isPlain ? placeholder : " "}
            disabled={disabled}
            aria-invalid={error || undefined}
            {...props}
          />

          {!isPlain && label ? (
            <label htmlFor={inputId} className={labelClasses}>
              {label}
            </label>
          ) : null}

          {endContent}

          {!endContent && resolvedTrailingIcon ? (
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
