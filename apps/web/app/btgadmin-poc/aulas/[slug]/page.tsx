import { notFound } from 'next/navigation';
import { getLesson } from '../../../../components/admin/meetings/meetings-index';
import { BtgLesson } from '../../../../btg/admin/lesson';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const lesson = getLesson((await params).slug);
  if (!lesson) notFound();
  return <BtgLesson lesson={lesson} />;
}
