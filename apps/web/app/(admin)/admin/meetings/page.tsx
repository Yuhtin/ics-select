import { MeetingsList } from '../../../../components/admin/meetings/meetings-list';
import { listMeetings } from '../../../../components/admin/meetings/meetings-index';

export default function AdminMeetingsPage() {
  const meetings = listMeetings();
  return <MeetingsList meetings={meetings} />;
}
