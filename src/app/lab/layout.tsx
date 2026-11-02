import type { Metadata } from 'next';

/** Test pages for the people running the evidence runs. Not linked from anywhere and not for search engines. */
export const metadata: Metadata = {
  title: 'Stay lab',
  robots: { index: false, follow: false },
};

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-2xl px-4 py-8">{children}</main>;
}
