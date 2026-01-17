import styles from "./TextField.module.css";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  className?: string;
};

export function TextField({ className = "", ...props }: Props) {
  return <input className={`${styles.input} ${className}`} {...props} />;
}
