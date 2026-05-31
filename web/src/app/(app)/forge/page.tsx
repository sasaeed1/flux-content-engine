// Temporary stub — the immersive Forge chamber is built in redesign step 8.
// Until then, /forge points at the existing Studio so the new nav works.
import { redirect } from 'next/navigation';

export default function ForgeStub() {
  redirect('/studio');
}
