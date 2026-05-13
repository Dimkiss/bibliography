import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { TextField } from '@/shared/ui/TextField';
import { Icon } from '@/shared/ui/Icon';
import { KeywordChip } from '../KeywordChip';
import styles from './KeywordSearchInput.module.css';

type KeywordSearchInputProps = {
  value: string;
  placeholder: string;
  onChange: (nextValue: string) => void;
  onRemoveCriterion?: () => void;
  endContent?: ReactNode;
};

function normalizeKeywords(values: string[]): string[] {
  return values
    .map((item) => item.trim())
    .filter(Boolean)
    .filter(
      (item, index, array) =>
        array.findIndex((entry) => entry.toLowerCase() === item.toLowerCase()) === index,
    );
}

function parseKeywords(value: string): string[] {
  return normalizeKeywords(value.split(/[;,\n]/));
}

function serializeKeywords(values: string[]): string {
  return values.join(', ');
}

function commitKeywordDraft(value: string, draft: string): string {
  return serializeKeywords(normalizeKeywords([...parseKeywords(value), draft]));
}

export function KeywordSearchInput({
  value,
  placeholder,
  onChange,
  onRemoveCriterion,
  endContent,
}: KeywordSearchInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [areKeywordsOverflowing, setAreKeywordsOverflowing] = useState(false);
  const [draft, setDraft] = useState('');
  const keywords = useMemo(() => parseKeywords(value), [value]);
  const hasEndContent = Boolean(endContent || onRemoveCriterion);

  useEffect(() => {
    const root = rootRef.current;
    const measure = measureRef.current;

    function updateOverflowState() {
      if (!root || !measure || !keywords.length) {
        setAreKeywordsOverflowing(false);
        return;
      }

      const rootWidth = root.getBoundingClientRect().width;
      const chipsWidth = Array.from(measure.children).reduce(
        (total, child) => total + child.getBoundingClientRect().width,
        0,
      );
      const chipsGap = Math.max(0, measure.children.length - 1) * 10;
      const minInputWidth = draft.trim() || !keywords.length ? 160 : 32;
      const fieldHorizontalSpace = 24;
      const clearButtonSpace = hasEndContent ? 44 : 0;
      const requiredWidth =
        chipsWidth +
        chipsGap +
        minInputWidth +
        fieldHorizontalSpace +
        clearButtonSpace;

      setAreKeywordsOverflowing(requiredWidth > rootWidth);
    }

    const animationFrame = window.requestAnimationFrame(updateOverflowState);
    const resizeObserver =
      root instanceof Element ? new ResizeObserver(updateOverflowState) : null;

    if (root) {
      resizeObserver?.observe(root);
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
    };
  }, [draft, hasEndContent, keywords]);

  const commitDraft = () => {
    const input = inputRef.current;
    if (!input?.value.trim()) {
      return value;
    }

    const nextValue = commitKeywordDraft(value, input.value);
    input.value = '';
    setDraft('');
    onChange(nextValue);
    return nextValue;
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const draft = event.target.value;

    if (!/[;,\n]/.test(draft)) {
      setDraft(draft);
      return;
    }

    const hasTrailingSeparator = /[;,\n]\s*$/.test(draft);
    const parts = draft.split(/[;,\n]/);
    const draftTail = hasTrailingSeparator ? '' : parts.pop() ?? '';
    const nextValue = serializeKeywords(normalizeKeywords([...keywords, ...parts]));

    event.target.value = draftTail;
    setDraft(draftTail);
    onChange(nextValue);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget;

    if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
      if (input.value.trim()) {
        event.preventDefault();
        commitDraft();
      }
      return;
    }

    if (event.key === 'Backspace' && !input.value && keywords.length) {
      event.preventDefault();
      onChange(serializeKeywords(keywords.slice(0, -1)));
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    onChange(
      serializeKeywords(
        keywords.filter((item) => item.toLowerCase() !== keyword.toLowerCase()),
      ),
    );
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <TextField
        ref={inputRef}
        variant="plain"
        height={40}
        radius={4}
        placeholder={keywords.length ? '' : placeholder}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        onRootClick={() => inputRef.current?.focus()}
        fieldClassName={[
          styles.field,
          hasEndContent ? styles.fieldWithEndContent : '',
        ]
          .filter(Boolean)
          .join(' ')}
        inputClassName={[
          styles.input,
          draft.trim() || !keywords.length ? styles.inputActive : '',
        ]
          .filter(Boolean)
          .join(' ')}
        startContent={
          !areKeywordsOverflowing
            ? keywords.map((keyword) => (
                <KeywordChip
                  key={keyword}
                  value={keyword}
                  onRemove={handleRemoveKeyword}
                />
              ))
            : null
        }
        endContent={
          endContent ??
          (onRemoveCriterion ? (
            <button
              type="button"
              className={styles.removeCriterionButton}
              onClick={(event) => {
                event.stopPropagation();
                onRemoveCriterion();
              }}
              aria-label="Удалить критерий ключевых слов"
            >
              <Icon name="close" size={18} />
            </button>
          ) : null)
        }
      />

      <div className={styles.measureRow} ref={measureRef} aria-hidden="true">
        {keywords.map((keyword) => (
          <KeywordChip
            key={keyword}
            value={keyword}
            onRemove={handleRemoveKeyword}
          />
        ))}
      </div>

      {areKeywordsOverflowing && keywords.length ? (
        <div className={styles.chipsRow}>
          {keywords.map((keyword) => (
            <KeywordChip
              key={keyword}
              value={keyword}
              onRemove={handleRemoveKeyword}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
