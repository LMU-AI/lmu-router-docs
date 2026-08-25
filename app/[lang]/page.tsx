import { permanentRedirect } from 'next/navigation';
import { i18n, localePrefix } from '@/lib/i18n';

export function generateStaticParams() {
  return i18n.languages.map((lang) => ({ lang }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  permanentRedirect(`${localePrefix(lang)}/docs`);
}
