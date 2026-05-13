import type {
  EditionListItemDto,
  EditionMetricHistoryItemDto,
} from '@/entities/edition';
import { formatWhiteListLevel } from '@/entities/edition';
import { QuartilesDropdown } from '@/shared/ui/QuartilesDropdown';
import type { QuartilesDropdownItem } from '@/shared/ui/QuartilesDropdown';
import { stopInteractiveEvent } from './editionResultsList.lib';

type EditionMetricHistoryBadgeProps = {
  value?: string | null;
  history?: EditionMetricHistoryItemDto[];
  ariaLabel: string;
  formatValue?: (value?: string | null) => string;
};

function buildMetricHistoryItems(
  history: EditionMetricHistoryItemDto[] | undefined,
  fallbackValue?: string | null,
  formatValue?: (value?: string | null) => string,
): QuartilesDropdownItem[] {
  const items = (history ?? [])
    .filter((item) => Number.isFinite(item.year))
    .map((item) => ({
      label: String(item.year),
      value: formatValue ? formatValue(item.value) : item.value,
    }));

  if (items.length) {
    return items;
  }

  return [
    {
      label: '—',
      value: formatValue ? formatValue(fallbackValue) : fallbackValue,
    },
  ];
}

export function EditionMetricHistoryBadge({
  value,
  history,
  ariaLabel,
  formatValue,
}: EditionMetricHistoryBadgeProps) {
  const displayValue = formatValue ? formatValue(value) : value;
  const items = buildMetricHistoryItems(history, value, formatValue);

  return (
    <div onClick={stopInteractiveEvent}>
      <QuartilesDropdown
        value={displayValue}
        items={items}
        menuAlign="right"
        variant="compact"
        ariaLabel={ariaLabel}
      />
    </div>
  );
}

export function EditionWosQuartileBadge({ item }: { item: EditionListItemDto }) {
  return (
    <EditionMetricHistoryBadge
      value={item.wos_quartile}
      history={item.wos_quartiles}
      ariaLabel="Показать квартили WoS по годам"
    />
  );
}

export function EditionScopusQuartileBadge({ item }: { item: EditionListItemDto }) {
  return (
    <EditionMetricHistoryBadge
      value={item.scopus_quartile}
      history={item.scopus_quartiles}
      ariaLabel="Показать квартили Scopus по годам"
    />
  );
}

export function EditionWhiteListLevelBadge({ item }: { item: EditionListItemDto }) {
  return (
    <EditionMetricHistoryBadge
      value={item.white_list_level}
      history={item.white_list_levels}
      ariaLabel="Показать уровни белого списка по годам"
      formatValue={formatWhiteListLevel}
    />
  );
}
