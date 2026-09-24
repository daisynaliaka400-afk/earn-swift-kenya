import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/PublicLayout";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [
    { title: "Help & Contact — SmartEarn" }, { name: "description", content: "Get help with your SmartEarn account." },
    { property: "og:title", content: "Help & Contact — SmartEarn" }, { property: "og:description", content: "Contact SmartEarn support." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <LegalPage title="Help & Contact">
      <p>Our support team helps with account, task, payment and withdrawal questions.</p>
      <h2>Before contacting us</h2><p>Have your registered phone number and, for payment issues, your M-Pesa confirmation code ready.</p>
      <h2>Reach us</h2><p>Support contact details will be listed here soon.</p>
    </LegalPage>
  ),
});
