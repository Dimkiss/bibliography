import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { Button } from '@/shared/ui/Button';
import { OutlineButton } from '@/shared/ui/OutlineButton';
import { Icon } from '@/shared/ui/Icon';
import { DropdownButton } from '@/shared/ui/DropdownButton';
import {
  PublicationsFilterDropdown,
  type PublicationsFilterOption,
} from '@/components/PublicationsFilterDropdown';
import {
  SEARCH_FIELD_OPTIONS,
  formatSearchFieldLabel,
  type PublicationSearchFormState,
  type SearchFieldKey,
} from '@/shared/lib/publications';
import styles from './PublicationSearchPanel.module.css';

type PublicationSearchPanelProps = {
  value: PublicationSearchFormState;
  activeFields: SearchFieldKey[];
  yearMin?: number | null;
  yearMax?: number | null;
  publicationTypes: PublicationsFilterOption[];
  databases: PublicationsFilterOption[];
  originalTranslationModes: PublicationsFilterOption[];
  isLoading?: boolean;
  onFieldChange: (field: SearchFieldKey, nextValue: string) => void;
  onYearRangeChange: (nextValue: { from: string; to: string }) => void;
  onPublicationTypesChange: (nextValue: string[]) => void;
  onDatabasesChange: (nextValue: string[]) => void;
  onOriginalTranslationModeChange: (nextValue: string) => void;
  onActiveFieldsChange: (nextValue: SearchFieldKey[]) => void;
  onSubmit: () => void;
  onReset: () => void;
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

export function PublicationSearchPanel({
  value,
  activeFields,
  yearMin,
  yearMax,
  publicationTypes,
  databases,
  originalTranslationModes,
  isLoading = false,
  onFieldChange,
  onYearRangeChange,
  onPublicationTypesChange,
  onDatabasesChange,
  onOriginalTranslationModeChange,
  onActiveFieldsChange,
  onSubmit,
  onReset,
}: PublicationSearchPanelProps) {
  const [isYearOpen, setIsYearOpen] = useState(false);
  const [openFieldIndex, setOpenFieldIndex] = useState<number | null>(null);

  const yearDropdownRef = useRef<HTMLDivElement | null>(null);
  const fieldDropdownsRef = useRef<Record<number, HTMLDivElement | null>>({});

  const availableFields = SEARCH_FIELD_OPTIONS.filter(
    (option) => !activeFields.includes(option.key),
  );

  const periodLabel = useMemo(() => {
    const from = value.yearFrom || (yearMin ? String(yearMin) : 'Год от');
    const to = value.yearTo || (yearMax ? String(yearMax) : 'Год до');
    return `${from}–${to}`;
  }, [value.yearFrom, value.yearTo, yearMin, yearMax]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        yearDropdownRef.current &&
        !yearDropdownRef.current.contains(target)
      ) {
        setIsYearOpen(false);
      }

      if (openFieldIndex !== null) {
        const currentRef = fieldDropdownsRef.current[openFieldIndex];
        if (currentRef && !currentRef.contains(target)) {
          setOpenFieldIndex(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openFieldIndex]);

  const handleCriterionChange = (index: number, nextField: SearchFieldKey) => {
    const currentField = activeFields[index];
    const nextActiveFields = [...activeFields];

    if (currentField === nextField) {
      return;
    }

    const existingIndex = nextActiveFields.indexOf(nextField);
    if (existingIndex >= 0) {
      nextActiveFields[existingIndex] = currentField;
    }

    nextActiveFields[index] = nextField;
    onActiveFieldsChange(nextActiveFields);
  };

  const handleRemoveCriterion = (index: number) => {
    onActiveFieldsChange(
      activeFields.filter((_, currentIndex) => currentIndex !== index),
    );

    if (openFieldIndex === index) {
      setOpenFieldIndex(null);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <section className={styles.section}>
      <form className={styles.panel} onSubmit={handleSubmit}>
        <div className={styles.row}>
          <div ref={yearDropdownRef} className={styles.dropdownWrap}>
            <DropdownButton
              label={periodLabel}
              icon={<Icon name="calendar_month" size={18} />}
              size="small"
              variant="tonal"
              isOpen={isYearOpen}
              onClick={() => setIsYearOpen((prev) => !prev)}
            />

            {isYearOpen ? (
              <div className={styles.menu}>
                <div className={styles.yearPanel}>
                  <div className={styles.yearInputs}>
                    <input
                      className={styles.yearInput}
                      type="number"
                      inputMode="numeric"
                      placeholder={yearMin ? String(yearMin) : 'От'}
                      value={value.yearFrom}
                      onChange={(event) =>
                        onYearRangeChange({
                          from: event.target.value,
                          to: value.yearTo,
                        })
                      }
                    />

                    <span className={styles.yearSeparator}>—</span>

                    <input
                      className={styles.yearInput}
                      type="number"
                      inputMode="numeric"
                      placeholder={yearMax ? String(yearMax) : 'До'}
                      value={value.yearTo}
                      onChange={(event) =>
                        onYearRangeChange({
                          from: value.yearFrom,
                          to: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className={styles.quickActions}>
                    <button
                      type="button"
                      className={styles.quickAction}
                      onClick={() => {
                        const year = yearMax ?? new Date().getFullYear();
                        onYearRangeChange({ from: String(year), to: String(year) });
                        setIsYearOpen(false);
                      }}
                    >
                      Последний год
                    </button>

                    <button
                      type="button"
                      className={styles.quickAction}
                      onClick={() => {
                        const year = yearMax ?? new Date().getFullYear();
                        onYearRangeChange({
                          from: String(year - 2),
                          to: String(year),
                        });
                        setIsYearOpen(false);
                      }}
                    >
                      Последние 3 года
                    </button>

                    <button
                      type="button"
                      className={styles.quickAction}
                      onClick={() => {
                        const year = yearMax ?? new Date().getFullYear();
                        onYearRangeChange({
                          from: String(year - 4),
                          to: String(year),
                        });
                        setIsYearOpen(false);
                      }}
                    >
                      Последние 5 лет
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {activeFields.map((field, index) => (
          <div key={`${field}-${index}`} className={styles.criteriaRow}>
            <div
              ref={(node) => {
                fieldDropdownsRef.current[index] = node;
              }}
              className={styles.dropdownWrap}
            >
              <DropdownButton
                label={formatSearchFieldLabel(field)}
                icon={<Icon name={getFieldIconName(field)} size={18} />}
                size="normal"
                variant="tonal"
                isOpen={openFieldIndex === index}
                onClick={() =>
                  setOpenFieldIndex((prev) => (prev === index ? null : index))
                }
              />

              {openFieldIndex === index ? (
                <div className={styles.menu}>
                  <div className={styles.optionsList}>
                    {SEARCH_FIELD_OPTIONS.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        className={styles.optionButton}
                        onClick={() => {
                          handleCriterionChange(index, option.key);
                          setOpenFieldIndex(null);
                        }}
                      >
                        <span className={styles.optionButtonIcon}>
                          <Icon
                            name={getFieldIconName(option.key)}
                            size={18}
                          />
                        </span>
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className={styles.inputWrap}>
              <input
                className={styles.input}
                value={value[field]}
                onChange={(event) => onFieldChange(field, event.target.value)}
                placeholder={`Введите: ${formatSearchFieldLabel(field).toLowerCase()}`}
              />
              <button
                type="button"
                className={styles.removeButton}
                onClick={() => handleRemoveCriterion(index)}
                aria-label={`Удалить критерий ${formatSearchFieldLabel(field)}`}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          </div>
        ))}

        <div className={styles.actionsRow}>
          <button
            type="button"
            className={styles.addParamButton}
            disabled={!availableFields.length}
            onClick={() => {
              if (!availableFields.length) {
                return;
              }

              onActiveFieldsChange([...activeFields, availableFields[0].key]);
            }}
          >
            <Icon name="add" size={18} />
            <span>Добавить параметр поиска</span>
          </button>

          <div className={styles.filtersWrap}>
            <PublicationsFilterDropdown
              label="Тип публикации"
              mode="multi"
              options={publicationTypes}
              value={value.publicationTypes}
              onChange={onPublicationTypesChange}
            />

            <PublicationsFilterDropdown
              label="Оригинал/Перевод"
              mode="single"
              options={originalTranslationModes}
              value={value.originalTranslationMode}
              onChange={onOriginalTranslationModeChange}
            />

            <PublicationsFilterDropdown
              label="Базы данных"
              mode="multi"
              options={databases}
              value={value.databases}
              onChange={onDatabasesChange}
            />
          </div>

          <div className={styles.submitActions}>
            <OutlineButton label="Сброс" size="normal" onClick={onReset} />
            <Button
              type="submit"
              label={isLoading ? 'Поиск...' : 'Поиск'}
              size="normal"
              iconName="search"
              disabled={isLoading}
            />
          </div>
        </div>
      </form>
    </section>
  );
}