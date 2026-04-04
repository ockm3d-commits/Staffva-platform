import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-t border-border-light bg-card">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-block">
              <Image src="/logo.svg" alt="StaffVA" width={90} height={32} />
            </Link>
            <p className="mt-3 text-xs text-text-tertiary leading-relaxed max-w-[200px]">
              Vetted talent marketplace. Free to browse. Pay when you hire.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-text tracking-wide uppercase">For Clients</h4>
            <ul className="mt-3 space-y-2">
              <li><Link href="/browse" className="text-sm text-text-muted hover:text-text transition-colors">Browse Talent</Link></li>
              <li><Link href="/post-role" className="text-sm text-text-muted hover:text-text transition-colors">Post a Role</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-text tracking-wide uppercase">For Professionals</h4>
            <ul className="mt-3 space-y-2">
              <li><Link href="/apply" className="text-sm text-text-muted hover:text-text transition-colors">Apply</Link></li>
              <li><Link href="/login" className="text-sm text-text-muted hover:text-text transition-colors">Sign In</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-text tracking-wide uppercase">Company</h4>
            <ul className="mt-3 space-y-2">
              <li><a href="mailto:support@staffva.com" className="text-sm text-text-muted hover:text-text transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border-light">
          <p className="text-xs text-text-tertiary text-center">
            &copy; {new Date().getFullYear()} StaffVA. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
