import { useEffect, useState } from 'react';

import { Footer } from '@/widgets/Footer';
import { Header } from '@/widgets/Header';
import {
  PublicationResultsList,
  PublicationSearchPanel,
  PublicationsPagination,
} from '@/features/search-publications';
import {
  buildPublicationsQueryFromForm,
  getPublicationFilters,
  getPublications,
  INITIAL_PUBLICATION_SEARCH_FORM,
  type FilterOptionDto,
  type PublicationFiltersDto,
  type PublicationListItemDto,
  type PublicationSearchFormState,
  type PublicationsPaginationDto,
  type PublicationsSortFieldValue,
  type PublicationSortOrder,
  type SearchFieldKey,
} from '@/entities/publication';
import { Button } from '@/shared/ui/Button';
import { navigateTo } from '@/shared/lib/navigation';
import { ADMIN_ROLE_ID } from '@/entities/role';
import { useAuth } from '@/features/auth';
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
  const { user, isAuthenticated } = useAuth();
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
  const [sortField, setSortField] = useState<PublicationsSortFieldValue>('year');
  const [sortOrder, setSortOrder] = useState<PublicationSortOrder>('desc');
  const [isFiltersLoading, setIsFiltersLoading] = useState(true);
  const [isResultsLoading, setIsResultsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreatePublication = Boolean(
    isAuthenticated && user?.role_id === ADMIN_ROLE_ID,
  );
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
    if (!hasSearched) {
      return;
    }

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
          sortField,
          sortOrder,
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
  }, [
    appliedFields,
    appliedForm,
    hasSearched,
    pagination.page,
    pagination.page_size,
    sortField,
    sortOrder,
  ]);

  const handleFieldChange = (field: SearchFieldKey, nextValue: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: nextValue,
    }));
  };

  const handleSearch = () => {
    setHasSearched(true);
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
    setSortField('year');
    setSortOrder('desc');
    setItems([]);
    setError(null);
    setHasSearched(false);
    setPagination(DEFAULT_PAGINATION);
  };

  return (
    <div className={styles.page}>
      <Header title="Поиск публикаций" />

      <main className={styles.main}>
        <div className="container">
          {canCreatePublication ? (
            <div className={styles.actionsRow}>
              <Button
                label="Добавить публикацию"
                iconName="add"
                size="normal"
                onClick={() => navigateTo('/articles/create')}
              />
            </div>
          ) : null}
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

            {hasSearched ? (
              <div className={styles.resultsBlock}>
                <PublicationResultsList
                  items={items}
                  total={pagination.total}
                  isLoading={isResultsLoading}
                  error={error}
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSortFieldChange={(value) => {
                    setSortField(value);
                    setPagination((prev) => ({
                      ...prev,
                      page: 1,
                    }));
                  }}
                  onSortOrderChange={(value) => {
                    setSortOrder(value);
                    setPagination((prev) => ({
                      ...prev,
                      page: 1,
                    }));
                  }}
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
            ) : null}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
