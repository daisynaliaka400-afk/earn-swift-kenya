import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/PublicLayout";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [
    { title: "Privacy Policy — SmartEarn" }, { name: "description", content: "How SmartEarn collects and protects your data." },
    { property: "og:title", content: "Privacy Policy — SmartEarn" }, { property: "og:description", content: "SmartEarn privacy policy." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <LegalPage title="Privacy Policy" updated="September 2026">
      <h2>What we collect</h2><p>Your name, phone number, optional email, task activity, payment references and basic device/network information used to prevent fraud.</p>
      <h2>How we use it</h2><p>To run your account, credit rewards, process payments and withdrawals, send account SMS, and detect abuse.</p>
      <h2>SMS</h2><p>We send transactional and reminder SMS. Reply STOP to opt out of non-essential messages at any time.</p>
      <h2>Sharing</h2><p>We share data only with payment and SMS providers needed to deliver the service, or when required by Kenyan law.</p>
      <h2>Your rights</h2><p>You may request access to or deletion of your data through the Help page, in line with the Kenya Data Protection Act, 2019.</p>
    </LegalPage>
  ),
});
