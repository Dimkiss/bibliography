import type { PublicationListItemDto } from '@/entities/publication';
import { QuartilesDropdown } from '@/shared/ui/QuartilesDropdown';
import {
  buildQuartileItems,
  stopInteractiveEvent,
} from './publicationResultsList.lib';

type PublicationQuartileBadgeProps = {
  item: PublicationListItemDto;
};

export function PublicationQuartileBadge({
  item,
}: PublicationQuartileBadgeProps) {
  const items = buildQuartileItems(item);
  const value = items.find((quartileItem) => quartileItem.value)?.value ?? null;

  return (
    <div onClick={stopInteractiveEvent}>
      <QuartilesDropdown
        value={value}
        items={items}
        menuAlign="right"
        ariaLabel="Показать квартили публикации"
      />
    </div>
  );
}
