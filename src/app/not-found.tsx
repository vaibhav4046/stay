import Link from 'next/link';
import { StayWordmark } from '@/components/StayMark';

export default function NotFound() {
  return (
    <div className="flex min-h-[85vh] flex-col items-center justify-center p-6 text-center">
      <div className="card max-w-md w-full p-6 sm:p-8 space-y-4 border border-line bg-surface shadow-sm">
        <div className="flex justify-center pb-2">
          <StayWordmark />
        </div>
        <p className="eyebrow !mb-0">404 · Nothing here</p>
        <h1 className="section-title text-xl sm:text-2xl font-semibold">
          Lost your way?
        </h1>
        <p className="text-sm text-ink-2 leading-relaxed">
          The page or step you were looking for doesn&apos;t exist. Let&apos;s get you back to your workspace.
        </p>
        <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
          <Link href="/app/today" className="btn btn-primary flex-1">
            Open Stay
          </Link>
          <Link href="/" className="btn btn-secondary flex-1">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
