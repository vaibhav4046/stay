import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <h1 className="section-title">Page not found</h1>
      <p className="text-ink-2 mt-2">The page you were looking for doesn&apos;t exist.</p>
      <Link href="/" className="btn btn-primary mt-6">
        Return home
      </Link>
    </div>
  );
}
