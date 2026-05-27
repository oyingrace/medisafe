import Link from "next/link";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-8 px-6">
        <Link href="/" className="font-semibold tracking-tight text-green-700">
          MedSafe
        </Link>
        <nav className="flex flex-1 gap-6 text-sm font-medium">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            Overview
          </Link>
          <Link href="/register" className="text-muted-foreground hover:text-foreground">
            Register
          </Link>
          <Link href="/batches" className="text-muted-foreground hover:text-foreground">
            Batches
          </Link>
        </nav>
      </div>
    </header>
  );
}
