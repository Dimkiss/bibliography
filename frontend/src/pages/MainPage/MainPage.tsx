import styles from "./MainPage.module.css";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PublicationList } from "@/components/PublicationList";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";

export function MainPage() {
  return (
    <div className={styles.page}>
      <Header title="Библиография ЛИН СО РАН" />

      <main className={styles.main}>
        <div className="container">
          <div className={styles.content}>
            <AnalyticsPanel />
            <PublicationList />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}