# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-06-27

### Added
- MIT license
- GitHub Actions workflows for build and release
- Release checklist in README
- Proper i18n keys for dialog strings

### Changed
- Bumped version to 0.2.0
- Improved sidebar button injection robustness (handles jQuery and raw elements)

### Fixed
- Dialog close behavior in static submit handler
- Creator now resets actor after item creation before reading weapons for linked melee

## [0.1.0] - 2026-06-27

### Added
- Initial release
- DeepSeek client (JSON mode + retry)
- ApplicationV2 dialog with prompt + 1-25 level slider
- Slug resolution with user confirmation for substitutes
- NPC creation:
  - Weapons placed in inventory (held)
  - Linked melee via `toNPCAttacks` + `flags.pf2e.linkedWeapon`
  - Basic support for attachments/subitems
  - Always runs optimize pass (HP)
- Client settings: `apiKey`, `lastPrompt`, `lastLevel`
- Default NPC artwork
- GM-only "Generate NPC" button in Actors sidebar
- Standalone build (scripts/ committed for easy install)
