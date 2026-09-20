import Laddar from '@/components/Laddar';

/**
 * Visas medan sidan hämtas. Se src/components/Laddar.tsx för varför den
 * finns, och varför varje sida har en egen i stället för en gemensam i
 * roten: en laddningsvy i roten visas bara när roten själv monteras, alltså
 * aldrig när man byter mellan två sidor inne i appen.
 */
export default function Loading() {
  return <Laddar />;
}
