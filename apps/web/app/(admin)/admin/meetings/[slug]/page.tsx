import { notFound } from 'next/navigation';
import { LessonView } from '../../../../../components/admin/meetings/lesson-view';
import { getLesson } from '../../../../../components/admin/meetings/meetings-index';

export default async function AdminMeetingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = getLesson(slug);
  if (!lesson) notFound();
  return <LessonView lesson={lesson} />;
}
