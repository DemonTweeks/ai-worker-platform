# Create PR CD RAN - Pending items

- Review public error sanitization: `src/main.py` stage failures include last 1,000 stderr characters as `stderrTail`, generic failures use `str(exc)`. Add disclosure regression tests before asserting logs remain private; no demonstrated secret leakage is claimed here.
- Preserve catalogue/dropdown parity and skill-owned config across upgrades. Verify variable output/archive behavior against intended production samples.
- Confirm upstream permission/promotion state afresh when releasing; historical HTTP403/upstream-PR notes are not current verification. Do not replace the contract pin with older main solely for branch naming.
