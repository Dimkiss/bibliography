import styles from "./ChartCard.module.css";

export function QuartileChart() {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>Распределение по уровням БС</div>
        <div className={styles.chipsMock}>chips</div>
      </div>
      <div className={styles.body}>График (заглушка)</div>
    </div>
  );
}
