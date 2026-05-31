// Temporary stub — the Signals performance-intelligence surface is built in
// redesign step 12. Until then it points at the dashboard.
import { redirect } from 'next/navigation';

export default function SignalsStub() {
  redirect('/dashboard');
}
