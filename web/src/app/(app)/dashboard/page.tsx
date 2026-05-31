// The dashboard is replaced by the living Home surface (redesign step 6).
// Kept as a redirect so old links / bookmarks still land somewhere real.
import { redirect } from 'next/navigation';

export default function DashboardRedirect() {
  redirect('/home');
}
