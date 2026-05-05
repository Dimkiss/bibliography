import { Pagination, type PaginationProps } from '@/shared/ui/Pagination';

type PublicationsPaginationProps = Omit<
  PaginationProps,
  'itemLabel' | 'pageSizeSelectId'
>;

export function PublicationsPagination(props: PublicationsPaginationProps) {
  return (
    <Pagination
      {...props}
      itemLabel="Публикаций"
      pageSizeSelectId="publications-page-size-select"
    />
  );
}
