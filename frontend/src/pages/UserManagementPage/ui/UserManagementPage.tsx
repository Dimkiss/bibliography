import { useEffect, useMemo, useRef, useState } from 'react';

import styles from './UserManagementPage.module.css';
import { Header } from '@/widgets/Header';
import { Footer } from '@/widgets/Footer';
import { useAuth } from '@/features/auth';
import { navigateTo } from '@/shared/lib/navigation';
import { ADMIN_ROLE_ID } from '@/entities/role';
import { Button } from '@/shared/ui/Button';
import { OutlineButton } from '@/shared/ui/OutlineButton';
import { OutlineIconButton } from '@/shared/ui/OutlineIconButton';
import { TextField } from '@/shared/ui/TextField';
import { Icon } from '@/shared/ui/Icon';
import { ViewportMenu } from '@/shared/ui/ViewportMenu';
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

function applyAuthorToForm(
  prev: FormState,
  authorId: string,
  authors: AuthorDto[],
): FormState {
  const next = { ...prev, author_id: authorId };

  if (!authorId) {
    return next;
  }

  const author = authors.find((item) => String(item.id) === authorId);

  if (!author) {
    return next;
  }

  next.full_name = author.name;

  if (author.department_id != null) {
    next.department_id = String(author.department_id);
  }

  return next;
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(initialFormState);
  const actionMenuAnchorRef = useRef<HTMLElement | null>(null);

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

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isFormSubmitting) {
        closeModal();
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
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === 'author_id' && value) {
        return applyAuthorToForm(prev, value, authors);
      }

      // Сменили подразделение → сбрасываем автора, если он из другого подразделения
      if (field === 'department_id' && prev.author_id) {
        const currentAuthor = authors.find((a) => String(a.id) === prev.author_id);
        if (
          currentAuthor &&
          currentAuthor.department_id != null &&
          String(currentAuthor.department_id) !== value
        ) {
          next.author_id = '';
        }
      }

      return next;
    });
  };

  // Авторы, доступные для выбора с учётом текущего подразделения в форме
  const filteredAuthors = form.department_id
    ? authors.filter(
        (a) =>
          a.department_id == null ||
          String(a.department_id) === form.department_id,
      )
    : authors;

  const closeModal = (force = false) => {
    if (isFormSubmitting && !force) {
      return;
    }

    setIsModalOpen(false);
    setEditingUserId(null);
    setSelectedUserId(null);
    setForm(initialFormState);
    setFormError('');
  };

  const handleStartCreate = async () => {
    setEditingUserId(null);
    setSelectedUserId(null);
    setForm(initialFormState);
    setFormError('');
    setSuccessMessage('');
    setIsModalOpen(true);

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
    setIsModalOpen(true);

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
    closeModal();

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
        closeModal(true);
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
        closeModal(true);
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
      setOpenActionMenuId(null);
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
    <div className="app-page">
      <Header title="Управление пользователями" />

      <main className="app-main">
        <div className="container app-block-group">
          <section className={styles.layout}>
            <div className="app-surface">
              <div className={styles.panelHeader}>
                <div className={styles.panelHeaderSpacer} />

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
                      <th className={styles.actionsColumn} aria-label="Действия" />
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
                              <div
                                className={styles.rowActions}
                                onClick={(event) => event.stopPropagation()}
                                onMouseDown={(event) => event.stopPropagation()}
                              >
                                <OutlineIconButton
                                  iconName="more_horiz"
                                  iconSize={20}
                                  size="small-x"
                                  aria-label="Действия с пользователем"
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
                                  className={`app-search-menu ${styles.userMenu}`}
                                  role="menu"
                                >
                                    <div className="app-search-options-list">
                                      <button
                                        type="button"
                                        className={`app-search-option-button ${styles.userMenuItem}`}
                                        onClick={() => {
                                          setOpenActionMenuId(null);
                                          void handleStartEdit(item);
                                        }}
                                        role="menuitem"
                                      >
                                        <Icon name="edit" size={24} />
                                        <span>Редактировать</span>
                                      </button>

                                      <button
                                        type="button"
                                        className={`app-search-option-button ${styles.userMenuItem}`}
                                        onClick={() => {
                                          setOpenActionMenuId(null);
                                          void handleDeleteUser(item);
                                        }}
                                        disabled={isCurrentUser}
                                        role="menuitem"
                                      >
                                        <Icon name="delete" size={24} />
                                        <span>Удалить</span>
                                      </button>
                                    </div>
                                </ViewportMenu>
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
          </section>
        </div>
      </main>

      {isModalOpen ? (
        <div
          className={styles.modalOverlay}
          role="presentation"
          onMouseDown={() => closeModal()}
        >
          <div
            className={styles.modalDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-form-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 id="user-form-title" className={styles.modalTitle}>
                  {isEditMode ? 'Редактирование пользователя' : 'Новый пользователь'}
                </h2>
                <p className={styles.modalSubtitle}>
                  {isEditMode
                    ? 'Измените данные пользователя и сохраните изменения.'
                    : 'Заполните карточку нового пользователя.'}
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

                <div className={styles.formFieldWide}>
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
                </div>

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
                    {filteredAuthors.map((author) => (
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
                  <div className={styles.formFieldWide}>
                    <div className={styles.errorBanner}>{formError}</div>
                  </div>
                ) : null}
            </div>

            <div className={styles.modalActions}>
              <OutlineButton
                label="Отмена"
                iconName="cancel"
                onClick={() => void handleCancelEdit()}
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
