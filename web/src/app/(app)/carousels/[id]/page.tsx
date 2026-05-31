// Carousel detail is re-parented under the Library for breadcrumbed context
// (redesign step 10). Redirect old links to the new canonical location.
import { redirect } from 'next/navigation';

export default async function CarouselRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/library/${id}`);
}
