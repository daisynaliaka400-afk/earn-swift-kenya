import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/PublicLayout";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [
    { title: "About SmartEarn" }, { name: "description", content: "What SmartEarn is and how the platform works." },
    { property: "og:title", content: "About SmartEarn" }, { property: "og:description", content: "An online task platform for Kenya." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <LegalPage title="About SmartEarn">
      <p>SmartEarn is an online task platform that connects people in Kenya with simple digital tasks — surveys, videos, app tests, social engagement and more — offered by partners who need them done.</p>
      <h2>How we operate</h2>
      <p>Every task shows its reward up front. Simple tasks are credited instantly; tasks that require proof are reviewed by our team. Earnings are withdrawn to your registered M-Pesa number once you meet the withdrawal requirements.</p>
      <h2>Our commitment</h2>
      <p>We publish our rules openly, enforce one account per person, and never ask you to send money to a personal number.</p>
    </LegalPage>
  ),
});
