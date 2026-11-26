# GEM tracked-secret scanner

A small, dependency-free Python tool that checks tracked Git files for runtime environment filenames, high-confidence Telegram bot credential patterns, public Telegram/bot secret variable names, selected GitHub token shapes, AWS access-key identifiers and private-key PEM headers. It reports locations and rule names, not matched values. Exit 0 means no supported findings; exit 1 means findings or unsafe files; exit 2 means the scan could not be started safely. Identifiers and headers are not proof of an active credential. This is a supplemental check, not a replacement for a comprehensive secret scanner.

## Usage

Requires Python 3.10+ and Git on POSIX systems supporting descriptor-relative opens and O_NOFOLLOW (such as Linux and macOS). Copy scan_tracked_secrets.py into your own checkout or run it by absolute path with your target repository root as the working directory.

```sh
python3 /path/to/scan_tracked_secrets.py
python3 -m unittest discover -s open-source/tracked-secret-scanner -p 'test_*.py'
```

The scanner is not a comprehensive secret scanner: it inspects tracked working-tree content, not commit history or untracked files, and only detects the documented patterns. Missing, unreadable, symbolic-link and non-regular tracked paths fail the scan; unsupported safe-open platforms also fail closed. Never test with real credentials. Rotate exposed credentials and remove them from affected history where appropriate.

### Install from source

From a checkout of GEM Enterprise, run:

```sh
python3 -m venv /tmp/gem-scanner-venv
/tmp/gem-scanner-venv/bin/python -m pip install --no-deps ./open-source/tracked-secret-scanner
cd /path/to/your/git/repository
/tmp/gem-scanner-venv/bin/gem-tracked-secret-scanner --version
/tmp/gem-scanner-venv/bin/gem-tracked-secret-scanner
```

No runtime Python dependencies. Building the package requires setuptools; direct script usage remains available without installing anything. Run from the root of a Git working tree. Package version 0.2.0 is the source distribution version, not a claim of publication to PyPI.

### CI integration

A composite action is available in this directory. In your own repository, check out the working tree with credentials persistence disabled, then call the action using the full reviewed commit SHA of GEM Enterprise (replace `REVIEWED_COMMIT_SHA` before use).

```yaml
name: GEM tracked secret check
on: [pull_request, push]
permissions:
  contents: read
jobs:
  scan:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
        with:
          persist-credentials: false
      - uses: gem-cybersecurity-monitoring-assist/gem-enterprise/open-source/tracked-secret-scanner@REVIEWED_COMMIT_SHA
```

Use a reviewed immutable commit, not a floating branch. Use isolated runners and do not expose credentials to untrusted pull requests. The action uses Python 3.10+ and Git already installed on the runner.

### Reproducible demonstration

Set `SCANNER` to an absolute path to the reviewed script. Use a disposable checkout and synthetic data only:

```sh
demo="$(mktemp -d)"
(
  cd "$demo" || exit 2
  git init -q
  printf 'EXAMPLE=placeholder\n' > clean.txt
  git add clean.txt
  python3 "$SCANNER" || exit 2
  printf 'EXAMPLE=placeholder\n' > .env.local
  git add -f .env.local
  python3 "$SCANNER"
  test "$?" -eq 1
)
status=$?
rm -rf -- "$demo"
test "$status" -eq 0
```

Expected behavior: the clean checkout returns 0; the tracked environment filename returns 1 and a rule name, without printing its contents. No network, live credentials or production data are required.

## Security reporting

Report suspected scanner vulnerabilities privately to [GEM Security Operations](mailto:security@gemcybersecurityassist.com), the security contact listed on the [GEM contact page](https://www.gemcybersecurityassist.com/contact). Include a sanitized reproduction and affected version; do not send credentials, sensitive records, or real secret values, and do not post vulnerability details in public issues. For untrusted checkouts, use an isolated workspace without unrelated readable secrets; safe opens reject symbolic links in every path component but do not provide a full filesystem sandbox. No guaranteed response time is implied.

## License scope

Apache-2.0 applies only to scan_tracked_secrets.py, test_scanner.py and this README in this directory. See LICENSE. The rest of GEM Enterprise remains proprietary, including the original production scanner outside this directory; no enterprise, customer, trademark or branding rights are granted by this component license.

Source provenance: GEM Enterprise PR #292 introduced the scanner under the support371 account. This copy is based on the current main source blob 15238bca6bc99ec4f4d60da08799e512fc212777 at commit de79e803a917ae75c755b93092951e22b36d3047. The implementation uses Python standard-library modules and the external Git executable; no third-party source is bundled. The new tests are original synthetic fixtures.

## Sponsor the scanner

The goal is to help developers catch selected credential exposures before deployment. This component is independently usable; it does not require GEM Enterprise access or a hosted scanning service.

[Sponsor ongoing open-source maintenance](https://github.com/sponsors/support371).

Funding priorities (proposed roadmap, not promised deliverables):

- Maintain and test the documented rules and reduce false positives using synthetic fixtures.
- Improve installation and CI examples, distribution, and reproducible demonstrations.
- Evaluate additional detection rules, performance improvements and Git-history support independently before claiming support.
- Publish dated release notes, regression evidence and transparent limitations.

Corporate supporters can choose voluntary one-time or recurring sponsorship through GitHub. Public acknowledgement may be arranged with the sponsor's consent; no logo usage without permission. Sponsorship does not purchase enterprise services, equity, IP assignment, exclusivity, private data, administrative access, or guaranteed outcomes. The Apache-2.0 terms apply equally to sponsors and nonsponsors. Any paid services or special obligations require a separate agreement.

### Community evidence

Independent developers are invited to try the scanner in isolated test repositories and submit sanitized usability feedback, reproducible false positives or public feature requests. For sensitive security findings, use the private reporting channel above. The scanner does not collect telemetry. Public evidence should be linked to actual independent issues, contributions, documented use and release/test results; do not treat self-testing, stars or downloads as verified deployments. No external adoption or sponsorship revenue is asserted here.
