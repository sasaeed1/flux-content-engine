// Themes are consolidated into the Brand Studio's "Looks" tab (redesign
// step 11). Redirect to kill the duplicate entry point.
import { redirect } from 'next/navigation';

export default function ThemesRedirect() {
  redirect('/brand?tab=looks');
}
