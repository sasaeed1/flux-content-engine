// The Studio is superseded by the Forge (redesign step 8/9). Redirect so old
// links land in the new generation chamber.
import { redirect } from 'next/navigation';

export default function StudioRedirect() {
  redirect('/forge');
}
