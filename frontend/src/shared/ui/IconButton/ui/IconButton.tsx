import styles from "./IconButton.module.css";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  ariaLabel: string;
  className?: string;
};

export function IconButton({ ariaLabel, className = "", ...props }: Props) {
  return (
    <button
      aria-label={ariaLabel}
      className={`${styles.btn} ${className}`}
      {...props}
    />
  );
}
