# Release decisions and remaining limits

- Source ownership/licensing and redistribution permission are not established by the supplied archive; no new licence was invented.
- Broken template formulas are detected and rejected, not fixed. Supplied real template contains #REF! formulas, so a release requires approved corrected configuration or a separately approved policy. Never silently repair to make the sample succeed.
- Python 3.14.6/openpyxl 3.1.5 tested; lower interpreter versions need validation. Manifest minimum 3.11 is a compatibility target, not a test claim.
- Existing lockfile npm dependencies reported backend 8 vulnerabilities (3 moderate/4 high/1 critical), frontend 20 (4 low/6 moderate/8 high/2 critical); no unrelated dependency upgrades attempted. Separate security review needed.
- Final severe disk/permissions failures/hard kills can prevent result writing; generic runner must fail closed.
- Offline integration uses in-memory Firebase and an ephemeral loopback server; production connectivity, authentication and deployment are not acceptance-tested here. Running cancellation remains unsupported.
- Private skill main was published at `50a85ee` before platform merge/deployment; any future upgrade must likewise publish its recorded commit first.
- Original baseline reconciliation, merge and restart completed at platform `6186a05`. Preexisting untracked production files were preserved. New dev01 realignment is not deployed.
