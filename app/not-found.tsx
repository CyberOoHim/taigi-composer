import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-950 text-white text-center">
      <h2 className="text-2xl font-bold mb-2">404 - Page Not Found</h2>
      <p className="text-zinc-400 text-sm mb-6">The requested page could not be found.</p>
      <Link
        href="/"
        className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 transition-colors"
      >
        返回首頁 (Return Home)
      </Link>
    </div>
  );
}
