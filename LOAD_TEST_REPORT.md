# StaffVA Infrastructure Load Test Report

**Date:** 4/1/2026, 10:41:49 PM
**Overall Status:** ⚠ SOME TESTS NEED ATTENTION

---

## ✅ Database Connection Pool

| Concurrency | Avg | P50 | P95 | P99 | Max | Failures | Over 500ms |
|-------------|-----|-----|-----|-----|-----|----------|------------|
| 100 | 1656ms | 1517ms | 1910ms | 1915ms | 1915ms | 0 | 100 |
| 250 | 365ms | 352ms | 626ms | 640ms | 648ms | 0 | 60 |
| 500 | 1279ms | 1412ms | 1615ms | 1625ms | 1656ms | 0 | 455 |

**Flags:**
- ⚠ P95 response time exceeded 500ms at one or more concurrency levels

**Remediation:** Consider upgrading Supabase plan for higher connection pool limits. Current free tier allows ~60 direct connections. Use connection pooling (PgBouncer) for production.

---

## ✅ Storage Upload Concurrency

- **Total uploads:** 200
- **Successes:** 200
- **Failures:** 0 (0.00%)
- **Avg upload time:** 2564ms
- **Total time:** 17161ms

---

## ❌ Queue Submission Load

- **Total submissions:** 1000
- **Successes:** 1000
- **Failures:** 0
- **Avg response:** 304ms
- **P95 response:** 2104ms
- **Max response:** 2133ms
- **Over 2s:** 77
- **Records verified in DB:** 1000

**Flags:**
- ⚠ 77 submissions exceeded 2-second threshold

**Remediation:** Queue endpoint may need connection pooling or batch insert optimization. Consider Supabase Pro plan for higher throughput.

---

## Recommendations

Some tests require attention before launch. See remediation steps above.