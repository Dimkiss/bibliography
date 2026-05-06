import styles from './Quartile.module.css';

export type QuartileProps = {
  value?: string | number | null;
  className?: string;
  ariaLabel?: string;
};

function normalizeQuartileValue(value: QuartileProps['value']): string {
  if (value === null || value === undefined) {
    return '\u2013';
  }

  const textValue = String(value).trim();

  if (!textValue || textValue === '-') {
    return '\u2013';
  }

  if (/^[1-4]$/.test(textValue)) {
    return `Q${textValue}`;
  }

  if (/^q[1-4]$/i.test(textValue)) {
    return textValue.toUpperCase();
  }

  return textValue;
}

export default function Quartile({
  value,
  className = '',
  ariaLabel,
}: QuartileProps) {
  const label = normalizeQuartileValue(value);

  return (
    <span
      className={[styles.root, className].filter(Boolean).join(' ')}
      aria-label={ariaLabel}
    >
      {label}
    </span>
  );
}
