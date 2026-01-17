import styles from "./ArticleCard.module.css";
import type { Article } from "../model/types";

export function ArticleCard({ article }: { article: Article }) {
  return (
    <article className={styles.card}>
      <div className={styles.title}>{article.title}</div>
      <div className={styles.meta}>{article.meta}</div>
    </article>
  );
}
