import { Pagination, type PaginationProps } from '@/shared/ui/Pagination';

type EditionsPaginationProps = Omit<
  PaginationProps,
  'itemLabel' | 'pageSizeSelectId'
>;

export function EditionsPagination(props: EditionsPaginationProps) {
  return (
    <Pagination
      {...props}
      itemLabel="Публикаций"
      pageSizeSelectId="editions-page-size-select"
    />
  );
}
