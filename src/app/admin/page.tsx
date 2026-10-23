import { admin } from '../../messages/fa';
import { requireStaff } from '../../modules/admin/server';

export default async function AdminHome() {
  await requireStaff('overview.view');
  return <h1 className="text-2xl font-extrabold">{admin.nav.overview}</h1>;
}
