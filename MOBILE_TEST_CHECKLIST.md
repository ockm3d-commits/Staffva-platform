# StaffVA Mobile Test Checklist — Pre-Seminar Sign-Off

**Date:** 2026-03-30
**Tester:** _______________
**Build:** Latest Vercel deployment

## Test Devices

| Device | OS | Browser | Viewport |
|--------|-----|---------|----------|
| iPhone 14 | iOS 17+ | Safari | 390x844 |
| iPhone SE | iOS 17+ | Safari | 375x667 |
| Samsung Galaxy S21 | Android 13+ | Chrome | 360x800 |
| Generic | N/A | Chrome DevTools | 375x812 |

---

## 1. Landing Page (/)

| Test Item | iPhone 14 | iPhone SE | Galaxy S21 | 375px | Notes |
|-----------|-----------|-----------|------------|-------|-------|
| Hero section renders without horizontal scroll | | | | | |
| Headline text readable, no overflow | | | | | |
| Search bar fully visible and functional | | | | | |
| Role pills wrap properly on mobile | | | | | |
| Trust badges readable | | | | | |
| "Who's available" cards stack to single column | | | | | |
| Candidate preview cards show photo/initial | | | | | |
| "How it works" 3 steps stack vertically | | | | | |
| "Why StaffVA" cards stack vertically | | | | | |
| "For candidates" section readable | | | | | |
| Final CTA search bar functional | | | | | |
| Footer links accessible | | | | | |
| Quick Match button visible and tappable | | | | | |
| Quick Match modal opens and closes | | | | | |
| Common searches grid readable (2-col) | | | | | |
| Browse by role icons tappable (44px+ target) | | | | | |

---

## 2. Navigation

| Test Item | iPhone 14 | iPhone SE | Galaxy S21 | 375px | Notes |
|-----------|-----------|-----------|------------|-------|-------|
| Hamburger icon visible on mobile | | | | | |
| Hamburger tap target 44px+ | | | | | |
| Mobile menu opens on tap | | | | | |
| All accordion sections expand | | | | | |
| All mobile links tappable (44px+ height) | | | | | |
| Menu closes on outside tap | | | | | |
| Menu closes on link tap | | | | | |
| Sign In / Get Started visible | | | | | |
| Logged-in state shows correct nav items | | | | | |
| Navbar sticky on scroll | | | | | |

---

## 3. Browse Page (/browse)

| Test Item | iPhone 14 | iPhone SE | Galaxy S21 | 375px | Notes |
|-----------|-----------|-----------|------------|-------|-------|
| Search bar fully visible | | | | | |
| Search button tappable | | | | | |
| Role pills wrap properly | | | | | |
| Filter button visible and tappable (44px+) | | | | | |
| Filter panel opens on mobile | | | | | |
| Filter dropdowns functional | | | | | |
| Filter panel closes correctly | | | | | |
| Candidate cards single column layout | | | | | |
| Candidate card photo visible | | | | | |
| Candidate card badges readable | | | | | |
| Candidate card rate visible | | | | | |
| Inline audio player visible (logged in) | | | | | |
| Audio play button tappable (44px+) | | | | | |
| Audio plays inline without navigating | | | | | |
| Lock icon shows for non-logged-in | | | | | |
| "View Profile" link tappable | | | | | |
| Pagination buttons tappable | | | | | |
| Sort dropdown functional | | | | | |
| "Availability unconfirmed" badge readable | | | | | |

---

## 4. Candidate Profile (/candidate/[id])

| Test Item | iPhone 14 | iPhone SE | Galaxy S21 | 375px | Notes |
|-----------|-----------|-----------|------------|-------|-------|
| Profile header renders without overflow | | | | | |
| Photo displays correctly | | | | | |
| Name and country readable | | | | | |
| Rate displayed prominently | | | | | |
| English tier badge readable | | | | | |
| Speaking level badge readable | | | | | |
| Availability status with colored dot | | | | | |
| Audio players functional (logged in) | | | | | |
| Audio lock icons show (not logged in) | | | | | |
| Bio section readable | | | | | |
| Tools pills wrap properly | | | | | |
| Work experience timeline readable | | | | | |
| Verified earnings visible | | | | | |
| Interview request cards stack vertically | | | | | |
| Service packages display correctly | | | | | |
| Message button fully tappable | | | | | |

---

## 5. Client Hire Flow (/hire/[candidateId])

| Test Item | iPhone 14 | iPhone SE | Galaxy S21 | 375px | Notes |
|-----------|-----------|-----------|------------|-------|-------|
| Page loads without overflow | | | | | |
| Contract type cards stack on mobile | | | | | |
| Contract type cards tappable | | | | | |
| Payment cycle dropdown functional | | | | | |
| Hours per week input accessible | | | | | |
| Rate display readable | | | | | |
| Milestone inputs stack vertically on mobile | | | | | |
| All form inputs have 44px+ touch targets | | | | | |
| Submit button fully visible | | | | | |
| Price breakdown readable | | | | | |
| Flow completes end to end | | | | | |

---

## 6. Client Team Portal (/team)

| Test Item | iPhone 14 | iPhone SE | Galaxy S21 | 375px | Notes |
|-----------|-----------|-----------|------------|-------|-------|
| Page header stacks on mobile | | | | | |
| Browse Talent button tappable (44px+) | | | | | |
| Escrow status panel displays correctly | | | | | |
| Escrow total amount readable | | | | | |
| Escrow items stack properly | | | | | |
| Auto-release countdown visible | | | | | |
| Engagement cards readable | | | | | |
| Action buttons tappable | | | | | |
| Payment period info readable | | | | | |
| Milestone status badges readable | | | | | |

---

## 7. Escrow Status Panel

| Test Item | iPhone 14 | iPhone SE | Galaxy S21 | 375px | Notes |
|-----------|-----------|-----------|------------|-------|-------|
| Panel padding comfortable (not cramped) | | | | | |
| Total in escrow readable | | | | | |
| Individual items don't overflow | | | | | |
| Type icons and labels readable | | | | | |
| Auto-release time badge visible | | | | | |
| Status messages wrap properly | | | | | |
| "Refreshes every 60 seconds" note visible | | | | | |

---

## Sign-Off

| Role | Name | Status | Date |
|------|------|--------|------|
| Developer | | PASS / FAIL | |
| Product Owner | | PASS / FAIL | |
| QA | | PASS / FAIL | |

**Nothing ships until every item passes.**

---

## Fixes Applied (2026-03-30)

- Hamburger button: increased to 44px min touch target
- Mobile menu links: increased tap height from 6px to 10px padding
- Common searches grid: gap reduced from 32px to 12px on mobile
- Browse filter button: increased to 44px min height
- Audio play button: increased to 40px on mobile (28px desktop)
- Audio progress bar: increased height on mobile
- Hire page milestone grid: stacks to single column on mobile
- Escrow panel: responsive padding (16px mobile, 24px desktop)
- Escrow header: stacks vertically on mobile
- Team portal header: stacks vertically on mobile with 44px button
