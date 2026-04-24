import { redirect } from 'next/navigation';

export default function SettingsIndexPage() {
  redirect('/me/settings/profile');
}
