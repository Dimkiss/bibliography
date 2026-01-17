import styles from "./ChartCard.module.css";

export function TypeChart() {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>Распределение по типам</div>
        <div className={styles.chipsMock}>chips</div>
      </div>
      <div className={styles.body}>График (заглушка)</div>
    </div>
  );
}
