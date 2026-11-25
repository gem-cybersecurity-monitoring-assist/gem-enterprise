# GEM tracked-secret scanner

A small, dependency-free Python tool that checks tracked Git files for runtime environment filenames, high-confidence Telegram bot credential patterns, and public Telegram/bot secret variable names. It reports locations and rule names, not matched values. Exit 0 means no supported findings; exit 1 means findings. Git or execution errors can also produce a nonzero exit.

## Usage

Requires Python 3.10+ and Git. Copy scan_tracked_secrets.py into your own checkout or run it by absolute path with your target repository root as the working directory.

```sh
python3 /path/to/scan_tracked_secrets.py
python3 -m unittest discover -s open-source/tracked-secret-scanner -p 'test_*.py'
```

The scanner is not a comprehensive secret scanner: it inspects tracked working-tree content, not commit history or untracked files, and only detects the documented patterns. Deleted or non-regular files may be skipped. Never test with real credentials. Rotate exposed credentials and remove them from affected history where appropriate.

## License scope

Apache-2.0 applies only to scan_tracked_secrets.py, test_scanner.py and this README in this directory. See LICENSE. The rest of GEM Enterprise remains proprietary, including the original production scanner outside this directory; no enterprise, customer, trademark or branding rights are granted by this component license.

Source provenance: GEM Enterprise PR #292 introduced the scanner under the support371 account. This copy is based on the current main source blob 15238bca6bc99ec4f4d60da08799e512fc212777 at commit de79e803a917ae75c755b93092951e22b36d3047. The implementation uses Python standard-library modules and the external Git executable; no third-party source is bundled. The new tests are original synthetic fixtures.

## Sponsorship

Support maintenance, documentation and expanded detection tests for this open-source component: https://github.com/sponsors/support371

Sponsorship is voluntary, does not purchase enterprise services, and does not imply any guaranteed security outcome.
