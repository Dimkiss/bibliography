import type { ButtonHTMLAttributes } from "react";
import styles from "./OutlineIconButton.module.css";
import { Icon } from "@/shared/ui/Icon";

type OutlineIconButtonSize = "normal" | "small" | "small-x";

type OutlineIconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  iconName: string;
  iconSize?: number;
  iconColored?: boolean;
  size?: OutlineIconButtonSize;
  className?: string;
};

const sizeClassMap: Record<OutlineIconButtonSize, string> = {
  normal: styles.normal,
  small: styles.small,
  "small-x": styles.smallX,
};

const defaultIconSizeMap: Record<OutlineIconButtonSize, number> = {
  normal: 32,
  small: 24,
  "small-x": 20,
};

export const OutlineIconButton = ({
  iconName,
  iconSize,
  iconColored = false,
  size = "normal",
  className = "",
  type = "button",
  disabled = false,
  ...props
}: OutlineIconButtonProps) => {
  const resolvedIconSize = iconSize ?? defaultIconSizeMap[size];

  return (
    <button
      type={type}
      className={[styles.button, sizeClassMap[size], className]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      {...props}
    >
      <Icon
        name={iconName}
        size={resolvedIconSize}
        colored={iconColored}
        className={styles.icon}
      />
    </button>
  );
};
