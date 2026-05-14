import { useEffect, useRef, useState, type FormEvent } from 'react';

import {
  SEARCH_FIELD_OPTIONS,
  type PublicationSearchFormState,
  type SearchFieldKey,
} from '@/entities/publication';
import { Button } from '@/shared/ui/Button';
import { OutlineButton } from '@/shared/ui/OutlineButton';
import { TextButton } from '@/shared/ui/TextButton';
import {
  PublicationsFilterDropdown,
  type PublicationsFilterOption,
} from '../PublicationsFilterDropdown';
import { SearchCriterionRow } from './SearchCriterionRow';
import { YearSearchDropdown } from './YearSearchDropdown';
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
  const [isYearOpen, setIsYearOpen] = useState(false);
  const [openFieldIndex, setOpenFieldIndex] = useState<number | null>(null);

  const yearDropdownRef = useRef<HTMLDivElement | null>(null);
  const fieldDropdownsRef = useRef<Record<number, HTMLDivElement | null>>({});

  const availableFields = SEARCH_FIELD_OPTIONS.filter(
    (option) => !activeFields.includes(option.key),
  );
  const firstActiveField = activeFields[0];
  const restActiveFields = activeFields.slice(1);
  const canRemoveCriteria = activeFields.length > 1;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (yearDropdownRef.current && !yearDropdownRef.current.contains(target)) {
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
      setOpenFieldIndex(null);
      return;
    }

    const existingIndex = nextActiveFields.indexOf(nextField);
    if (existingIndex >= 0) {
      nextActiveFields[existingIndex] = currentField;
    }

    nextActiveFields[index] = nextField;
    onActiveFieldsChange(nextActiveFields);
    setOpenFieldIndex(null);
  };

  const handleRemoveCriterion = (index: number) => {
    if (activeFields.length <= 1) {
      setOpenFieldIndex(null);
      return;
    }

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

  const renderSearchCriterion = (field: SearchFieldKey, index: number) => (
    <SearchCriterionRow
      field={field}
      index={index}
      value={value}
      isSelectorOpen={openFieldIndex === index}
      canRemove={canRemoveCriteria}
      selectorRef={(node) => {
        fieldDropdownsRef.current[index] = node;
      }}
      onToggleSelector={() =>
        setOpenFieldIndex((prev) => (prev === index ? null : index))
      }
      onCriterionChange={handleCriterionChange}
      onFieldChange={onFieldChange}
      onRemoveCriterion={handleRemoveCriterion}
    />
  );

  return (
    <section className={styles.section}>
      <form className={`app-surface ${styles.panel}`} onSubmit={handleSubmit}>
        <div className={styles.topRow}>
          <YearSearchDropdown
            ref={yearDropdownRef}
            value={value}
            yearMin={yearMin}
            yearMax={yearMax}
            isOpen={isYearOpen}
            onOpenChange={setIsYearOpen}
            onYearRangeChange={onYearRangeChange}
          />

          {firstActiveField ? renderSearchCriterion(firstActiveField, 0) : null}
        </div>

        {restActiveFields.map((field, restIndex) => {
          const index = restIndex + 1;

          return (
            <div key={`${field}-${index}`} className={styles.criteriaRow}>
              {renderSearchCriterion(field, index)}
            </div>
          );
        })}

        <div className={styles.actionsRow}>
          <TextButton
            className={styles.addParamButton}
            label="Добавить параметр поиска"
            iconName="add"
            size="normal"
            width={248}
            disabled={!availableFields.length}
            onClick={() => {
              if (!availableFields.length) {
                return;
              }

              onActiveFieldsChange([...activeFields, availableFields[0].key]);
            }}
          />

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
            <OutlineButton
              label="Сброс"
              size="normal"
              width={118}
              onClick={onReset}
            />
            <Button
              type="submit"
              label={isLoading ? 'Поиск...' : 'Поиск'}
              size="normal"
              width={118}
              iconName="search"
              disabled={isLoading}
            />
          </div>
        </div>
      </form>
    </section>
  );
}
