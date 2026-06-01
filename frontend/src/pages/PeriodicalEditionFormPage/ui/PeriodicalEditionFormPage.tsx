import { useEffect, useMemo, useState } from 'react';

import { Footer } from '@/widgets/Footer';
import { Header } from '@/widgets/Header';
import { ADMIN_ROLE_ID } from '@/entities/role';
import {
  buildEditionDetailsPath,
} from '@/entities/edition';
import { useAuth } from '@/features/auth';
import {
  createAdminPeriodicalEdition,
  getAdminPeriodicalEditionForEdit,
  updateAdminPeriodicalEdition,
  type AdminPeriodicalEditionDto,
  type AdminPeriodicalEditionPayload,
  type AdminPeriodicalMetricDto,
  type AdminPeriodicalMetricPayload,
} from '@/features/manage-editions';
import { navigateTo } from '@/shared/lib/navigation';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Icon } from '@/shared/ui/Icon';
import { OutlineButton } from '@/shared/ui/OutlineButton';
import { Select } from '@/shared/ui/Select';
import { TextField } from '@/shared/ui/TextField';
import styles from './PeriodicalEditionFormPage.module.css';

type PeriodicalEditionFormPageProps = {
  sourceId?: number;
};

type MetricFormState = {
  localId: string;
  jId: number | null;
  year: string;
  impactFactor: string;
  fiveYearIf: string;
  wosQuartile: string;
  scopusQuartile: string;
  whiteListLevel: string;
  wos: boolean;
  scopus: boolean;
  rinc: boolean;
  rincCore: boolean;
  rsci: boolean;
  foreign: boolean;
  vak: boolean;
};

type FormState = {
  title: string;
  issn: string;
  isIf: boolean;
  wosName: string;
  elibraryName: string;
  isTranslation: boolean;
  comment: string;
  metrics: MetricFormState[];
};

const EMPTY_FORM: FormState = {
  title: '',
  issn: '',
  isIf: false,
  wosName: '',
  elibraryName: '',
  isTranslation: false,
  comment: '',
  metrics: [],
};

const QUARTILE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'Q1', label: 'Q1' },
  { value: 'Q2', label: 'Q2' },
  { value: 'Q3', label: 'Q3' },
  { value: 'Q4', label: 'Q4' },
  { value: 'Q', label: 'Q' },
  { value: 'S', label: 'S' },
  { value: 'R', label: 'R' },
  { value: 'V', label: 'V' },
];

function makeLocalId() {
  return `metric-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toFormString(value: string | number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function createEmptyMetric(): MetricFormState {
  return {
    localId: makeLocalId(),
    jId: null,
    year: '',
    impactFactor: '',
    fiveYearIf: '',
    wosQuartile: '',
    scopusQuartile: '',
    whiteListLevel: '',
    wos: false,
    scopus: false,
    rinc: false,
    rincCore: false,
    rsci: false,
    foreign: false,
    vak: false,
  };
}

function buildMetricForm(metric: AdminPeriodicalMetricDto): MetricFormState {
  return {
    localId: `metric-${metric.j_id}`,
    jId: metric.j_id,
    year: toFormString(metric.year),
    impactFactor: toFormString(metric.impact_factor),
    fiveYearIf: toFormString(metric.five_year_if),
    wosQuartile: toFormString(metric.wos_quartile),
    scopusQuartile: toFormString(metric.scopus_quartile),
    whiteListLevel: toFormString(metric.white_list_level),
    wos: metric.wos,
    scopus: metric.scopus,
    rinc: metric.rinc,
    rincCore: metric.rinc_core,
    rsci: metric.rsci,
    foreign: metric.foreign,
    vak: metric.vak,
  };
}

function buildForm(data: AdminPeriodicalEditionDto): FormState {
  return {
    title: data.title,
    issn: toFormString(data.issn),
    isIf: data.is_if,
    wosName: toFormString(data.wos_name),
    elibraryName: toFormString(data.elibrary_name),
    isTranslation: data.is_translation,
    comment: toFormString(data.comment),
    metrics: data.metrics.map(buildMetricForm),
  };
}

function isValidWhiteListLevel(value: string): boolean {
  const normalized = value.trim();

  if (!normalized) {
    return true;
  }

  const numericValue = Number(normalized);
  return Number.isInteger(numericValue) && numericValue >= 0;
}

function isValidMetricYear(value: string): boolean {
  const normalized = value.trim();

  if (!normalized) {
    return false;
  }

  const numericValue = Number(normalized);
  return Number.isInteger(numericValue) && numericValue >= 0 && numericValue <= 9999;
}

function parseMetric(metric: MetricFormState): AdminPeriodicalMetricPayload | null {
  if (!isValidMetricYear(metric.year)) {
    return null;
  }

  if (!isValidWhiteListLevel(metric.whiteListLevel)) {
    return null;
  }

  const year = Number(metric.year.trim());

  return {
    j_id: metric.jId,
    year,
    impact_factor: metric.impactFactor.trim() || null,
    five_year_if: metric.fiveYearIf.trim() || null,
    wos_quartile: metric.wosQuartile || null,
    scopus_quartile: metric.scopusQuartile || null,
    white_list_level: metric.whiteListLevel.trim()
      ? Number(metric.whiteListLevel.trim())
      : null,
    wos: metric.wos,
    scopus: metric.scopus,
    rinc: metric.rinc,
    rinc_core: metric.rincCore,
    rsci: metric.rsci,
    foreign: metric.foreign,
    vak: metric.vak,
  };
}

function normalizePayload(form: FormState): AdminPeriodicalEditionPayload | null {
  const metrics: AdminPeriodicalMetricPayload[] = [];

  for (const metric of form.metrics) {
    const parsedMetric = parseMetric(metric);
    if (!parsedMetric) {
      return null;
    }

    metrics.push(parsedMetric);
  }

  return {
    title: form.title.trim(),
    issn: form.issn.trim() || null,
    is_if: form.isIf,
    wos_name: form.wosName.trim() || null,
    elibrary_name: form.elibraryName.trim() || null,
    is_translation: form.isTranslation,
    comment: form.comment.trim() || null,
    metrics,
  };
}

function BooleanToggle({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={[styles.toggleButton, checked ? styles.toggleButtonChecked : '']
        .filter(Boolean)
        .join(' ')}
      onClick={onToggle}
      aria-pressed={checked}
    >
      <Checkbox checked={checked} />
      <span>{label}</span>
    </button>
  );
}

function MetricSelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (nextValue: string) => void;
}) {
  return (
    <label className={styles.selectField}>
      <span>{label}</span>
      <Select
        className={styles.metricSelect}
        variant="outlined"
        width="100%"
        menuWidth={180}
        ariaLabel={label}
        options={options}
        value={value}
        onChange={onChange}
      />
    </label>
  );
}

export function PeriodicalEditionFormPage({
  sourceId,
}: PeriodicalEditionFormPageProps) {
  const { user, isAuthenticated, isInitializing } = useAuth();
  const isEditMode = typeof sourceId === 'number';
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isBootLoading, setIsBootLoading] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const isRoleAllowed = Boolean(isAuthenticated && user?.role_id === ADMIN_ROLE_ID);

  useEffect(() => {
    if (!isInitializing && !isRoleAllowed) {
      navigateTo('/journals');
    }
  }, [isInitializing, isRoleAllowed]);

  useEffect(() => {
    if (!isRoleAllowed || !isEditMode || sourceId === undefined) {
      setIsBootLoading(false);
      return;
    }

    const editSourceId = sourceId;
    let isMounted = true;

    async function loadEdition() {
      try {
        setIsBootLoading(true);
        setError('');

        const data = await getAdminPeriodicalEditionForEdit(editSourceId);

        if (!isMounted) {
          return;
        }

        setForm(buildForm(data));
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Не удалось загрузить периодическое издание.',
        );
      } finally {
        if (isMounted) {
          setIsBootLoading(false);
        }
      }
    }

    void loadEdition();

    return () => {
      isMounted = false;
    };
  }, [isEditMode, isRoleAllowed, sourceId]);

  const pageTitle = isEditMode
    ? 'Редактировать периодическое издание'
    : 'Добавить периодическое издание';
  const hasMetricRows = form.metrics.length > 0;
  const isSubmitDisabled = useMemo(() => {
    if (isSubmitting || !form.title.trim()) {
      return true;
    }

    return form.metrics.some((metric) => {
      return (
        !isValidMetricYear(metric.year)
        || !isValidWhiteListLevel(metric.whiteListLevel)
      );
    });
  }, [form.metrics, form.title, isSubmitting]);

  const updateMetric = (
    localId: string,
    patch: Partial<MetricFormState>,
  ) => {
    setForm((prev) => ({
      ...prev,
      metrics: prev.metrics.map((metric) =>
        metric.localId === localId ? { ...metric, ...patch } : metric,
      ),
    }));
  };

  const addMetric = () => {
    setForm((prev) => ({
      ...prev,
      metrics: [createEmptyMetric(), ...prev.metrics],
    }));
  };

  const removeUnsavedMetric = (localId: string) => {
    setForm((prev) => ({
      ...prev,
      metrics: prev.metrics.filter((metric) => metric.localId !== localId),
    }));
  };

  const handleSubmit = async () => {
    setError('');
    setSuccessMessage('');

    if (!form.title.trim()) {
      setError('Заполни название журнала.');
      return;
    }

    const payload = normalizePayload(form);
    if (!payload) {
      setError('Проверь годы показателей журнала и уровень БС.');
      return;
    }

    setIsSubmitting(true);

    try {
      const savedEdition =
        isEditMode && sourceId !== undefined
          ? await updateAdminPeriodicalEdition(sourceId, payload)
          : await createAdminPeriodicalEdition(payload);

      setSuccessMessage('Периодическое издание сохранено.');

      window.setTimeout(() => {
        navigateTo(buildEditionDetailsPath('periodical', savedEdition.source_id));
      }, 700);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Не удалось сохранить периодическое издание.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-page">
      <Header title={pageTitle} />

      <main className="app-main">
        <div className="container app-block-group">
          <section className={styles.card}>
            {isBootLoading ? (
              <div className={styles.state}>Загрузка формы...</div>
            ) : null}

            {!isBootLoading ? (
              <>
                {error ? (
                  <div className={styles.errorMessage} role="alert">
                    {error}
                  </div>
                ) : null}

                {successMessage ? (
                  <div className={styles.successMessage} role="status">
                    {successMessage}
                  </div>
                ) : null}

                <div className={styles.formGrid}>
                  <TextField
                    label="Название журнала"
                    height={40}
                    radius={4}
                    rootClassName={styles.fullWidthField}
                    fieldClassName={styles.formTextField}
                    inputClassName={styles.formTextFieldInput}
                    value={form.title}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        title: event.target.value,
                      }))
                    }
                  />

                  <div className={styles.rowTwo}>
                    <TextField
                      label="ISSN"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.issn}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          issn: event.target.value,
                        }))
                      }
                    />
                    <TextField
                      label="Название в WoS"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.wosName}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          wosName: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className={styles.rowTwo}>
                    <TextField
                      label="Название в eLibrary"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.elibraryName}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          elibraryName: event.target.value,
                        }))
                      }
                    />
                    <TextField
                      label="Комментарий"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.comment}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          comment: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className={styles.toggleRow}>
                    <BooleanToggle
                      checked={form.isIf}
                      label="Есть импакт-фактор WoS"
                      onToggle={() =>
                        setForm((prev) => ({
                          ...prev,
                          isIf: !prev.isIf,
                        }))
                      }
                    />
                    <BooleanToggle
                      checked={form.isTranslation}
                      label="Есть переводная версия"
                      onToggle={() =>
                        setForm((prev) => ({
                          ...prev,
                          isTranslation: !prev.isTranslation,
                        }))
                      }
                    />
                  </div>
                </div>

                <section className={styles.metricsSection}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Показатели по годам</h2>
                    <Button
                      label="Добавить год"
                      iconName="add"
                      size="small"
                      onClick={addMetric}
                    />
                  </div>

                  {hasMetricRows ? (
                    <div className={styles.metricList}>
                      {form.metrics.map((metric) => (
                        <div key={metric.localId} className={styles.metricCard}>
                          <div className={styles.metricHeader}>
                            <TextField
                              label="Год"
                              height={40}
                              radius={4}
                              type="number"
                              rootClassName={styles.yearField}
                              fieldClassName={styles.formTextField}
                              inputClassName={styles.formTextFieldInput}
                              value={metric.year}
                              onChange={(event) =>
                                updateMetric(metric.localId, {
                                  year: event.target.value,
                                })
                              }
                            />

                            {metric.jId === null ? (
                              <button
                                type="button"
                                className={styles.removeMetricButton}
                                onClick={() => removeUnsavedMetric(metric.localId)}
                                aria-label="Удалить строку показателей"
                              >
                                <Icon name="delete" size={20} />
                              </button>
                            ) : (
                              <span className={styles.metricId}>J_ID {metric.jId}</span>
                            )}
                          </div>

                          <div className={styles.metricGrid}>
                            <TextField
                              label="ИФ"
                              height={40}
                              radius={4}
                              rootClassName={styles.fullWidthField}
                              fieldClassName={styles.formTextField}
                              inputClassName={styles.formTextFieldInput}
                              value={metric.impactFactor}
                              onChange={(event) =>
                                updateMetric(metric.localId, {
                                  impactFactor: event.target.value,
                                })
                              }
                            />
                            <TextField
                              label="ИФ 5-летний"
                              height={40}
                              radius={4}
                              rootClassName={styles.fullWidthField}
                              fieldClassName={styles.formTextField}
                              inputClassName={styles.formTextFieldInput}
                              value={metric.fiveYearIf}
                              onChange={(event) =>
                                updateMetric(metric.localId, {
                                  fiveYearIf: event.target.value,
                                })
                              }
                            />
                            <MetricSelectField
                              label="Q WoS"
                              options={QUARTILE_OPTIONS}
                              value={metric.wosQuartile}
                              onChange={(nextValue) =>
                                updateMetric(metric.localId, {
                                  wosQuartile: nextValue,
                                })
                              }
                            />
                            <MetricSelectField
                              label="Q Scopus"
                              options={QUARTILE_OPTIONS}
                              value={metric.scopusQuartile}
                              onChange={(nextValue) =>
                                updateMetric(metric.localId, {
                                  scopusQuartile: nextValue,
                                })
                              }
                            />
                            <TextField
                              label="УБС"
                              height={40}
                              radius={4}
                              type="number"
                              rootClassName={styles.fullWidthField}
                              fieldClassName={styles.formTextField}
                              inputClassName={styles.formTextFieldInput}
                              value={metric.whiteListLevel}
                              onChange={(event) =>
                                updateMetric(metric.localId, {
                                  whiteListLevel: event.target.value,
                                })
                              }
                            />
                          </div>

                          <div className={styles.metricToggles}>
                            <BooleanToggle
                              checked={metric.wos}
                              label="WoS"
                              onToggle={() =>
                                updateMetric(metric.localId, { wos: !metric.wos })
                              }
                            />
                            <BooleanToggle
                              checked={metric.scopus}
                              label="Scopus"
                              onToggle={() =>
                                updateMetric(metric.localId, {
                                  scopus: !metric.scopus,
                                })
                              }
                            />
                            <BooleanToggle
                              checked={metric.rinc}
                              label="РИНЦ"
                              onToggle={() =>
                                updateMetric(metric.localId, { rinc: !metric.rinc })
                              }
                            />
                            <BooleanToggle
                              checked={metric.rincCore}
                              label="Ядро РИНЦ"
                              onToggle={() =>
                                updateMetric(metric.localId, {
                                  rincCore: !metric.rincCore,
                                })
                              }
                            />
                            <BooleanToggle
                              checked={metric.rsci}
                              label="RSCI"
                              onToggle={() =>
                                updateMetric(metric.localId, { rsci: !metric.rsci })
                              }
                            />
                            <BooleanToggle
                              checked={metric.foreign}
                              label="Зарубежный"
                              onToggle={() =>
                                updateMetric(metric.localId, {
                                  foreign: !metric.foreign,
                                })
                              }
                            />
                            <BooleanToggle
                              checked={metric.vak}
                              label="ВАК"
                              onToggle={() =>
                                updateMetric(metric.localId, { vak: !metric.vak })
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyMetrics}>
                      Показатели по годам не добавлены.
                    </div>
                  )}
                </section>

                <div className={styles.footerActions}>
                  <OutlineButton
                    label="Отмена"
                    className={styles.cancelButton}
                    onClick={() =>
                      navigateTo(
                        isEditMode && sourceId !== undefined
                          ? buildEditionDetailsPath('periodical', sourceId)
                          : '/journals',
                      )
                    }
                  />
                  <Button
                    label={isSubmitting ? 'Сохранение...' : 'Сохранить'}
                    iconName="save"
                    className={styles.submitButton}
                    disabled={isSubmitDisabled}
                    onClick={() => void handleSubmit()}
                  />
                </div>
              </>
            ) : null}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
