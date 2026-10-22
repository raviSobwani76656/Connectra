export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="mb-6 text-sm font-semibold tracking-wide text-zinc-500">CONNECTRA</p>
        {children}
      </div>
    </main>
  );
}
