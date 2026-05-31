// Temporary stub — the real living Home surface is built in redesign step 6.
// Until then, /home points at the existing dashboard so the new nav works.
import { redirect } from 'next/navigation';

export default function HomeStub() {
  redirect('/dashboard');
}
