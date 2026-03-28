import styles from "./MainPage.module.css";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export function MainPage() {
  return (
    <div className={styles.page}>
      <Header title="Библиография ЛИН СО РАН" />

      <main className={styles.main}>
        <div className="container">
          <div className={styles.content}>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}