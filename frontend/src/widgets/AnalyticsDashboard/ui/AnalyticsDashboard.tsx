import styles from "./AnalyticsDashboard.module.css";
import { YearChart, TypeChart, QuartileChart } from "@/entities/analytics";

export function AnalyticsDashboard() {
  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Аналитическая панель</h2>

      <div className={styles.graphs}>
        <YearChart />
        <TypeChart />
        <QuartileChart />
      </div>
    </section>
  );
}
