import { useEffect, useState } from 'react';

import {
  getLatestPublications,
  normalizeJournalName,
  PublicationCard,
  type PublicationPreviewDto,
} from '@/entities/publication';
import { navigateTo } from '@/shared/lib/navigation';
import styles from './PublicationList.module.css';

type PublicationViewModel = PublicationPreviewDto;

function mapPublication(dto: PublicationPreviewDto): PublicationViewModel {
  return {
    ...dto,
    journal: normalizeJournalName(dto.journal),
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

        const data = await getLatestPublications(5);

        if (!isMounted) {
          return;
        }

        setItems(data.map(mapPublication));
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

    void loadLatestPublications();

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
              onClick={() => navigateTo(`/articles/${item.id}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigateTo(`/articles/${item.id}`);
                }
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
