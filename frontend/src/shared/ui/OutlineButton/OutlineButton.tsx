import type { ButtonHTMLAttributes, CSSProperties } from "react";
import styles from "./OutlineButton.module.css";
import { Icon } from "@/shared/ui/Icon";

type OutlineButtonSize = "large" | "normal" | "small";

type OutlineButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  label: string;
  iconName?: string;
  iconSize?: number;
  size?: OutlineButtonSize;
  width?: number | string;
  className?: string;
};

const sizeClassMap: Record<OutlineButtonSize, string> = {
  large: styles.large,
  normal: styles.normal,
  small: styles.small,
};

export const OutlineButton = ({
  label,
  iconName,
  iconSize,
  size = "normal",
  width,
  className = "",
  type = "button",
  disabled = false,
  style,
  ...props
}: OutlineButtonProps) => {
  const resolvedIconSize =
    iconSize ?? (size === "large" ? 24 : size === "normal" ? 20 : 18);
  const rootStyle: CSSProperties | undefined =
    width === undefined
      ? style
      : {
          ...style,
          width: typeof width === "number" ? `${width}px` : width,
        };

  return (
    <button
      type={type}
      className={[styles.button, sizeClassMap[size], className]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      style={rootStyle}
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
