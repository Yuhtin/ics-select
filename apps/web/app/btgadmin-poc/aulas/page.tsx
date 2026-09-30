import { listMeetings } from '../../../components/admin/meetings/meetings-index';
import { BtgMeetings } from '../../../btg/admin/meetings';

export default function Page() {
  return <BtgMeetings meetings={listMeetings()} />;
}
