import type { FormEvent } from 'react';

import { Button } from '@/shared/ui/Button';
import { OutlineButton } from '@/shared/ui/OutlineButton';
import { Icon } from '@/shared/ui/Icon';
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
  const availableFields = SEARCH_FIELD_OPTIONS.filter(
    (option) => !activeFields.includes(option.key),
  );

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
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <section className={styles.section}>
      <form className={styles.panel} onSubmit={handleSubmit}>
        <div className={styles.row}>
          <PublicationsFilterDropdown
            label="Период"
            mode="year-range"
            value={{ from: value.yearFrom, to: value.yearTo }}
            minYear={yearMin}
            maxYear={yearMax}
            onChange={onYearRangeChange}
          />
        </div>

        {activeFields.map((field, index) => (
          <div key={`${field}-${index}`} className={styles.criteriaRow}>
            <label className={styles.fieldLabel}>
              <span className={styles.labelText}>{formatSearchFieldLabel(field)}</span>
              <select
                className={styles.fieldSelect}
                value={field}
                onChange={(event) =>
                  handleCriterionChange(index, event.target.value as SearchFieldKey)
                }
              >
                {SEARCH_FIELD_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

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