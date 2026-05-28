import { useEffect, useMemo, useState } from 'react';

import styles from './AuthorManagementPage.module.css';
import { Header } from '@/widgets/Header';
import { Footer } from '@/widgets/Footer';
import { useAuth } from '@/features/auth';
import { navigateTo } from '@/shared/lib/navigation';
import { ADMIN_ROLE_ID } from '@/entities/role';
import { Button } from '@/shared/ui/Button';
import { OutlineButton } from '@/shared/ui/OutlineButton';
import { TextField } from '@/shared/ui/TextField';
import {
  getAdminAuthorsFull,
  createAdminAuthor,
  updateAdminAuthor,
  deleteAdminAuthor,
  type AuthorFullDto,
} from '@/features/manage-authors';
import { getAdminDepartments, type DepartmentDto } from '@/features/manage-users';

type FormState = {
  name: string;
  position: string;
  degree: string;
  rank: string;
  email: string;
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
  orcid: '',
  scopus_id: '',
  wos_id: '',
  department_id: '',
};

function getAuthorLabel(author: AuthorFullDto): string {
  return author.name;
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

  const [selectedAuthorId, setSelectedAuthorId] = useState<number | null>(null);
  const [editingAuthorId, setEditingAuthorId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(initialFormState);

  const isAdmin = isAuthenticated && user?.role_id === ADMIN_ROLE_ID;

  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      navigateTo('/login');
      return;
    }
    if (!isInitializing && isAuthenticated && !isAdmin) {
      navigateTo('/');
    }
  }, [isAuthenticated, isInitializing, isAdmin]);

  const selectedAuthor = useMemo(
    () => authors.find((a) => a.id === selectedAuthorId) ?? null,
    [authors, selectedAuthorId],
  );

  const isEditMode = editingAuthorId !== null;

  const sortedAuthors = useMemo(
    () => [...authors].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [authors],
  );

  const loadData = async () => {
    setPageError('');
    const [authorsData, departmentsData] = await Promise.all([
      getAdminAuthorsFull(),
      getAdminDepartments(),
    ]);
    setAuthors(authorsData);
    setDepartments(departmentsData);
  };

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      if (isInitializing || !isAuthenticated || !isAdmin) return;

      setIsPageLoading(true);
      setPageError('');

      try {
        const [authorsData, departmentsData] = await Promise.all([
          getAdminAuthorsFull(),
          getAdminDepartments(),
        ]);
        if (!isMounted) return;
        setAuthors(authorsData);
        setDepartments(departmentsData);
      } catch (error) {
        if (!isMounted) return;
        setPageError(error instanceof Error ? error.message : 'Не удалось загрузить данные.');
      } finally {
        if (isMounted) setIsPageLoading(false);
      }
    };

    void init();
    return () => { isMounted = false; };
  }, [isAuthenticated, isInitializing, isAdmin]);

  const handleFormChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleStartCreate = () => {
    setEditingAuthorId(null);
    setSelectedAuthorId(null);
    setForm(initialFormState);
    setFormError('');
    setSuccessMessage('');
  };

  const handleStartEdit = (target: AuthorFullDto) => {
    setEditingAuthorId(target.id);
    setSelectedAuthorId(target.id);
    setFormError('');
    setSuccessMessage('');
    setForm({
      name: target.name,
      position: target.position ?? '',
      degree: target.degree ?? '',
      rank: target.rank ?? '',
      email: target.email ?? '',
      orcid: target.orcid ?? '',
      scopus_id: target.scopus_id ?? '',
      wos_id: target.wos_id ?? '',
      department_id: target.department_id !== null ? String(target.department_id) : '',
    });
  };

  const handleCancelEdit = () => {
    setEditingAuthorId(null);
    setForm(initialFormState);
    setFormError('');
    setSuccessMessage('');
  };

  const validateForm = (): string | null => {
    if (!form.name.trim()) return 'Заполните имя автора.';
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

      if (isEditMode && editingAuthorId !== null) {
        await updateAdminAuthor(editingAuthorId, {
          authorName: form.name.trim(),
          position: form.position.trim() || null,
          degree: form.degree.trim() || null,
          rank: form.rank.trim() || null,
          email: form.email.trim() || null,
          ORCID: form.orcid.trim() || null,
          Scopus_ID: form.scopus_id.trim() || null,
          WOS_ID: form.wos_id.trim() || null,
          DepartmentCode: departmentCode,
        });
        await loadData();
        setSuccessMessage('Автор обновлён.');
      } else {
        const created = await createAdminAuthor({
          authorName: form.name.trim(),
          position: form.position.trim() || null,
          degree: form.degree.trim() || null,
          rank: form.rank.trim() || null,
          email: form.email.trim() || null,
          ORCID: form.orcid.trim() || null,
          Scopus_ID: form.scopus_id.trim() || null,
          WOS_ID: form.wos_id.trim() || null,
          DepartmentCode: departmentCode,
        });
        await loadData();
        setSelectedAuthorId(created.id);
        setForm(initialFormState);
        setSuccessMessage('Автор создан.');
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Не удалось сохранить автора.');
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const handleDeleteAuthor = async (target: AuthorFullDto) => {
    const confirmed = window.confirm(
      `Удалить автора "${getAuthorLabel(target)}"?`,
    );
    if (!confirmed) return;

    setFormError('');
    setSuccessMessage('');

    try {
      await deleteAdminAuthor(target.id);
      if (editingAuthorId === target.id) {
        setEditingAuthorId(null);
        setForm(initialFormState);
      }
      setSelectedAuthorId(null);
      await loadData();
      setSuccessMessage('Автор удалён.');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Не удалось удалить автора.');
    }
  };

  if (isInitializing || !isAuthenticated || !isAdmin) return null;

  return (
    <div className="app-page">
      <Header title="Управление авторами" />

      <main className="app-main">
        <div className="container app-block-group">
          <section className={styles.layout}>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h1 className={styles.title}>Авторы</h1>
                  <p className={styles.subtitle}>
                    Редактирование данных сотрудников и их научных идентификаторов
                  </p>
                </div>
                <Button
                  label="Новый автор"
                  iconName="add"
                  size="normal"
                  onClick={handleStartCreate}
                />
              </div>

              {pageError ? <div className={styles.errorBanner}>{pageError}</div> : null}
              {successMessage ? <div className={styles.successBanner}>{successMessage}</div> : null}

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Имя</th>
                      <th>Должность</th>
                      <th>Степень</th>
                      <th>Подразделение</th>
                      <th>Пользователь</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isPageLoading ? (
                      <tr><td colSpan={7} className={styles.emptyCell}>Загрузка...</td></tr>
                    ) : sortedAuthors.length === 0 ? (
                      <tr><td colSpan={7} className={styles.emptyCell}>Авторы не найдены.</td></tr>
                    ) : (
                      sortedAuthors.map((item) => (
                        <tr
                          key={item.id}
                          className={selectedAuthorId === item.id ? styles.rowSelected : ''}
                          onClick={() => setSelectedAuthorId(item.id)}
                        >
                          <td>{item.id}</td>
                          <td>{item.name}</td>
                          <td>{item.position ?? '—'}</td>
                          <td>{item.degree ?? '—'}</td>
                          <td>{item.department_name ?? '—'}</td>
                          <td>{item.linked_user_login ?? '—'}</td>
                          <td>
                            <div className={styles.rowActions}>
                              <OutlineButton
                                label="Изменить"
                                size="small"
                                iconName="edit"
                                onClick={(event) => { event.stopPropagation(); handleStartEdit(item); }}
                              />
                              <OutlineButton
                                label="Удалить"
                                size="small"
                                iconName="delete"
                                disabled={!item.is_available}
                                onClick={(event) => { event.stopPropagation(); void handleDeleteAuthor(item); }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className={styles.formPanel}>
              <div className={styles.formHeader}>
                <h2 className={styles.formTitle}>
                  {isEditMode ? 'Редактирование автора' : 'Новый автор'}
                </h2>
                <p className={styles.formSubtitle}>
                  {isEditMode
                    ? 'Измените поля и сохраните изменения.'
                    : 'Заполните форму для добавления нового автора.'}
                </p>
              </div>

              <div className={styles.form}>
                <TextField
                  label="Имя автора"
                  value={form.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                />
                <div className={styles.fieldBlock}>
                  <label className={styles.selectLabel} htmlFor="department_id">
                    Подразделение
                  </label>
                  <select
                    id="department_id"
                    className={styles.select}
                    value={form.department_id}
                    onChange={(e) => handleFormChange('department_id', e.target.value)}
                  >
                    <option value="">Без подразделения</option>
                    {departments.map((d) => (
                      <option key={d.id} value={String(d.id)}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <TextField
                  label="Должность"
                  value={form.position}
                  onChange={(e) => handleFormChange('position', e.target.value)}
                />
                <TextField
                  label="Учёная степень"
                  value={form.degree}
                  onChange={(e) => handleFormChange('degree', e.target.value)}
                />
                <TextField
                  label="Звание"
                  value={form.rank}
                  onChange={(e) => handleFormChange('rank', e.target.value)}
                />
                <TextField
                  label="Email"
                  value={form.email}
                  onChange={(e) => handleFormChange('email', e.target.value)}
                />
                <TextField
                  label="ORCID"
                  value={form.orcid}
                  onChange={(e) => handleFormChange('orcid', e.target.value)}
                />
                <TextField
                  label="Scopus ID"
                  value={form.scopus_id}
                  onChange={(e) => handleFormChange('scopus_id', e.target.value)}
                />
                <TextField
                  label="WOS ID"
                  value={form.wos_id}
                  onChange={(e) => handleFormChange('wos_id', e.target.value)}
                />

                {formError ? <div className={styles.errorBanner}>{formError}</div> : null}

                <div className={styles.formActions}>
                  <Button
                    label={isEditMode ? 'Сохранить' : 'Создать'}
                    iconName={isEditMode ? 'edit' : 'add'}
                    onClick={() => void handleSubmit()}
                    disabled={isFormSubmitting}
                  />
                  <OutlineButton
                    label="Сбросить"
                    iconName="cancel"
                    onClick={() => {
                      if (isEditMode && selectedAuthor) { handleStartEdit(selectedAuthor); return; }
                      handleStartCreate();
                    }}
                    disabled={isFormSubmitting}
                  />
                  {isEditMode ? (
                    <OutlineButton
                      label="Отмена"
                      onClick={handleCancelEdit}
                      disabled={isFormSubmitting}
                    />
                  ) : null}
                </div>
              </div>

              {selectedAuthor ? (
                <div className={styles.detailsCard}>
                  <h3 className={styles.detailsTitle}>Выбранный автор</h3>
                  <div className={styles.detailsGrid}>
                    {[
                      ['ID', String(selectedAuthor.id)],
                      ['Имя', selectedAuthor.name],
                      ['Должность', selectedAuthor.position ?? '—'],
                      ['Степень', selectedAuthor.degree ?? '—'],
                      ['Звание', selectedAuthor.rank ?? '—'],
                      ['Email', selectedAuthor.email ?? '—'],
                      ['ORCID', selectedAuthor.orcid ?? '—'],
                      ['Scopus ID', selectedAuthor.scopus_id ?? '—'],
                      ['WOS ID', selectedAuthor.wos_id ?? '—'],
                      ['Подразделение', selectedAuthor.department_name ?? '—'],
                      ['Пользователь', selectedAuthor.linked_user_login ?? '—'],
                    ].map(([label, value]) => (
                      <div key={label} className={styles.detailItem}>
                        <span className={styles.detailLabel}>{label}</span>
                        <span className={styles.detailValue}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </aside>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
