'use client';
import { use } from 'react';
import { BtgPlanEditor } from '../../../../../../btg/admin/plan-editor';

export default function Page({ params }: { params: Promise<{ id: string; planId: string }> }) {
  const { id, planId } = use(params);
  return <BtgPlanEditor memberId={id} planId={planId} />;
}
