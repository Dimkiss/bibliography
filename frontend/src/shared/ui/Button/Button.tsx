import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";
import { Icon } from "@/shared/ui/Icon";

type ButtonSize = "large" | "normal" | "small";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  iconName?: string;
  iconSize?: number;
  size?: ButtonSize;
  className?: string;
};

const sizeClassMap: Record<ButtonSize, string> = {
  large: styles.large,
  normal: styles.normal,
  small: styles.small,
};

export const Button = ({
  label,
  iconName,
  iconSize,
  size = "normal",
  className = "",
  type = "button",
  disabled = false,
  ...props
}: ButtonProps) => {
  const resolvedIconSize =
    iconSize ?? (size === "large" ? 24 : size === "normal" ? 20 : 18);

  return (
    <button
      type={type}
      className={[styles.button, sizeClassMap[size], className]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      {...props}
    >
      {iconName ? (
        <Icon
          name={iconName}
          size={resolvedIconSize}
          className={styles.icon}
        />
      ) : null}

      <span className={styles.label}>{label}</span>
    </button>
  );
};