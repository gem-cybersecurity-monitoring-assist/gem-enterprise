# Maintenance and sponsorship evidence

## Public component

The scope is the standalone Apache-2.0 scanner and its tests and documentation. GEM Enterprise outside that scope remains proprietary. No grant or sponsorship is represented as awarded, and no independent adoption is inferred from internal testing.

## Version 0.2.0 candidate

The source distribution and command-line entry point support installation from a reviewed checkout. The scanner checks tracked working-tree files for the documented patterns, not history or untracked files. See the README for requirements, security limitations, safe use, private vulnerability reporting and immutable-commit CI integration.

Release gate: exact-head regression tests, package build and install, synthetic clean/finding demo, action workflow, repository verification, independent review and approved release. A candidate is not a published PyPI package or proof of a production deployment.

## Proposed maintenance funding

Illustrative funding priorities, subject to scope and available funds:

| Workstream | Evidence of completion |
| --- | --- |
| Rule maintenance and false-positive reduction | Documented rule changes and synthetic positive/negative regression fixtures |
| Installation and CI integration | Reproducible installation, clean and failing smoke tests, immutable action reference |
| Performance and safety | Reproducible synthetic benchmarks and tests for unsupported or unsafe file access |
| Documentation and adoption | Release notes, limitations, voluntarily reported independent usage and sanitized feedback |

A voluntary contribution supports ongoing maintenance, not an exclusive purchase of features or a promised delivery date. Any grant-restricted spending or paid-development scope must be tracked separately under its actual agreement.

## Evidence collection

Use only genuine, publicly shareable evidence: release/commit links, workflow results tied to their exact head, voluntary issue reports and independent contributions. Where independent users choose to share results, record the tested version, date, environment, relevant limitations and permission to publish. Do not collect credentials, customer files, private repository data or unnecessary personal identifiers. Do not treat a download, star or self-test as proof of external adoption.

## Funding

[GitHub Sponsors](https://github.com/sponsors/support371) is the existing voluntary contribution channel. No funding amount is guaranteed. The project does not give sponsors equity, exclusive rights, ownership of GEM Enterprise, private access or guaranteed security outcomes. Public acknowledgements require consent. Any special contractual obligations are separate from sponsorship.
