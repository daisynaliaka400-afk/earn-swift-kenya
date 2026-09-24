import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="bg-navy-gradient text-navy-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo light />
          <p className="mt-3 max-w-sm text-sm opacity-70">Earn Smart. Withdraw Fast. An online task platform for Kenya.</p>
        </div>
        <div>
          <p className="text-sm font-semibold">Company</p>
          <ul className="mt-3 space-y-2 text-sm opacity-75">
            <li><Link to="/about">About</Link></li>
            <li><Link to="/contact">Help & Contact</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Legal</p>
          <ul className="mt-3 space-y-2 text-sm opacity-75">
            <li><Link to="/terms">Terms of Service</Link></li>
            <li><Link to="/privacy">Privacy Policy</Link></li>
            <li><Link to="/refund">Refund & Payout Policy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-navy-foreground/10 py-5 text-center text-xs opacity-60">
        © {new Date().getFullYear()} SmartEarn. All rights reserved.
      </div>
    </footer>
  );
}
