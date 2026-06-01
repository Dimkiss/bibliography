import { useEffect, useMemo, useRef, useState } from 'react';

import styles from './AuthorManagementPage.module.css';
import { Header } from '@/widgets/Header';
import { Footer } from '@/widgets/Footer';
import { useAuth } from '@/features/auth';
import { navigateTo } from '@/shared/lib/navigation';
import {
  ADMIN_ROLE_ID,
  ADMINISTRATION_ROLE_ID,
  DEPARTMENT_HEAD_ROLE_ID,
} from '@/entities/role';
import { Button } from '@/shared/ui/Button';
import { FilterDropdown } from '@/shared/ui/FilterDropdown';
import { OutlineButton } from '@/shared/ui/OutlineButton';
import { OutlineIconButton } from '@/shared/ui/OutlineIconButton';
import { TextField } from '@/shared/ui/TextField';
import { Icon } from '@/shared/ui/Icon';
import { Checkbox } from '@/shared/ui/Checkbox';
import { ViewportMenu } from '@/shared/ui/ViewportMenu';
import {
  getAdminAuthorsFull,
  createAdminAuthor,
  updateAdminAuthor,
  deleteAdminAuthor,
  downloadAdminAuthorsPublicationsReport,
  downloadAdminAuthorsSummaryReport,
  downloadAdminAuthorsExportReport,
  type AuthorFullDto,
} from '@/features/manage-authors';
import { getAdminDepartments, type DepartmentDto } from '@/features/manage-users';

type FormState = {
  name: string;
  position: string;
  degree: string;
  rank: string;
  email: string;
  type: string;
  birthdate: string;
  birth_year: string;
  nickname: string;
  status: string;
  search_pattern: string;
  external_id: string;
  orcid: string;
  scopus_id: string;
  wos_id: string;
  department_id: string;
};

const initialFormState: FormState = {
  name: '',
  position: '',
  degree: '',
  rank: '',
  email: '',
  type: 'О',
  birthdate: '',
  birth_year: '',
  nickname: '',
  status: '1',
  search_pattern: '',
  external_id: '',
  orcid: '',
  scopus_id: '',
  wos_id: '',
  department_id: '',
};

type AuthorSortField = 'id' | 'name' | 'department' | 'position';
type SortOrder = 'asc' | 'desc';
type AuthorReportKind = 'publications' | 'summary' | 'authors';
const MIN_REPORT_YEAR = 1950;
const CURRENT_YEAR = new Date().getFullYear();

function getAuthorLabel(author: AuthorFullDto): string {
  return author.name;
}

function formatAuthorsCountLabel(count: number): string {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return 'автор';
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return 'автора';
  }

  return 'авторов';
}

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return Number(trimmed);
}

export function AuthorManagementPage() {
  const { user, isAuthenticated, isInitializing } = useAuth();

  const [authors, setAuthors] = useState<AuthorFullDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);

  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const [pageError, setPageError] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [editingAuthorId, setEditingAuthorId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [selectedAuthorIds, setSelectedAuthorIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [sortField, setSortField] = useState<AuthorSortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [form, setForm] = useState<FormState>(initialFormState);
  const [reportYearRange, setReportYearRange] = useState({
    from: String(MIN_REPORT_YEAR),
    to: String(CURRENT_YEAR),
  });
  const [downloadingReport, setDownloadingReport] =
    useState<AuthorReportKind | null>(null);
  const actionMenuAnchorRef = useRef<HTMLElement | null>(null);

  // Фильтр по подразделениям (мульти-выбор, клиентская фильтрация)
  const [filterDepartmentIds, setFilterDepartmentIds] = useState<string[]>([]);

  const isAdmin = isAuthenticated && user?.role_id === ADMIN_ROLE_ID;
  const isAdministration = isAuthenticated && user?.role_id === ADMINISTRATION_ROLE_ID;
  const isDepartmentHead = isAuthenticated && user?.role_id === DEPARTMENT_HEAD_ROLE_ID;

  const hasPageAccess = isAdmin || isAdministration || isDepartmentHead;

  // Только администратор может создавать, редактировать и удалять авторов
  const canEdit = isAdmin;

  const departmentFilterOptions = useMemo(
    () => departments.map((d) => ({ value: String(d.id), label: d.name })),
    [departments],
  );

  const isEditMode = editingAuthorId !== null;
  const reportYearFromNumber = Number(reportYearRange.from);
  const reportYearToNumber = Number(reportYearRange.to);
  const isReportYearRangeValid =
    Number.isInteger(reportYearFromNumber) &&
    Number.isInteger(reportYearToNumber) &&
    reportYearFromNumber >= MIN_REPORT_YEAR &&
    reportYearToNumber <= CURRENT_YEAR &&
    reportYearFromNumber <= reportYearToNumber;
  const isAllReportYears =
    isReportYearRangeValid &&
    reportYearFromNumber === MIN_REPORT_YEAR &&
    reportYearToNumber === CURRENT_YEAR;
  const activeReportYearFrom = isAllReportYears ? null : reportYearFromNumber;
  const activeReportYearTo = isAllReportYears ? null : reportYearToNumber;

  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      navigateTo('/login');
      return;
    }

    if (!isInitializing && isAuthenticated && !hasPageAccess) {
      navigateTo('/');
    }
  }, [isAuthenticated, isInitializing, hasPageAccess]);

  const sortedAuthors = useMemo(
    () =>
      [...authors].sort((a, b) => {
        const direction = sortOrder === 'asc' ? 1 : -1;

        if (sortField === 'id') {
          return (a.id - b.id) * direction;
        }

        if (sortField === 'department') {
          return (
            (a.department_name ?? '').localeCompare(b.department_name ?? '', 'ru') *
            direction
          );
        }

        if (sortField === 'position') {
          return (
            (a.position ?? '').localeCompare(b.position ?? '', 'ru') * direction
          );
        }

        return a.name.localeCompare(b.name, 'ru') * direction;
      }),
    [authors, sortField, sortOrder],
  );

  // Клиентская фильтрация по выбранным подразделениям
  const visibleAuthors = useMemo(() => {
    if (filterDepartmentIds.length === 0) {
      return sortedAuthors;
    }
    const selected = new Set(filterDepartmentIds);
    return sortedAuthors.filter(
      (a) => a.department_id !== null && selected.has(String(a.department_id)),
    );
  }, [sortedAuthors, filterDepartmentIds]);

  const selectedAuthorIdSet = useMemo(
    () => new Set(selectedAuthorIds),
    [selectedAuthorIds],
  );

  const selectedAuthorIdsArray = useMemo(
    () => Array.from(selectedAuthorIds),
    [selectedAuthorIds],
  );

  const authorIds = useMemo(
    () => visibleAuthors.map((item) => item.id),
    [visibleAuthors],
  );

  const isAllAuthorsSelected =
    authorIds.length > 0 && authorIds.every((id) => selectedAuthorIdSet.has(id));

  const isAuthorSelectionIndeterminate =
    !isAllAuthorsSelected && authorIds.some((id) => selectedAuthorIdSet.has(id));

  const loadData = async () => {
    setPageError('');
    const [authorsData, departmentsData] = await Promise.all([
      getAdminAuthorsFull(),
      isDepartmentHead ? Promise.resolve([]) : getAdminDepartments(),
    ]);
    setAuthors(authorsData);
    setDepartments(departmentsData);
  };

  // Первичная загрузка данных
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      if (isInitializing || !isAuthenticated || !hasPageAccess) {
        return;
      }

      setIsPageLoading(true);
      setPageError('');

      try {
        const [authorsData, departmentsData] = await Promise.all([
          getAdminAuthorsFull(),
          isDepartmentHead ? Promise.resolve([]) : getAdminDepartments(),
        ]);

        if (!isMounted) {
          return;
        }

        setAuthors(authorsData);
        setDepartments(departmentsData);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPageError(
          error instanceof Error ? error.message : 'Не удалось загрузить данные.',
        );
      } finally {
        if (isMounted) {
          setIsPageLoading(false);
        }
      }
    };

    void init();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, isInitializing, hasPageAccess]);


  useEffect(() => {
    const availableIds = new Set(authors.map((item) => item.id));

    setSelectedAuthorIds((prev) => {
      const next = new Set<number>();
      prev.forEach((id) => {
        if (availableIds.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [authors]);

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isFormSubmitting) {
        setIsModalOpen(false);
        setEditingAuthorId(null);
        setForm(initialFormState);
        setFormError('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormSubmitting, isModalOpen]);

  useEffect(() => {
    if (openActionMenuId === null) {
      return;
    }

    const handleOutsideClick = () => {
      setOpenActionMenuId(null);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openActionMenuId]);

  const handleFormChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const closeModal = (force = false) => {
    if (isFormSubmitting && !force) {
      return;
    }

    setIsModalOpen(false);
    setEditingAuthorId(null);
    setForm(initialFormState);
    setFormError('');
  };

  const handleStartCreate = () => {
    setEditingAuthorId(null);
    setForm(initialFormState);
    setFormError('');
    setSuccessMessage('');
    setIsModalOpen(true);
  };

  const handleStartEdit = (target: AuthorFullDto) => {
    setEditingAuthorId(target.id);
    setFormError('');
    setSuccessMessage('');
    setForm({
      name: target.name,
      position: target.position ?? '',
      degree: target.degree ?? '',
      rank: target.rank ?? '',
      email: target.email ?? '',
      type: target.type ?? 'О',
      birthdate: target.birthdate ?? '',
      birth_year: target.birth_year !== null ? String(target.birth_year) : '',
      nickname: target.nickname ?? '',
      status: target.status !== null ? String(target.status) : '1',
      search_pattern: target.search_pattern ?? '',
      external_id: target.external_id !== null ? String(target.external_id) : '',
      orcid: target.orcid ?? '',
      scopus_id: target.scopus_id ?? '',
      wos_id: target.wos_id ?? '',
      department_id: target.department_id !== null ? String(target.department_id) : '',
    });
    setIsModalOpen(true);
  };

  const validateForm = (): string | null => {
    if (!form.name.trim()) {
      return 'Заполните имя автора.';
    }

    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();

    if (validationError) {
      setFormError(validationError);
      setSuccessMessage('');
      return;
    }

    setIsFormSubmitting(true);
    setFormError('');
    setSuccessMessage('');

    try {
      const departmentCode = form.department_id ? Number(form.department_id) : null;
      const birthYear = toNullableNumber(form.birth_year);
      const externalId = toNullableNumber(form.external_id);

      if (
        (form.birth_year.trim() &&
          (birthYear === null || !Number.isInteger(birthYear))) ||
        (form.external_id.trim() &&
          (externalId === null || !Number.isInteger(externalId)))
      ) {
        setFormError('Год рождения и внешний ID должны быть целыми числами.');
        setIsFormSubmitting(false);
        return;
      }

      const payload = {
        authorName: form.name.trim(),
        position: form.position.trim() || null,
        degree: form.degree.trim() || null,
        rank: form.rank.trim() || null,
        email: form.email.trim() || null,
        type: form.type || 'О',
        birthdate: form.birthdate || null,
        birth_year: birthYear,
        nickname: form.nickname.trim() || null,
        status: form.status ? Number(form.status) : 1,
        search_pattern: form.search_pattern.trim() || null,
        external_id: externalId,
        ORCID: form.orcid.trim() || null,
        Scopus_ID: form.scopus_id.trim() || null,
        WOS_ID: form.wos_id.trim() || null,
        DepartmentCode: departmentCode,
      };

      if (isEditMode && editingAuthorId !== null) {
        await updateAdminAuthor(editingAuthorId, payload);
        setSuccessMessage('Автор обновлён.');
      } else {
        await createAdminAuthor(payload);
        setSuccessMessage('Автор создан.');
      }

      await loadData();
      closeModal(true);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Не удалось сохранить автора.',
      );
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const handleDeleteAuthor = async (target: AuthorFullDto) => {
    const confirmed = window.confirm(
      `Удалить автора "${getAuthorLabel(target)}"?`,
    );

    if (!confirmed) {
      return;
    }

    setFormError('');
    setSuccessMessage('');

    try {
      await deleteAdminAuthor(target.id);
      await loadData();
      setSuccessMessage('Автор удалён.');
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : 'Не удалось удалить автора.',
      );
    }
  };

  const handleTableSort = (field: AuthorSortField) => {
    if (field === sortField) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortOrder('asc');
  };

  const handleToggleAuthorSelection = (authorId: number) => {
    setSelectedAuthorIds((prev) => {
      const next = new Set(prev);

      if (next.has(authorId)) {
        next.delete(authorId);
      } else {
        next.add(authorId);
      }

      return next;
    });
  };

  const handleToggleAllAuthorsSelection = () => {
    setSelectedAuthorIds((prev) => {
      const next = new Set(prev);

      if (isAllAuthorsSelected) {
        authorIds.forEach((id) => next.delete(id));
      } else {
        authorIds.forEach((id) => next.add(id));
      }

      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedAuthorIds(new Set());
  };

  const handleDownloadAuthorsReport = async (kind: AuthorReportKind) => {
    if (!selectedAuthorIdsArray.length) {
      return;
    }

    setPageError('');
    setSuccessMessage('');

    if (kind !== 'authors' && !isReportYearRangeValid) {
      setPageError('Укажите корректный диапазон годов для отчёта.');
      return;
    }

    setDownloadingReport(kind);

    try {
      if (kind === 'publications') {
        await downloadAdminAuthorsPublicationsReport(
          selectedAuthorIdsArray,
          activeReportYearFrom,
          activeReportYearTo,
        );
      } else if (kind === 'summary') {
        await downloadAdminAuthorsSummaryReport(
          selectedAuthorIdsArray,
          activeReportYearFrom,
          activeReportYearTo,
        );
      } else {
        await downloadAdminAuthorsExportReport(selectedAuthorIdsArray);
      }

      setSuccessMessage('Отчёт сформирован.');
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : 'Не удалось сформировать отчёт.',
      );
    } finally {
      setDownloadingReport(null);
    }
  };

  const renderTableHeaderButton = (field: AuthorSortField, label: string) => {
    const isActive = field === sortField;

    return (
      <button
        type="button"
        className={styles.tableHeaderButton}
        onClick={() => handleTableSort(field)}
        aria-label={`Сортировать по полю ${label}`}
      >
        <span>{label}</span>
        {isActive ? (
          <Icon
            name={sortOrder === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
            size={20}
            className={styles.tableSortIcon}
          />
        ) : null}
      </button>
    );
  };

  if (isInitializing || !isAuthenticated || !hasPageAccess) {
    return null;
  }

  // colSpan зависит от наличия колонки действий
  const tableColSpan = canEdit ? 5 : 4;

  return (
    <div className="app-page">
      <Header title="Управление авторами" />

      <main className="app-main">
        <div className="container app-block-group">
          <section className="app-surface">
            <div className={styles.panelHeader}>
              {/* Фильтр по подразделениям — для администратора и администрации */}
              {isAdmin || isAdministration ? (
                <FilterDropdown
                  label="Подразделение"
                  mode="multi"
                  options={departmentFilterOptions}
                  value={filterDepartmentIds}
                  onChange={setFilterDepartmentIds}
                  menuWidth={280}
                />
              ) : null}

              <div className={styles.panelHeaderSpacer} />

              {/* Кнопка «Новый автор» — только для администратора */}
              {canEdit ? (
                <Button
                  label="Новый автор"
                  iconName="add"
                  size="normal"
                  onClick={handleStartCreate}
                />
              ) : null}
            </div>

            {pageError ? <div className={styles.errorBanner}>{pageError}</div> : null}
            {successMessage ? (
              <div className={styles.successBanner}>{successMessage}</div>
            ) : null}

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.selectColumn}>
                      <button
                        type="button"
                        className={styles.tableSelectAllButton}
                        onClick={handleToggleAllAuthorsSelection}
                        disabled={!authorIds.length}
                        aria-label="Выбрать всех авторов"
                        aria-pressed={isAllAuthorsSelected}
                      >
                        <Checkbox
                          checked={isAllAuthorsSelected}
                          indeterminate={isAuthorSelectionIndeterminate}
                          disabled={!authorIds.length}
                        />
                      </button>
                    </th>
                    <th>{renderTableHeaderButton('name', 'ФИО')}</th>
                    <th>{renderTableHeaderButton('department', 'Подразделение')}</th>
                    <th>Идентификаторы</th>
                    {canEdit ? (
                      <th className={styles.actionsColumn} aria-label="Действия" />
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {isPageLoading ? (
                    <tr>
                      <td colSpan={tableColSpan} className={styles.emptyCell}>
                        Загрузка...
                      </td>
                    </tr>
                  ) : sortedAuthors.length === 0 ? (
                    <tr>
                      <td colSpan={tableColSpan} className={styles.emptyCell}>
                        Авторы не найдены.
                      </td>
                    </tr>
                  ) : (
                    visibleAuthors.map((item, index) => (
                      <tr
                        key={item.id}
                        className={styles.authorRow}
                        onClick={() => navigateTo(`/authors/${item.id}`)}
                      >
                        <td className={styles.selectCell}>
                          <div className={styles.tableNumberContent}>
                            <span className={styles.tableNumber}>{index + 1}</span>
                            <button
                              type="button"
                              className={styles.checkboxButton}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleToggleAuthorSelection(item.id);
                              }}
                              aria-label={
                                selectedAuthorIdSet.has(item.id)
                                  ? 'Снять выбор с автора'
                                  : 'Выбрать автора'
                              }
                              aria-pressed={selectedAuthorIdSet.has(item.id)}
                            >
                              <Checkbox checked={selectedAuthorIdSet.has(item.id)} />
                            </button>
                          </div>
                        </td>
                        <td>
                          <div className={styles.nameCell}>
                            <a
                              className={styles.authorLink}
                              href={`/authors/${item.id}`}
                              onClick={(event) => {
                                if (
                                  event.button !== 0 ||
                                  event.metaKey ||
                                  event.ctrlKey ||
                                  event.shiftKey ||
                                  event.altKey
                                ) {
                                  return;
                                }

                                event.preventDefault();
                                navigateTo(`/authors/${item.id}`);
                              }}
                            >
                              {item.name}
                            </a>
                            <span className={styles.authorMeta}>
                              {[item.position, item.degree, item.rank]
                                .filter(Boolean)
                                .join(' · ') || '—'}
                            </span>
                          </div>
                        </td>
                        <td>{item.department_name ?? '—'}</td>
                        <td>
                          <div className={styles.identifiers}>
                            <span>{item.email ? `Email: ${item.email}` : 'Email: —'}</span>
                            <span>{item.orcid ? `ORCID: ${item.orcid}` : 'ORCID: —'}</span>
                            <span>{item.scopus_id ? `Scopus: ${item.scopus_id}` : 'Scopus: —'}</span>
                            <span>{item.wos_id ? `WOS: ${item.wos_id}` : 'WOS: —'}</span>
                          </div>
                        </td>
                        {canEdit ? (
                          <td>
                            <div
                              className={styles.rowActions}
                              onClick={(event) => event.stopPropagation()}
                              onMouseDown={(event) => event.stopPropagation()}
                            >
                              <OutlineIconButton
                                iconName="more_horiz"
                                iconSize={20}
                                size="small-x"
                                aria-label="Действия с автором"
                                aria-expanded={openActionMenuId === item.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  actionMenuAnchorRef.current = event.currentTarget;
                                  setOpenActionMenuId((prev) =>
                                    prev === item.id ? null : item.id,
                                  );
                                }}
                              />

                              <ViewportMenu
                                isOpen={openActionMenuId === item.id}
                                triggerRef={actionMenuAnchorRef}
                                placement="bottom-end"
                                className={`app-search-menu ${styles.authorMenu}`}
                                role="menu"
                              >
                                  <div className="app-search-options-list">
                                    <button
                                      type="button"
                                      className={`app-search-option-button ${styles.authorMenuItem}`}
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        handleStartEdit(item);
                                      }}
                                      role="menuitem"
                                    >
                                      <Icon name="edit" size={24} />
                                      <span>Редактировать</span>
                                    </button>

                                    <button
                                      type="button"
                                      className={`app-search-option-button ${styles.authorMenuItem}`}
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        void handleDeleteAuthor(item);
                                      }}
                                      disabled={!item.is_available}
                                      role="menuitem"
                                    >
                                      <Icon name="delete" size={24} />
                                      <span>Удалить</span>
                                    </button>
                                  </div>
                              </ViewportMenu>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {selectedAuthorIdsArray.length > 0 ? (
        <div
          className={styles.selectionPanel}
          role="region"
          aria-label="Действия с выбранными авторами"
        >
          <div className={styles.selectionInfo}>
            <span className={styles.selectionTitle}>
              Выбрано: {selectedAuthorIdsArray.length}{' '}
              {formatAuthorsCountLabel(selectedAuthorIdsArray.length)}
            </span>
          </div>

          <div className={styles.selectionFilters}>
            <span className={styles.selectionFilterLabel}>Годы:</span>
            <div className="app-year-inputs">
              <input
                className="app-year-input"
                type="number"
                min={MIN_REPORT_YEAR}
                max={CURRENT_YEAR}
                value={reportYearRange.from}
                aria-label="Начальный год отчёта по авторам"
                onChange={(event) =>
                  setReportYearRange((prev) => ({
                    ...prev,
                    from: event.target.value,
                  }))
                }
              />
              <span className="app-year-separator">–</span>
              <input
                className="app-year-input"
                type="number"
                min={MIN_REPORT_YEAR}
                max={CURRENT_YEAR}
                value={reportYearRange.to}
                aria-label="Конечный год отчёта по авторам"
                onChange={(event) =>
                  setReportYearRange((prev) => ({
                    ...prev,
                    to: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className={styles.selectionButtons}>
            <button
              type="button"
              className={styles.selectionButton}
              onClick={() => {
                void handleDownloadAuthorsReport('publications');
              }}
              disabled={downloadingReport !== null}
            >
              <Icon name="arrow-downward" size={20} />
              <span>
                {downloadingReport === 'publications'
                  ? 'Формирование...'
                  : 'Публикации'}
              </span>
            </button>

            <button
              type="button"
              className={styles.selectionButton}
              onClick={() => {
                void handleDownloadAuthorsReport('summary');
              }}
              disabled={downloadingReport !== null}
            >
              <Icon name="arrow-downward" size={20} />
              <span>
                {downloadingReport === 'summary' ? 'Формирование...' : 'Сводка'}
              </span>
            </button>

            <button
              type="button"
              className={styles.selectionButton}
              onClick={() => {
                void handleDownloadAuthorsReport('authors');
              }}
              disabled={downloadingReport !== null}
            >
              <Icon name="arrow-downward" size={20} />
              <span>
                {downloadingReport === 'authors'
                  ? 'Формирование...'
                  : 'Список авторов'}
              </span>
            </button>

            <button
              type="button"
              className={styles.selectionButton}
              onClick={handleClearSelection}
              disabled={downloadingReport !== null}
            >
              <Icon name="close" size={20} />
              <span>Сбросить</span>
            </button>
          </div>
        </div>
      ) : null}

      {isModalOpen && canEdit ? (
        <div
          className={styles.modalOverlay}
          role="presentation"
          onMouseDown={() => closeModal()}
        >
          <div
            className={styles.modalDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="author-form-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 id="author-form-title" className={styles.modalTitle}>
                  {isEditMode ? 'Редактирование автора' : 'Новый автор'}
                </h2>
                <p className={styles.modalSubtitle}>
                  {isEditMode
                    ? 'Измените данные автора и сохраните изменения.'
                    : 'Заполните карточку нового автора.'}
                </p>
              </div>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => closeModal()}
                aria-label="Закрыть окно"
              >
                ×
              </button>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.formFieldWide}>
                <TextField
                  label="ФИО автора"
                  value={form.name}
                  onChange={(event) => handleFormChange('name', event.target.value)}
                />
              </div>

              <div className={styles.fieldBlock}>
                <label className={styles.selectLabel} htmlFor="department_id">
                  Подразделение
                </label>
                <select
                  id="department_id"
                  className={styles.select}
                  value={form.department_id}
                  onChange={(event) =>
                    handleFormChange('department_id', event.target.value)
                  }
                >
                  <option value="">Без подразделения</option>
                  {departments.map((department) => (
                    <option key={department.id} value={String(department.id)}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>

              <TextField
                label="Должность"
                value={form.position}
                onChange={(event) => handleFormChange('position', event.target.value)}
              />
              <TextField
                label="Учёная степень"
                value={form.degree}
                onChange={(event) => handleFormChange('degree', event.target.value)}
              />
              <TextField
                label="Звание"
                value={form.rank}
                onChange={(event) => handleFormChange('rank', event.target.value)}
              />
              <TextField
                label="Email"
                value={form.email}
                onChange={(event) => handleFormChange('email', event.target.value)}
              />
              <div className={styles.fieldBlock}>
                <label className={styles.selectLabel} htmlFor="author_type">
                  Тип
                </label>
                <select
                  id="author_type"
                  className={styles.select}
                  value={form.type}
                  onChange={(event) => handleFormChange('type', event.target.value)}
                >
                  <option value="О">Штатный сотрудник</option>
                  <option value="В">Внештатный</option>
                </select>
              </div>
              <div className={styles.fieldBlock}>
                <label className={styles.selectLabel} htmlFor="author_status">
                  Статус
                </label>
                <select
                  id="author_status"
                  className={styles.select}
                  value={form.status}
                  onChange={(event) => handleFormChange('status', event.target.value)}
                >
                  <option value="1">Работает</option>
                  <option value="2">Временно не работает</option>
                  <option value="0">Уволен</option>
                </select>
              </div>
              <TextField
                label="Дата рождения"
                type="date"
                value={form.birthdate}
                onChange={(event) => handleFormChange('birthdate', event.target.value)}
              />
              <TextField
                label="Год рождения"
                type="number"
                min={1900}
                max={2100}
                value={form.birth_year}
                onChange={(event) => handleFormChange('birth_year', event.target.value)}
              />
              <TextField
                label="Псевдоним"
                value={form.nickname}
                onChange={(event) => handleFormChange('nickname', event.target.value)}
              />
              <TextField
                label="Шаблон поиска"
                value={form.search_pattern}
                onChange={(event) =>
                  handleFormChange('search_pattern', event.target.value)
                }
              />
              <TextField
                label="Внешний ID"
                type="number"
                value={form.external_id}
                onChange={(event) => handleFormChange('external_id', event.target.value)}
              />
              <TextField
                label="ORCID"
                value={form.orcid}
                onChange={(event) => handleFormChange('orcid', event.target.value)}
              />
              <TextField
                label="Scopus ID"
                value={form.scopus_id}
                onChange={(event) => handleFormChange('scopus_id', event.target.value)}
              />
              <TextField
                label="WOS ID"
                value={form.wos_id}
                onChange={(event) => handleFormChange('wos_id', event.target.value)}
              />
            </div>

            {formError ? <div className={styles.errorBanner}>{formError}</div> : null}

            <div className={styles.modalActions}>
              <OutlineButton
                label="Отмена"
                iconName="cancel"
                onClick={() => closeModal()}
                disabled={isFormSubmitting}
              />
              <Button
                label={isEditMode ? 'Сохранить' : 'Создать'}
                iconName={isEditMode ? 'edit' : 'add'}
                onClick={() => void handleSubmit()}
                disabled={isFormSubmitting}
              />
            </div>
          </div>
        </div>
      ) : null}

      <Footer />
    </div>
  );
}
