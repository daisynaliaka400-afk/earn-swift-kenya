import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/PublicLayout";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [
    { title: "Terms of Service — SmartEarn" }, { name: "description", content: "The terms that govern your use of SmartEarn." },
    { property: "og:title", content: "Terms of Service — SmartEarn" }, { property: "og:description", content: "SmartEarn terms of service." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <LegalPage title="Terms of Service" updated="September 2026">
      <h2>1. Eligibility</h2><p>You must be 18 or older and hold a Kenyan mobile number registered in your name. One account per person, phone number and device.</p>
      <h2>2. Activation</h2><p>Full access requires a one-time activation fee (Starter KSh 200, Standard KSh 350, Pro KSh 550) paid via official M-Pesa channels shown in your dashboard.</p>
      <h2>3. Tasks & rewards</h2><p>Rewards are shown before each task. Proof-based tasks may be rejected if instructions are not followed. Rewards obtained by fraud will be reversed.</p>
      <h2>4. Withdrawals</h2><p>Withdrawals require a balance of at least KSh 650, three active referrals and an active account. A 5% fee (minimum KSh 30) applies. New earnings may be held for up to 7 days for fraud review.</p>
      <h2>5. Suspension</h2><p>Accounts involved in duplicate registrations, automation or abuse may be suspended and balances forfeited.</p>
      <h2>6. Changes</h2><p>We may update these terms and will notify users of material changes.</p>
    </LegalPage>
  ),
});
