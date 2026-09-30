'use client';
import { use } from 'react';
import { BtgMemberCockpit } from '../../../../btg/admin/member-cockpit';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <BtgMemberCockpit memberId={id} />;
}
