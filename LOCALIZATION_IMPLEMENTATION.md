# Localization implementation — 0.2.0.0

Seven explicit languages are supported: ja, en, de, fr, ko, zh-Hans, zh-Hant. No Auto selection is stored or shown.

## Native plugin

A valid saved Configuration.Language wins. Otherwise the plugin resolves IClientState.ClientLanguage, then IDalamudPluginInterface.UiLanguage, then English, and persists the result once. Regional codes and underscores are normalized; ambiguous zh is not guessed. No supported public launcher-language API was identified in the targeted SDK, so no private launcher configuration is read.

The Config selector uses native language names and stable ImGui IDs. Switching persists the language and writes a revisioned ui-language.json for the local website. Other settings, including an explicit AutoStart=false, are retained. Plugin-owned labels, status messages, help and errors use Localization.json (24 keys per language).

## Website

647 keys per language cover owned labels, help, status, validation, dialogs and browser-tool metadata. English is the final fallback for unknown dictionary keys. Game item names, character/retainer names and user list names retain their original data. The currently available official game catalog remains Japanese; catalog localization is not claimed.

Existing explicit browser-language preferences survive the first migration. Later Config language changes are synchronized by revision without resetting filters or text inputs. Browser changes are stored locally and survive refresh. Explicit language URLs are consumed once.

## Fonts and reproduction

Four renamed Allagan UI font subsets derive from the pinned official Noto CJK source documented in fonts/NOTICE.txt. OFL copyright and license are shipped. prepare-fonts.ps1 validates source hashes; subset-fonts.py builds the subsets using fontTools 4.66.1. The coverage report verifies all 1,361 required codepoints across the four fonts. Native SafeFontConfig includes all subset UCS-2 glyphs; web fonts use swap and system fallback.

## Verification and limits

- Localization contract: 410 checks, covering initial selection, normalization, migration, persistence, seven dictionaries and placeholder compatibility.
- Website regression and localization suite: 42 tests.
- Host lifecycle suite: nine checks.
- Browser checks: seven languages, long German labels, Korean and Chinese glyphs, retained search input, refresh persistence and Config revision synchronization.
- Package checks: isolated startup, language resources, fonts and notices, language API, localized direct-link error, migration preservation and cross-origin rejection.
- Clean Release build and release package validation are required before publication.

Native in-game font rendering, Config switching and actual restart clicks have not been exercised in the game. They remain acceptance limitations; the automated managed checks and website checks do not replace those checks.
