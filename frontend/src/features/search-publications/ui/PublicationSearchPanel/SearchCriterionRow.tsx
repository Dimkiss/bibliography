import type { RefCallback } from 'react';

import {
  SEARCH_FIELD_OPTIONS,
  formatSearchFieldLabel,
  getSearchFieldPlaceholder,
  type PublicationSearchFormState,
  type SearchFieldKey,
} from '@/entities/publication';
import { DropdownButton } from '@/shared/ui/DropdownButton';
import { Icon } from '@/shared/ui/Icon';
import { TextField } from '@/shared/ui/TextField';
import { getSearchFieldIconName } from '../../lib/searchFieldUi';
import { KeywordSearchInput } from '../KeywordSearchInput';
import styles from './PublicationSearchPanel.module.css';

type SearchCriterionRowProps = {
  field: SearchFieldKey;
  index: number;
  value: PublicationSearchFormState;
  isSelectorOpen: boolean;
  canRemove: boolean;
  selectorRef: RefCallback<HTMLDivElement>;
  onToggleSelector: () => void;
  onCriterionChange: (index: number, nextField: SearchFieldKey) => void;
  onFieldChange: (field: SearchFieldKey, nextValue: string) => void;
  onRemoveCriterion: (index: number) => void;
};

export function SearchCriterionRow({
  field,
  index,
  value,
  isSelectorOpen,
  canRemove,
  selectorRef,
  onToggleSelector,
  onCriterionChange,
  onFieldChange,
  onRemoveCriterion,
}: SearchCriterionRowProps) {
  const handleRemove = () => {
    onRemoveCriterion(index);
  };

  return (
    <>
      <div ref={selectorRef} className="app-search-dropdown-wrap">
        <DropdownButton
          label={formatSearchFieldLabel(field)}
          icon={<Icon name={getSearchFieldIconName(field)} size={18} />}
          size="normal"
          variant="tonal"
          width={248}
          isOpen={isSelectorOpen}
          onClick={onToggleSelector}
        />

        {isSelectorOpen ? (
          <div className="app-search-menu">
            <div className="app-search-options-list">
              {SEARCH_FIELD_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className="app-search-option-button"
                  onClick={() => onCriterionChange(index, option.key)}
                >
                  <span className="app-search-option-icon">
                    <Icon name={getSearchFieldIconName(option.key)} size={18} />
                  </span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {field === 'keyword' ? (
        <KeywordSearchInput
          value={value.keyword}
          placeholder={getSearchFieldPlaceholder(field)}
          onChange={(nextValue) => onFieldChange(field, nextValue)}
          onRemoveCriterion={canRemove ? handleRemove : undefined}
        />
      ) : (
        <div className={styles.inputWrap}>
          <TextField
            variant="plain"
            value={value[field]}
            onChange={(event) => onFieldChange(field, event.target.value)}
            placeholder={getSearchFieldPlaceholder(field)}
            height={40}
            radius={4}
            fieldClassName={styles.searchInputField}
            endContent={
              canRemove ? (
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={handleRemove}
                  aria-label={`Удалить критерий ${formatSearchFieldLabel(field)}`}
                >
                  <Icon name="close" size={18} />
                </button>
              ) : null
            }
          />
        </div>
      )}
    </>
  );
}
