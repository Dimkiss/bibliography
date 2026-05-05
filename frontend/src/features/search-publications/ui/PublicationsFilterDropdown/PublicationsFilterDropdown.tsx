import {
  FilterDropdown,
  type FilterDropdownOption,
  type FilterDropdownProps,
} from '@/shared/ui/FilterDropdown';

export type PublicationsFilterOption = FilterDropdownOption;
export type PublicationsFilterDropdownProps = FilterDropdownProps;

export function PublicationsFilterDropdown(
  props: PublicationsFilterDropdownProps,
) {
  return <FilterDropdown {...props} />;
}
