import { useEffect, useState } from 'react';
import { PublicationCard } from '@/components/PublicationCard';
import { getLatestPublications, type PublicationDto } from '@/shared/api/publications';
import { normalizeJournalName } from '@/shared/lib/publications';
import styles from './PublicationList.module.css';

type PublicationViewModel = {
  id: number;
  title: string;
  authors: string;
  journal: string;
  year: number;
  doi: string;
};

function mapPublication(dto: PublicationDto): PublicationViewModel {
  return {
    id: dto.Record_ID,
    title: dto.title,
    authors: dto.authors,
    journal: normalizeJournalName(dto.journal),
    year: dto.year,
    doi: dto.DOI,
  };
}

export function PublicationList() {
  const [items, setItems] = useState<PublicationViewModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadLatestPublications() {
      try {
        setIsLoading(true);
        setError(null);

        const data = await getLatestPublications();

        if (!isMounted) {
          return;
        }

        setItems(data.slice(0, 5).map(mapPublication));
      } catch {
        if (!isMounted) {
          return;
        }

        setError('Не удалось загрузить последние публикации');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadLatestPublications();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className={styles.section} aria-labelledby="latest-publications-title">
      <div className={styles.header}>
        <h2 id="latest-publications-title" className={styles.title}>
          Последние публикации
        </h2>
      </div>

      {isLoading && <div className={styles.state}>Загрузка...</div>}

      {!isLoading && error && <div className={styles.state}>{error}</div>}

      {!isLoading && !error && (
        <div className={styles.list}>
          {items.map((item) => (
            <PublicationCard
              key={item.id}
              title={item.title}
              authors={item.authors}
              journal={item.journal}
              year={item.year}
              doi={item.doi}
            />
          ))}
        </div>
      )}
    </section>
  );
}