import { useEffect, useMemo, useState } from 'react';

import styles from './UserManagementPage.module.css';
import { Header } from '@/widgets/Header';
import { Footer } from '@/widgets/Footer';
import { useAuth } from '@/features/auth';
import { navigateTo } from '@/shared/lib/navigation';
import { ADMIN_ROLE_ID } from '@/entities/role';
import { Button } from '@/shared/ui/Button';
import { OutlineButton } from '@/shared/ui/OutlineButton';
import { TextField } from '@/shared/ui/TextField';
import {
  createAdminUser,
  deleteAdminUser,
  getAdminAuthors,
  getAdminDepartments,
  getAdminRoles,
  getAdminUsers,
  updateAdminUser,
  type AuthorDto,
  type DepartmentDto,
  type RoleDto,
  type UserDto,
} from '@/features/manage-users';

type FormState = {
  login: string;
  full_name: string;
  password: string;
  role_id: string;
  department_id: string;
  author_id: string;
};

const initialFormState: FormState = {
  login: '',
  full_name: '',
  password: '',
  role_id: '',
  department_id: '',
  author_id: '',
};

function getUserLabel(user: UserDto): string {
  const parts = [user.full_name, user.login].filter(Boolean);
  return parts.join(' · ');
}

export function UserManagementPage() {
  const { user, isAuthenticated, isInitializing } = useAuth();

  const [users, setUsers] = useState<UserDto[]>([]);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [authors, setAuthors] = useState<AuthorDto[]>([]);

  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const [pageError, setPageError] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
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

  const selectedUser = useMemo(
    () => users.find((item) => item.id === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  const isEditMode = editingUserId !== null;

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => a.id - b.id);
  }, [users]);

  const loadAuthors = async (userId?: number | null) => {
    const data = await getAdminAuthors({
      availableOnly: true,
      userId: userId ?? undefined,
    });

    setAuthors(data);
  };

  const loadData = async (nextSelectedUserId?: number | null) => {
    setPageError('');

    const [usersData, rolesData, departmentsData] = await Promise.all([
      getAdminUsers(),
      getAdminRoles(),
      getAdminDepartments(),
    ]);

    setUsers(usersData);
    setRoles(rolesData);
    setDepartments(departmentsData);

    const resolvedSelectedUserId =
      typeof nextSelectedUserId === 'number'
        ? nextSelectedUserId
        : selectedUserId;

    await loadAuthors(resolvedSelectedUserId ?? undefined);
  };

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      if (isInitializing || !isAuthenticated || !isAdmin) {
        return;
      }

      setIsPageLoading(true);
      setPageError('');

      try {
        const [usersData, rolesData, departmentsData] = await Promise.all([
          getAdminUsers(),
          getAdminRoles(),
          getAdminDepartments(),
        ]);

        if (!isMounted) {
          return;
        }

        setUsers(usersData);
        setRoles(rolesData);
        setDepartments(departmentsData);

        const authorsData = await getAdminAuthors({ availableOnly: true });

        if (!isMounted) {
          return;
        }

        setAuthors(authorsData);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPageError(
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить данные.',
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
  }, [isAuthenticated, isInitializing, isAdmin]);

  const handleFormChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleStartCreate = async () => {
    setEditingUserId(null);
    setSelectedUserId(null);
    setForm(initialFormState);
    setFormError('');
    setSuccessMessage('');

    try {
      await loadAuthors(null);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить список авторов.',
      );
    }
  };

  const handleStartEdit = async (targetUser: UserDto) => {
    setEditingUserId(targetUser.id);
    setSelectedUserId(targetUser.id);
    setFormError('');
    setSuccessMessage('');
    setForm({
      login: targetUser.login,
      full_name: targetUser.full_name,
      password: '',
      role_id: String(targetUser.role_id),
      department_id: String(targetUser.department_id),
      author_id:
        targetUser.author_id !== null ? String(targetUser.author_id) : '',
    });

    try {
      await loadAuthors(targetUser.id);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить список авторов.',
      );
    }
  };

  const handleCancelEdit = async () => {
    setEditingUserId(null);
    setForm(initialFormState);
    setFormError('');
    setSuccessMessage('');

    try {
      await loadAuthors(selectedUserId);
    } catch {
      // ignore
    }
  };

  const validateForm = (): string | null => {
    if (!form.login.trim()) {
      return 'Заполните логин.';
    }

    if (!form.full_name.trim()) {
      return 'Заполните ФИО.';
    }

    if (!form.role_id) {
      return 'Выберите роль.';
    }

    if (!form.department_id) {
      return 'Выберите подразделение.';
    }

    if (!isEditMode && !form.password.trim()) {
      return 'Укажите пароль.';
    }

    if (form.password && form.password.length < 8) {
      return 'Пароль должен быть не короче 8 символов.';
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
      if (isEditMode && editingUserId !== null) {
        const payload = {
          login: form.login.trim(),
          full_name: form.full_name.trim(),
          role_id: Number(form.role_id),
          department_id: Number(form.department_id),
          author_id: form.author_id ? Number(form.author_id) : null,
          ...(form.password.trim() ? { password: form.password.trim() } : {}),
        };

        const updatedUser = await updateAdminUser(editingUserId, payload);
        await loadData(updatedUser.id);
        setSelectedUserId(updatedUser.id);
        setEditingUserId(updatedUser.id);
        setForm((prev) => ({
          ...prev,
          password: '',
        }));
        setSuccessMessage('Пользователь обновлён.');
      } else {
        const createdUser = await createAdminUser({
          login: form.login.trim(),
          full_name: form.full_name.trim(),
          password: form.password.trim(),
          role_id: Number(form.role_id),
          department_id: Number(form.department_id),
          author_id: form.author_id ? Number(form.author_id) : null,
        });

        await loadData(createdUser.id);
        setSelectedUserId(createdUser.id);
        setEditingUserId(null);
        setForm(initialFormState);
        setSuccessMessage('Пользователь создан.');
      }
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Не удалось сохранить пользователя.',
      );
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const handleDeleteUser = async (targetUser: UserDto) => {
    const confirmed = window.confirm(
      `Удалить пользователя "${getUserLabel(targetUser)}"?`,
    );

    if (!confirmed) {
      return;
    }

    setFormError('');
    setSuccessMessage('');

    try {
      await deleteAdminUser(targetUser.id);

      const nextSelectedUserId =
        selectedUserId === targetUser.id ? null : selectedUserId;

      if (editingUserId === targetUser.id) {
        setEditingUserId(null);
        setForm(initialFormState);
      }

      setSelectedUserId(nextSelectedUserId);
      await loadData(nextSelectedUserId);
      setSuccessMessage('Пользователь удалён.');
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Не удалось удалить пользователя.',
      );
    }
  };

  if (isInitializing || !isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <div className={styles.page}>
      <Header title="Управление пользователями" />

      <main className={styles.main}>
        <div className="container app-block-group">
          <section className={styles.layout}>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h1 className={styles.title}>Пользователи</h1>
                  <p className={styles.subtitle}>
                    Создание, редактирование и удаление учётных записей
                  </p>
                </div>

                <Button
                  label="Новый пользователь"
                  iconName="add"
                  size="normal"
                  onClick={handleStartCreate}
                />
              </div>

              {pageError ? (
                <div className={styles.errorBanner}>{pageError}</div>
              ) : null}

              {successMessage ? (
                <div className={styles.successBanner}>{successMessage}</div>
              ) : null}

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Логин</th>
                      <th>ФИО</th>
                      <th>Роль</th>
                      <th>Подразделение</th>
                      <th>Автор</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isPageLoading ? (
                      <tr>
                        <td colSpan={7} className={styles.emptyCell}>
                          Загрузка...
                        </td>
                      </tr>
                    ) : sortedUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className={styles.emptyCell}>
                          Пользователи не найдены.
                        </td>
                      </tr>
                    ) : (
                      sortedUsers.map((item) => {
                        const isCurrentUser = user?.id === item.id;
                        const isSelected = selectedUserId === item.id;

                        return (
                          <tr
                            key={item.id}
                            className={isSelected ? styles.rowSelected : ''}
                            onClick={() => setSelectedUserId(item.id)}
                          >
                            <td>{item.id}</td>
                            <td>{item.login}</td>
                            <td>{item.full_name}</td>
                            <td>{item.role_name ?? '—'}</td>
                            <td>{item.department_name ?? '—'}</td>
                            <td>{item.author_name ?? '—'}</td>
                            <td>
                              <div className={styles.rowActions}>
                                <OutlineButton
                                  label="Изменить"
                                  size="small"
                                  iconName="edit"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleStartEdit(item);
                                  }}
                                />

                                <OutlineButton
                                  label="Удалить"
                                  size="small"
                                  iconName="delete"
                                  disabled={isCurrentUser}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleDeleteUser(item);
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className={styles.formPanel}>
              <div className={styles.formHeader}>
                <h2 className={styles.formTitle}>
                  {isEditMode ? 'Редактирование пользователя' : 'Новый пользователь'}
                </h2>
                <p className={styles.formSubtitle}>
                  {isEditMode
                    ? 'Измените поля и сохраните изменения.'
                    : 'Заполните форму для создания новой учётной записи.'}
                </p>
              </div>

              <div className={styles.form}>
                <TextField
                  label="Логин"
                  value={form.login}
                  onChange={(event) =>
                    handleFormChange('login', event.target.value)
                  }
                />

                <TextField
                  label="ФИО"
                  value={form.full_name}
                  onChange={(event) =>
                    handleFormChange('full_name', event.target.value)
                  }
                />

                <TextField
                  label={isEditMode ? 'Новый пароль' : 'Пароль'}
                  type="password"
                  value={form.password}
                  supportingText={
                    isEditMode ? 'Оставьте пустым, чтобы не менять пароль.' : ''
                  }
                  onChange={(event) =>
                    handleFormChange('password', event.target.value)
                  }
                />

                <div className={styles.fieldBlock}>
                  <label className={styles.selectLabel} htmlFor="role_id">
                    Роль
                  </label>
                  <select
                    id="role_id"
                    className={styles.select}
                    value={form.role_id}
                    onChange={(event) =>
                      handleFormChange('role_id', event.target.value)
                    }
                  >
                    <option value="">Выберите роль</option>
                    {roles.map((role) => (
                      <option key={role.id} value={String(role.id)}>
                        {role.name}
                      </option>
                    ))}
                  </select>
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
                    <option value="">Выберите подразделение</option>
                    {departments.map((department) => (
                      <option
                        key={department.id}
                        value={String(department.id)}
                      >
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.fieldBlock}>
                  <label className={styles.selectLabel} htmlFor="author_id">
                    Автор
                  </label>
                  <select
                    id="author_id"
                    className={styles.select}
                    value={form.author_id}
                    onChange={(event) =>
                      handleFormChange('author_id', event.target.value)
                    }
                  >
                    <option value="">Без автора</option>
                    {authors.map((author) => (
                      <option key={author.id} value={String(author.id)}>
                        {author.name}
                        {!author.is_available && author.linked_user_login
                          ? ` (привязан к ${author.linked_user_login})`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {formError ? (
                  <div className={styles.errorBanner}>{formError}</div>
                ) : null}

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
                      if (isEditMode && selectedUser) {
                        void handleStartEdit(selectedUser);
                        return;
                      }

                      void handleStartCreate();
                    }}
                    disabled={isFormSubmitting}
                  />

                  {isEditMode ? (
                    <OutlineButton
                      label="Отмена"
                      onClick={() => void handleCancelEdit()}
                      disabled={isFormSubmitting}
                    />
                  ) : null}
                </div>
              </div>

              {selectedUser ? (
                <div className={styles.detailsCard}>
                  <h3 className={styles.detailsTitle}>Выбранный пользователь</h3>

                  <div className={styles.detailsGrid}>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>ID</span>
                      <span className={styles.detailValue}>
                        {selectedUser.id}
                      </span>
                    </div>

                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Логин</span>
                      <span className={styles.detailValue}>
                        {selectedUser.login}
                      </span>
                    </div>

                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>ФИО</span>
                      <span className={styles.detailValue}>
                        {selectedUser.full_name}
                      </span>
                    </div>

                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Роль</span>
                      <span className={styles.detailValue}>
                        {selectedUser.role_name ?? '—'}
                      </span>
                    </div>

                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Подразделение</span>
                      <span className={styles.detailValue}>
                        {selectedUser.department_name ?? '—'}
                      </span>
                    </div>

                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Автор</span>
                      <span className={styles.detailValue}>
                        {selectedUser.author_name ?? '—'}
                      </span>
                    </div>
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
