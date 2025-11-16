import { MembershipLifecycleStatus } from '@/constants/companyMemberships';

export type MembershipSortOption = 'updated' | 'company' | 'user' | 'status';
export type StatusFilterValue = MembershipLifecycleStatus | 'all';

export interface MembershipFilterState {
  searchQuery: string;
  selectedSort: MembershipSortOption;
  sortDirection: 'asc' | 'desc';
  statusFilter: StatusFilterValue;
}
