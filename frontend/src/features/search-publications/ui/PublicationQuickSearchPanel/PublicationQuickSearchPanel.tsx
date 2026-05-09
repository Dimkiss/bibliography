import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import {
  SEARCH_FIELD_OPTIONS,
  formatSearchFieldLabel,
  getSearchFieldPlaceholder,
  getPublicationFilters,
  type PublicationFiltersDto,
  type SearchFieldKey,
} from '@/entities/publication';
import { navigateTo } from '@/shared/lib/navigation';
import { DropdownButton } from '@/shared/ui/DropdownButton';
import { Icon } from '@/shared/ui/Icon';
import { KeywordSearchInput } from '../KeywordSearchInput';
import styles from './PublicationQuickSearchPanel.module.css';

const EMPTY_FILTERS: PublicationFiltersDto = {
  year_min: null,
  year_max: null,
  publication_types: [],
  databases: [],
  original_translation_modes: [],
};

function getFieldIconName(field: SearchFieldKey) {
  switch (field) {
    case 'author':
      return 'person';
    case 'title':
      return 'article-outline';
    case 'journal':
      return 'journal-outline';
    case 'keyword':
      return 'hashtag';
    default:
      return 'person';
  }
}

export function PublicationQuickSearchPanel() {
  const [filters, setFilters] = useState<PublicationFiltersDto>(EMPTY_FILTERS);
  const [field, setField] = useState<SearchFieldKey>('author');
  const [query, setQuery] = useState('');
  const [isYearOpen, setIsYearOpen] = useState(false);
  const [isFieldOpen, setIsFieldOpen] = useState(false);
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const yearDropdownRef = useRef<HTMLDivElement | null>(null);
  const fieldDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadFilters() {
      try {
        const data = await getPublicationFilters();

        if (!isMounted) {
          return;
        }

        setFilters(data);
        setYearFrom(data.year_min ? String(data.year_min) : '');
        setYearTo(data.year_max ? String(data.year_max) : '');
      } catch {
        if (isMounted) {
          setYearTo(String(new Date().getFullYear()));
        }
      }
    }

    void loadFilters();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (yearDropdownRef.current && !yearDropdownRef.current.contains(target)) {
        setIsYearOpen(false);
      }

      if (fieldDropdownRef.current && !fieldDropdownRef.current.contains(target)) {
        setIsFieldOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const periodLabel = useMemo(() => {
    if (yearFrom || yearTo) {
      return `${yearFrom || 'Год от'}-${yearTo || 'Год до'}`;
    }

    return 'Год';
  }, [yearFrom, yearTo]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const searchParams = new URLSearchParams();
    const normalizedQuery = query.trim();

    searchParams.set('field', field);

    if (normalizedQuery) {
      searchParams.set('q', normalizedQuery);
    }

    if (yearFrom.trim()) {
      searchParams.set('yearFrom', yearFrom.trim());
    }

    if (yearTo.trim()) {
      searchParams.set('yearTo', yearTo.trim());
    }

    navigateTo(`/articles?${searchParams.toString()}`);
  };

  return (
    <section
      className={`app-surface ${styles.section}`}
      aria-labelledby="quick-search-title"
    >
      <h2 id="quick-search-title" className={styles.title}>
        Поиск публикаций
      </h2>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div
          ref={yearDropdownRef}
          className={`app-search-dropdown-wrap ${styles.dropdownWrap}`}
        >
          <DropdownButton
            label={periodLabel}
            icon={<Icon name="calendar_renge" size={18} />}
            size="normal"
            variant="tonal"
            width={248}
            isOpen={isYearOpen}
            onClick={() => setIsYearOpen((prev) => !prev)}
          />

          {isYearOpen ? (
            <div className="app-search-menu">
              <div className="app-year-inputs">
                <input
                  className="app-year-input"
                  type="number"
                  inputMode="numeric"
                  placeholder={filters.year_min ? String(filters.year_min) : 'От'}
                  value={yearFrom}
                  onChange={(event) => setYearFrom(event.target.value)}
                />

                <span className="app-year-separator">-</span>

                <input
                  className="app-year-input"
                  type="number"
                  inputMode="numeric"
                  placeholder={filters.year_max ? String(filters.year_max) : 'До'}
                  value={yearTo}
                  onChange={(event) => setYearTo(event.target.value)}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div
          ref={fieldDropdownRef}
          className={`app-search-dropdown-wrap ${styles.dropdownWrap}`}
        >
          <DropdownButton
            label={formatSearchFieldLabel(field)}
            icon={<Icon name={getFieldIconName(field)} size={18} />}
            size="normal"
            variant="tonal"
            width={248}
            isOpen={isFieldOpen}
            onClick={() => setIsFieldOpen((prev) => !prev)}
          />

          {isFieldOpen ? (
            <div className="app-search-menu">
              <div className="app-search-options-list">
                {SEARCH_FIELD_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className="app-search-option-button"
                    onClick={() => {
                      setField(option.key);
                      setIsFieldOpen(false);
                    }}
                  >
                    <span className="app-search-option-icon">
                      <Icon name={getFieldIconName(option.key)} size={18} />
                    </span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {field === 'keyword' ? (
          <div className={styles.keywordSearchField}>
            <KeywordSearchInput
              value={query}
              placeholder={getSearchFieldPlaceholder(field)}
              onChange={setQuery}
              endContent={
                <button
                  type="submit"
                  className={styles.keywordSearchButton}
                  aria-label="Поиск"
                >
                  <Icon name="search" size={24} />
                </button>
              }
            />
          </div>
        ) : (
          <div className={styles.searchField}>
            <input
              className={styles.searchInput}
              value={query}
              placeholder={getSearchFieldPlaceholder(field)}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Поисковый запрос"
            />
            <button type="submit" className={styles.searchButton} aria-label="Поиск">
              <Icon name="search" size={24} />
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
