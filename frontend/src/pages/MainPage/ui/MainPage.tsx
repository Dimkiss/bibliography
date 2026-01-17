import styles from "./MainPage.module.css";

import { Header } from "@/widgets/Header";
import { Footer } from "@/widgets/Footer";
import { SearchPanel } from "@/widgets/SearchPanel";
import { AnalyticsDashboard } from "@/widgets/AnalyticsDashboard";
import { LastArticles } from "@/widgets/LastArticles";

export function MainPage() {
  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.main}>
        <div className="container">
          <div className={styles.content}>
            <SearchPanel />
            <AnalyticsDashboard />
            <LastArticles />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
