import styles from "./LastArticles.module.css";
import { ArticleCard } from "@/entities/article";
import type { Article } from "@/entities/article";

const mock: Article[] = [
  { id: "1", title: "Публикация 1", meta: "Авторы • 2024" },
  { id: "2", title: "Публикация 2", meta: "Авторы • 2024" },
  { id: "3", title: "Публикация 3", meta: "Авторы • 2023" },
  { id: "4", title: "Публикация 4", meta: "Авторы • 2023" },
  { id: "5", title: "Публикация 5", meta: "Авторы • 2022" },
];

export function LastArticles() {
  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Последние публикации</h2>

      <div className={styles.list}>
        {mock.map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>
    </section>
  );
}
