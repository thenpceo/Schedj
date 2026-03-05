# SCHEDJ Roadmap & Strategy Plan

**Created**: March 5, 2026
**Based on**: Team call with Levi Sterner (Inspector, CCOF/PCO)

---

## Vision

Build a cookie-cutter scheduling tool compatible with the Intact API that automates organic inspection scheduling for certifying agencies. Sell as a monthly SaaS subscription to every agency.

---

## Current State

- Working prototype that pairs inspections efficiently by location
- Custom email copy generation per inspection (validated as accurate by Levi)
- Algorithm handles farm assignment, trip grouping, and cost optimization
- Using real data from Levi's 57-farm assignment list
- Levi is the first test inspector (CCOF and PCO — top 2 certifying agencies)

---

## Phase 1: Inspector Validation (NOW)

**Goal**: Prove the tool saves 75%+ of inspector scheduling time with 1-2 inspectors.

### Tasks
- [ ] Have Levi use the current prototype on his new schedule
- [ ] Collect screen recording feedback from Levi on what needs improving
- [ ] Iterate based on feedback (fix/improve, re-test cycle)
- [ ] Improve algorithm prioritization — push urgent assignments as deadlines approach
- [ ] Add full inspection tracking (scheduled, completed, contacted status)
- [ ] Improve data export — organized, digestible format (Excel-like view)
- [ ] Build basic dashboard/CRM view so inspectors don't need to export data
- [ ] Add status filters (contacted, scheduled, completed, etc.)

### Success Criteria
- Levi confirms 75-80% reduction in scheduling time
- Screen recordings document the time savings

---

## Phase 2: Email Automation

**Goal**: Automate the biggest time sink — manual correspondence with farms.

**Priority**: HIGH return, MEDIUM effort — build immediately after Phase 1 validation.

### Tasks
- [ ] Auto-send emails to all farms on the schedule
- [ ] Track email delivery and responses (ping when replies come in)
- [ ] Dashboard view for tracking communication status per farm
- [ ] Include "What to Prepare" details and inspection info in emails
- [ ] Support for scheduling confirmations and rescheduling

### Notes
- ~50% of PA scheduling is phone-based — voice agent is future (high effort, medium return)
- Email automation addresses the other 50% and is the clear next priority

---

## Phase 3: Expand to More Inspectors

**Goal**: Validate with 1-2 additional inspectors beyond Levi.

### Tasks
- [ ] Onboard 1-2 more inspectors from CCOF or PCO
- [ ] Collect feedback and iterate
- [ ] Gather undeniable data from 10-20 inspectors showing 75%+ time reduction
- [ ] Document time savings as sales ammunition

### Success Criteria
- 10-20 inspectors with documented 75%+ time savings

---

## Phase 4: Supervisor Engagement

**Goal**: Demonstrate to supervisors and validate the admin workflow.

**Timing**: AFTER Phase 1-3 inspector validation is solid.

### Tasks
- [ ] Build administrator/supervisor dashboard view
- [ ] Simulate full workflow with mock data (multiplied from existing spreadsheet):
  - Initial farm-to-inspector assignment
  - Inspector invites
  - Tracking claims, urgency, bounties
- [ ] Reach out to supervisor, demo the tool
- [ ] Learn their Intact workflow in detail
- [ ] Confirm system can import status data from any point in the year
- [ ] Support for cross-referencing existing manual schedules

### Key Pain Points to Solve
- Supervisors spend 1+ week on initial annual scheduling
- Manual process of linking inspections to inspectors (certs, past assignments, location)
- No comprehensive tracking view across all inspectors

---

## Phase 5: Sales & Expansion

**Goal**: Close first paying customers and expand to more agencies.

### Sales Strategy
1. Build functional demo with mock data (simulating Intact connection)
2. Impress supervisor with demo → sell before fully building Intact API connection
3. Spend 3-6 months working closely with first supervisor to perfect the system
4. Secure CCOF and PCO first (top 2 agencies = instant credibility)
5. Use success to expand — getting 10 agencies leads to many more via industry recognition

### Pricing Model
- **Target**: $3,000 - $5,000/month subscription per agency
- **Justification** (example: 77-inspector agency):
  - 77 inspectors x 37.5 hrs/year scheduling x $50/hr = ~$144,000/year in inspector time alone
  - Supervisor time cost is additional (and significant)
  - 75% savings = $108,000/year saved
  - $4,000-$5,000/month ($48K-$60K/year) is easily justified
- Agencies are non-profits but have software budgets and are motivated by time/money savings

### Sales Path
- Supervisors (already excited) present to directors/CEO
- Focus on first few sales → 10 agencies → industry-wide adoption

---

## Feature Priority Matrix

| Feature | Return | Effort | Priority |
|---------|--------|--------|----------|
| Algorithm improvements (urgency, tracking) | High | Medium | NOW |
| Dashboard/CRM view with filters | High | Medium | NOW |
| Email automation | High | Medium | NEXT |
| Supervisor admin view | High | High | Phase 4 |
| Intact API integration | High | High | Phase 5 |
| User authentication system | Medium | Medium | Phase 4 |
| Voice agent for phone scheduling | Medium | High | FUTURE |
| Incentive/stipend integration | Low | Low | FUTURE |

---

## Key Business Facts

- **Target market**: Organic inspection certifying agencies (use Intact software)
- **First customers**: CCOF and PCO (Levi works for both)
- **Revenue model**: Monthly SaaS subscription
- **Purchasing authority**: Supervisors → Directors/CEO
- **Competitive advantage**: First-mover in automating Intact-based scheduling
- **Inspector compensation**: Paid for drive time + mileage (grouping saves money)
- **Bonus structure**: Stipends exist for expedited inspections (~$500 extra)

---

## Immediate Next Steps (This Week)

1. Levi tests current prototype on his new schedule
2. Levi sends screen recording feedback
3. Nicholas iterates based on feedback
4. Repeat until Levi confirms major time savings
