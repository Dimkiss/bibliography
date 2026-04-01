import { useEffect, useMemo, useState } from 'react';

import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { PublicationResultsList } from '@/components/PublicationResultsList';
import { PublicationSearchPanel } from '@/components/PublicationSearchPanel';
import { PublicationsPagination } from '@/components/PublicationsPagination';
import {
  getPublicationFilters,
  getPublications,
  type FilterOptionDto,
  type PublicationFiltersDto,
  type PublicationListItemDto,
  type PublicationsPaginationDto,
} from '@/shared/api/publications';
import {
  buildPublicationsQueryFromForm,
  INITIAL_PUBLICATION_SEARCH_FORM,
  type PublicationSearchFormState,
  type SearchFieldKey,
} from '@/shared/lib/publications';
import styles from './PublicationsPage.module.css';

const DEFAULT_ACTIVE_FIELDS: SearchFieldKey[] = ['author'];

const DEFAULT_PAGINATION: PublicationsPaginationDto = {
  page: 1,
  page_size: 10,
  total: 0,
  total_pages: 0,
};

const EMPTY_FILTERS: PublicationFiltersDto = {
  year_min: null,
  year_max: null,
  publication_types: [],
  databases: [],
  original_translation_modes: [],
};

export function PublicationsPage() {
  const [filters, setFilters] = useState<PublicationFiltersDto>(EMPTY_FILTERS);
  const [form, setForm] = useState<PublicationSearchFormState>(
    INITIAL_PUBLICATION_SEARCH_FORM,
  );
  const [activeFields, setActiveFields] = useState<SearchFieldKey[]>(
    DEFAULT_ACTIVE_FIELDS,
  );
  const [items, setItems] = useState<PublicationListItemDto[]>([]);
  const [pagination, setPagination] = useState<PublicationsPaginationDto>(
    DEFAULT_PAGINATION,
  );
  const [appliedForm, setAppliedForm] = useState<PublicationSearchFormState>(
    INITIAL_PUBLICATION_SEARCH_FORM,
  );
  const [appliedFields, setAppliedFields] = useState<SearchFieldKey[]>(
    DEFAULT_ACTIVE_FIELDS,
  );
  const [isFiltersLoading, setIsFiltersLoading] = useState(true);
  const [isResultsLoading, setIsResultsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadFilters() {
      try {
        setIsFiltersLoading(true);
        const data = await getPublicationFilters();

        if (!isMounted) {
          return;
        }

        const normalizedModes: FilterOptionDto[] = data.original_translation_modes.length
          ? data.original_translation_modes
          : [
              { value: 'all', label: 'Все' },
              { value: 'original_only', label: 'Только оригиналы' },
              { value: 'translation_only', label: 'Только переводы' },
              { value: 'linked_only', label: 'Комбинировать' },
            ];

        setFilters({
          ...data,
          original_translation_modes: normalizedModes,
        });
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Не удалось загрузить фильтры.',
        );
      } finally {
        if (isMounted) {
          setIsFiltersLoading(false);
        }
      }
    }

    void loadFilters();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadResults() {
      try {
        setIsResultsLoading(true);
        setError(null);

        const query = buildPublicationsQueryFromForm(
          appliedForm,
          appliedFields,
          pagination.page,
          pagination.page_size,
        );

        const response = await getPublications(query);

        if (!isMounted) {
          return;
        }

        setItems(response.items);
        setPagination(response.pagination);
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Не удалось загрузить публикации.',
        );
      } finally {
        if (isMounted) {
          setIsResultsLoading(false);
        }
      }
    }

    void loadResults();

    return () => {
      isMounted = false;
    };
  }, [appliedFields, appliedForm, pagination.page, pagination.page_size]);

  const handleFieldChange = (field: SearchFieldKey, nextValue: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: nextValue,
    }));
  };

  const handleSearch = () => {
    setAppliedForm({
      ...form,
      publicationTypes: [...form.publicationTypes],
      databases: [...form.databases],
    });
    setAppliedFields([...activeFields]);
    setPagination((prev) => ({
      ...prev,
      page: 1,
    }));
  };

  const handleReset = () => {
    setForm(INITIAL_PUBLICATION_SEARCH_FORM);
    setAppliedForm({
      ...INITIAL_PUBLICATION_SEARCH_FORM,
      publicationTypes: [],
      databases: [],
    });
    setActiveFields(DEFAULT_ACTIVE_FIELDS);
    setAppliedFields([...DEFAULT_ACTIVE_FIELDS]);
    setPagination((prev) => ({
      ...prev,
      page: 1,
      page_size: 10,
    }));
  };

  const resultsTitle = useMemo(() => {
    if (isResultsLoading) {
      return 'Поиск публикаций';
    }

    return pagination.total
      ? `Поиск публикаций · ${pagination.total} записей`
      : 'Поиск публикаций';
  }, [isResultsLoading, pagination.total]);

  return (
    <div className={styles.page}>
      <Header title={resultsTitle} />

      <main className={styles.main}>
        <div className="container">
          <div className={styles.content}>
            <PublicationSearchPanel
              value={form}
              activeFields={activeFields}
              yearMin={filters.year_min}
              yearMax={filters.year_max}
              publicationTypes={filters.publication_types}
              databases={filters.databases}
              originalTranslationModes={filters.original_translation_modes}
              isLoading={isFiltersLoading || isResultsLoading}
              onFieldChange={handleFieldChange}
              onYearRangeChange={(nextValue) =>
                setForm((prev) => ({
                  ...prev,
                  yearFrom: nextValue.from,
                  yearTo: nextValue.to,
                }))
              }
              onPublicationTypesChange={(nextValue) =>
                setForm((prev) => ({
                  ...prev,
                  publicationTypes: nextValue,
                }))
              }
              onDatabasesChange={(nextValue) =>
                setForm((prev) => ({
                  ...prev,
                  databases: nextValue,
                }))
              }
              onOriginalTranslationModeChange={(nextValue) =>
                setForm((prev) => ({
                  ...prev,
                  originalTranslationMode: nextValue,
                }))
              }
              onActiveFieldsChange={setActiveFields}
              onSubmit={handleSearch}
              onReset={handleReset}
            />

            <div className={styles.resultsBlock}>
              <PublicationResultsList
                items={items}
                total={pagination.total}
                isLoading={isResultsLoading}
                error={error}
              />

              <PublicationsPagination
                page={pagination.page}
                pageSize={pagination.page_size}
                totalPages={pagination.total_pages}
                total={pagination.total}
                onPageChange={(nextPage) =>
                  setPagination((prev) => ({
                    ...prev,
                    page: nextPage,
                  }))
                }
                onPageSizeChange={(nextPageSize) =>
                  setPagination((prev) => ({
                    ...prev,
                    page: 1,
                    page_size: nextPageSize,
                  }))
                }
              />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}