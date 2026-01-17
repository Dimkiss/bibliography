import styles from "./ButtonSplit.module.css";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string;
};

export function ButtonSplit({ className = "", ...props }: Props) {
  return <button className={`${styles.btn} ${className}`} {...props} />;
}
