import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/PublicLayout";

export const Route = createFileRoute("/refund")({
  head: () => ({ meta: [
    { title: "Refund & Payout Policy — SmartEarn" }, { name: "description", content: "SmartEarn refund, activation and withdrawal rules." },
    { property: "og:title", content: "Refund & Payout Policy — SmartEarn" }, { property: "og:description", content: "Activation refunds and payout timelines." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <LegalPage title="Refund & Payout Policy" updated="September 2026">
      <h2>Activation payments</h2><p>If you were charged but your account was not activated, contact support with your M-Pesa code and we will activate or refund you. Activation fees are otherwise non-refundable once your account is active.</p>
      <h2>Duplicate or wrong payments</h2><p>Duplicate charges and payments of the wrong amount are refunded to the paying number after verification.</p>
      <h2>Payouts</h2><p>Withdrawals are processed within 24–72 hours to your registered M-Pesa number. A 5% fee (minimum KSh 30) is deducted. Rejected withdrawals are returned to your balance with a reason.</p>
    </LegalPage>
  ),
});
