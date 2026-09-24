# SmartEarn roadmap

## Phase 1 — done
- [x] Blue/purple design system, new homepage with live tasks from database
- [x] Phone + password sign up / login, role-based routing (customer → /dashboard, admin → /admin)
- [x] Customer dashboard: balance, tasks, activity; atomic task completion
- [x] Admin: overview stats, task management, user status
- [x] About, Terms, Privacy, Refund, Help pages

## Phase 2 — payments (done, needs a small real test)
- [x] stk_transactions + payments tables, initiate STK push, callback, status polling
- [x] /dashboard/activate page + manual Till 5441898 fallback
- [x] Referral commissions (80/150/250), admin STK transactions page + CSV

## Phase 3 — SMS
- [x] sms_logs, send helper (normalize, STOP footer, dedupe, retry)
- [~] Event SMS (done: signup, referral signup, STK sent/success/fail, commission; todo: tasks, milestones, streaks)
- [ ] Event SMS remaining (, tasks, milestones, referrals, streaks)
- [ ] Scheduled SMS via cron (8AM, 1PM, 7PM, 10PM, Sunday, Monday), real numbers only
- [x] Admin SMS test + provider logs

## Phase 4
- [ ] Withdrawals (650 min, 3 active refs, 5% fee min 30, 7-day hold), admin payouts
- [ ] Proof task review, streak/login bonuses, anti-fraud (IP/device), admin audit log
- [ ] Referrals page, profile page, leaderboard

## Open items
- First admin account must be granted the admin role (needs admin's phone number)
- Support contact details for Help page
- Confirm SmartPay callback URL registered in SmartPay dashboard: https://project--7135d1a6-507a-47ce-b4c8-2f404af01cf0.lovable.app/api/public/mpesa-callback
