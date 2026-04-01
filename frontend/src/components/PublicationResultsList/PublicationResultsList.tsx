import type { PublicationListItemDto } from '@/shared/api/publications';
import { PublicationResultCard } from '@/components/PublicationResultCard';
import styles from './PublicationResultsList.module.css';

type PublicationResultsListProps = {
  items: PublicationListItemDto[];
  total: number;
  isLoading?: boolean;
  error?: string | null;
};

export function PublicationResultsList({
  items,
  total,
  isLoading = false,
  error = null,
}: PublicationResultsListProps) {
  return (
    <section className={styles.section}>
      <div className={styles.summary}>Найдено: {total} записей</div>

      {isLoading ? <div className={styles.state}>Загрузка публикаций...</div> : null}

      {!isLoading && error ? <div className={styles.state}>{error}</div> : null}

      {!isLoading && !error && !items.length ? (
        <div className={styles.state}>По вашему запросу публикации не найдены.</div>
      ) : null}

      {!isLoading && !error && items.length ? (
        <div className={styles.list}>
          {items.map((item) => (
            <PublicationResultCard key={item.id} item={item} />
          ))}
        </div>
      ) : null}
    </section>
  );
}