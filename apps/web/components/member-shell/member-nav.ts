import { CalendarDays, House, UsersRound, type LucideIcon } from 'lucide-react';

export interface MemberNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  mobile: boolean;
}

export const MEMBER_NAV_ITEMS: readonly MemberNavItem[] = [
  { href: '/me', label: 'Today', icon: House, exact: true, mobile: true },
  { href: '/me/calendar', label: 'Calendar', icon: CalendarDays, mobile: true },
  { href: '/me/cohort', label: 'Cohort', icon: UsersRound, mobile: true },
];

export function isMemberNavActive(pathname: string, item: MemberNavItem): boolean {
  return item.exact === true
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
