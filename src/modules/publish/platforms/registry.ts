/** Platform registry — the single place that knows every publisher. */
import type { PlatformDescriptor, SocialPlatform, SocialPublisher } from './types';
import { SOCIAL_PLATFORMS } from './types';
import { instagramPublisher } from './instagram';
import { linkedinPublisher } from './linkedin';
import { tiktokPublisher } from './tiktok';

const PUBLISHERS: Record<SocialPlatform, SocialPublisher> = {
  instagram: instagramPublisher,
  linkedin: linkedinPublisher,
  tiktok: tiktokPublisher,
};

export function getPublisher(platform: SocialPlatform): SocialPublisher {
  const p = PUBLISHERS[platform];
  if (!p) throw new Error(`Unknown platform: ${platform}`);
  return p;
}

export function listDescriptors(): PlatformDescriptor[] {
  return SOCIAL_PLATFORMS.map((p) => PUBLISHERS[p].descriptor());
}

export function isPlatform(s: string): s is SocialPlatform {
  return (SOCIAL_PLATFORMS as string[]).includes(s);
}
