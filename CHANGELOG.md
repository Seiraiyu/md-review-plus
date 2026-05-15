# Changelog

## [1.3.0](https://github.com/Seiraiyu/md-review-plus/compare/v1.2.0...v1.3.0) (2026-05-15)


### Features

* **web:** terminal submit screens with retry on failure ([97c1a60](https://github.com/Seiraiyu/md-review-plus/commit/97c1a60391f0be61c3190f1544323e79e074dae8))


### Bug Fixes

* **server:** bind to 127.0.0.1 by default; add --host flag for LAN review ([b90534f](https://github.com/Seiraiyu/md-review-plus/commit/b90534f85ebc8a6ee7d88196f0d3b98976f46fc3))
* **web:** hide empty comments sidebar on narrow viewports ([ac39813](https://github.com/Seiraiyu/md-review-plus/commit/ac39813bb1aa5309c75413c1116c3ef1436b13af))
* **web:** stable slug-based section IDs survive hot-reload ([a87d5f9](https://github.com/Seiraiyu/md-review-plus/commit/a87d5f9c08860b25927fc660836f33a8f224d067))

## [1.2.0](https://github.com/Seiraiyu/md-review-plus/compare/v1.1.0...v1.2.0) (2026-05-15)


### Features

* **cli:** --remote flag for end-to-end encrypted relay review ([9f5b166](https://github.com/Seiraiyu/md-review-plus/commit/9f5b166714e902559a8a2ac49606c711197e024d))
* **cli:** silent SSE reconnect with exponential backoff ([0dd30de](https://github.com/Seiraiyu/md-review-plus/commit/0dd30de4abc23cf00e335ddfe610200408a81055))
* **relay:** boot Analytics + Sponsors, schedule daily dedup sweep ([1815785](https://github.com/Seiraiyu/md-review-plus/commit/1815785d3e70f2ccd07116e174f60e9ead0749d7))
* **relay:** E2E-encrypted ephemeral relay service ([e964162](https://github.com/Seiraiyu/md-review-plus/commit/e9641620d242421dd37006652f44b294b4ee4b7a))
* **relay:** light-themed static pages + banner marker ([66c29d2](https://github.com/Seiraiyu/md-review-plus/commit/66c29d20d1b11796b91021795ad7e9df98573a34))
* **relay:** sponsor + analytics endpoints ([af68177](https://github.com/Seiraiyu/md-review-plus/commit/af681777ea79ea86fd9c32af8f3ec5a72a88bb3a))
* **relay:** sponsors config + banner renderer ([33092a9](https://github.com/Seiraiyu/md-review-plus/commit/33092a9e9a435fef47166dd2b9402456135d91ee))
* **relay:** SQLite-backed analytics module with IP-hash dedup ([b17f40f](https://github.com/Seiraiyu/md-review-plus/commit/b17f40f876c08246facce0732e91fae582136dbf))
* **web,relay,docs:** mobile responsiveness, deploy runbook, --remote docs ([9817151](https://github.com/Seiraiyu/md-review-plus/commit/9817151ab6c95e88a1e1e8b6d0bf5c22de24b8b9))
* **web:** /r/:id remote review route with E2E decryption ([9cd7579](https://github.com/Seiraiyu/md-review-plus/commit/9cd7579df70f3abe874b95c064c227a433142d75))
* **web:** light-theme-only, mobile review layout, friendly error UI ([a9ccd41](https://github.com/Seiraiyu/md-review-plus/commit/a9ccd4157ef68c93bea55366e958964dcf47507b))


### Bug Fixes

* **relay:** split relayStaticRoot from staticAssetsRoot for landing/advertise/error ([8de4687](https://github.com/Seiraiyu/md-review-plus/commit/8de4687a93bfd698bf3ac5255702c790eb447afd))

## [1.1.0](https://github.com/Seiraiyu/md-review-plus/compare/v1.0.2...v1.1.0) (2026-03-13)


### Features

* add IPC shutdown handler for cross-platform graceful exit ([fa0bed1](https://github.com/Seiraiyu/md-review-plus/commit/fa0bed15bbb2feaff59a6e214191c62594268556))
* add server build step to compile TypeScript to JS for Node runtime ([48c58be](https://github.com/Seiraiyu/md-review-plus/commit/48c58be0178a1e5a0ea55a875e1a8abe6e6c0eda))
* spawn Node instead of Bun for cross-platform server execution ([a04976f](https://github.com/Seiraiyu/md-review-plus/commit/a04976f0c8fe4414d818d598e404b7fdff3b9568))
* use IPC for graceful shutdown instead of SIGINT signal ([b53a769](https://github.com/Seiraiyu/md-review-plus/commit/b53a76957093239ea0cce9957c331c0d27f26394))


### Bug Fixes

* add .gitattributes to enforce LF line endings on Windows ([e9bc38c](https://github.com/Seiraiyu/md-review-plus/commit/e9bc38c35e60f1baff324ab9d565968a3e03de88))
* remove shell:true from spawn to fix IPC on Windows ([30ef96a](https://github.com/Seiraiyu/md-review-plus/commit/30ef96a3c5280154c0b828db59017bf29888c609))
* use fileURLToPath in installSkills for Windows path compatibility ([974f202](https://github.com/Seiraiyu/md-review-plus/commit/974f20288cbb3981a72c951dd3e9d2f7bfc88983))

## [1.0.2](https://github.com/Seiraiyu/md-review-plus/compare/v1.0.1...v1.0.2) (2026-03-10)


### Bug Fixes

* clarify md-review-plus is a CLI command and add allowed-tools ([f4403f0](https://github.com/Seiraiyu/md-review-plus/commit/f4403f0d323a3ca4acea17f20b602609a0c0fa3b))

## [1.0.1](https://github.com/Seiraiyu/md-review-plus/compare/v1.0.0...v1.0.1) (2026-03-04)


### Bug Fixes

* bump Node to 24 in publish workflows for OIDC trusted publishing ([0c58806](https://github.com/Seiraiyu/md-review-plus/commit/0c58806aa9779c0ad11bc508006b8412dc22a603))

## 1.0.0 (2026-03-04)


### ⚠ BREAKING CHANGES

* release v1.0.0 - mark as stable ([#9](https://github.com/Seiraiyu/md-review-plus/issues/9))

### Features

* add --review blocking CLI mode with auto-shutdown ([be8856f](https://github.com/Seiraiyu/md-review-plus/commit/be8856f39be4955dbad4f6490ddf553b8e4981ea))
* add comment feature ([3352f2e](https://github.com/Seiraiyu/md-review-plus/commit/3352f2e1c721314ec28282cb2c6bd61d60d66850))
* add directory path support ([#6](https://github.com/Seiraiyu/md-review-plus/issues/6)) ([c2a6c48](https://github.com/Seiraiyu/md-review-plus/commit/c2a6c480788e3fb81e3d34ba5ffcde5c3e5fb265))
* add FeedbackOutput panel with submit and copy buttons ([4a9b04a](https://github.com/Seiraiyu/md-review-plus/commit/4a9b04a9e374bb5f6e10bd1d8591ea3ead1cafeb))
* add install --skills command and skill definition file ([aab1c9e](https://github.com/Seiraiyu/md-review-plus/commit/aab1c9e0224e050d9ad5ce79674d7877763e868d))
* add keyboard shortcut tooltip to submit button ([#20](https://github.com/Seiraiyu/md-review-plus/issues/20)) ([47d3320](https://github.com/Seiraiyu/md-review-plus/commit/47d3320d7d05889df9f38d1b50833efb7f252ea2))
* add mermaid diagram support ([#11](https://github.com/Seiraiyu/md-review-plus/issues/11)) ([7d284a1](https://github.com/Seiraiyu/md-review-plus/commit/7d284a11279cc68110ba4cdb85170f4922328dd3))
* add POST /api/submit and GET /api/review-mode endpoints ([ed8d1f7](https://github.com/Seiraiyu/md-review-plus/commit/ed8d1f73b4184c2e56fa103b069e79619af92d4a))
* add search bar ([a921bba](https://github.com/Seiraiyu/md-review-plus/commit/a921bba4f4ceed2d7847714a6d1cb00f97c42af9))
* add SectionNav sidebar with TOC and status badges ([df19719](https://github.com/Seiraiyu/md-review-plus/commit/df19719ac4783de06ee1de4080dba3c14098c5d1))
* add SectionReview component with approve/reject/comment controls ([53beec5](https://github.com/Seiraiyu/md-review-plus/commit/53beec558d8eac789269594d74dd5ba4a6e34a53))
* add sidebar ([1bd8094](https://github.com/Seiraiyu/md-review-plus/commit/1bd80947b048b7df713d24dff835cdaa892dc7a9))
* add support for comment editing ([411967c](https://github.com/Seiraiyu/md-review-plus/commit/411967c2b82c9646e134073e5853c8f8c900a74f))
* add support for dark mode ([8555c5d](https://github.com/Seiraiyu/md-review-plus/commit/8555c5df747b97d1a8c7ca2207747ee429165725))
* add support for HMR ([35f1404](https://github.com/Seiraiyu/md-review-plus/commit/35f140482e69b2a87f289f2d184fdba2e31b6398))
* add support for line jump ([6b046a2](https://github.com/Seiraiyu/md-review-plus/commit/6b046a2c326673edda3b0e9595b479e042972f46))
* add support for right sidebar resizing ([a763cd1](https://github.com/Seiraiyu/md-review-plus/commit/a763cd134a2cd86a511b9095b794c2e54210f357))
* add support for sidebar resizing ([067b4e9](https://github.com/Seiraiyu/md-review-plus/commit/067b4e90f0a208a7bd5e11eed1780fee7439d093))
* add tooltip to copy buttons ([#15](https://github.com/Seiraiyu/md-review-plus/issues/15)) ([b127185](https://github.com/Seiraiyu/md-review-plus/commit/b127185015df3123f574bf665fa9ffd06f99106b))
* add useFeedback hook for structured feedback generation ([03919f6](https://github.com/Seiraiyu/md-review-plus/commit/03919f6eb29109907654d40dabfd1c2b65a2c71b))
* add useSections hook for section-level review state ([a6c7547](https://github.com/Seiraiyu/md-review-plus/commit/a6c7547d44cb2f066a195166be4b2124f64adb5e))
* integrate section review system into CliModeApp ([216677e](https://github.com/Seiraiyu/md-review-plus/commit/216677e7705c0e581be97bbd8f510dbbd8a394a7))
* port increment ([5e87406](https://github.com/Seiraiyu/md-review-plus/commit/5e874061c5cd5602a1b24fa874681e013dee5a96))
* port validation ([d32dfac](https://github.com/Seiraiyu/md-review-plus/commit/d32dfacef2ab8b9969271c606b3a1dadf9ffec5e))
* redesign review mode UI with section cards, sticky top bar, and full-width layout ([648019a](https://github.com/Seiraiyu/md-review-plus/commit/648019a749d4f3349cf32b37cc2127cbef347162))
* storageItem validation ([ec205ab](https://github.com/Seiraiyu/md-review-plus/commit/ec205ab0217b35c5ddd3abc68803ef7f782941b5))
* switch CI to Bun, add trusted publishing, and fix review mode for docs without sections ([c073366](https://github.com/Seiraiyu/md-review-plus/commit/c07336617608e690b5fffebed0c921147e1daeb5))
* use localStorage ([68b2369](https://github.com/Seiraiyu/md-review-plus/commit/68b2369670cbd184a864a380c79afb514f63ef54))


### Bug Fixes

* correct behavior when a single file is specified ([#25](https://github.com/Seiraiyu/md-review-plus/issues/25)) ([aaad335](https://github.com/Seiraiyu/md-review-plus/commit/aaad335416b1af4111ce786e254f454d286cf82e))
* correct setup-bun action SHA to v2.1.3 ([cfcdb62](https://github.com/Seiraiyu/md-review-plus/commit/cfcdb62d497ae074e94b0f49f7156a127ffaa9c1))
* CORS error ([35341a7](https://github.com/Seiraiyu/md-review-plus/commit/35341a7d65ac3fca92154a0b13db42128835ae0f))
* install skill to .claude/skills/md-review-plus/SKILL.md ([80a2bf2](https://github.com/Seiraiyu/md-review-plus/commit/80a2bf26a75a20010a5b64b4b2095b27355e9c0c))
* make markdown images responsive ([3ab9b00](https://github.com/Seiraiyu/md-review-plus/commit/3ab9b0087db86a322ef672e60ad5017cfc79df68))
* node command ([ebd1f65](https://github.com/Seiraiyu/md-review-plus/commit/ebd1f65559ed707ce182a6351eade5d5bb908dd8))
* open correct port ([cc34453](https://github.com/Seiraiyu/md-review-plus/commit/cc344531e9d0a90fca86058e66ad7d1b23310def))
* preserve single line breaks ([#13](https://github.com/Seiraiyu/md-review-plus/issues/13)) ([f5bbacb](https://github.com/Seiraiyu/md-review-plus/commit/f5bbacb7b90ea9e465ddb4fa73f20accec735a42))
* prevent comment form from expanding horizontally ([#18](https://github.com/Seiraiyu/md-review-plus/issues/18)) ([6a38833](https://github.com/Seiraiyu/md-review-plus/commit/6a3883348b9037b9a9beaabfc0dfe0e600ea72a0))
* prevent horizontal scrollbar in comment form ([#22](https://github.com/Seiraiyu/md-review-plus/issues/22)) ([b43920d](https://github.com/Seiraiyu/md-review-plus/commit/b43920dbe2c024ea5f5e883d1c34e6549fc1d471))
* replace pnpm references with bun in scripts and docs ([b8cc2b8](https://github.com/Seiraiyu/md-review-plus/commit/b8cc2b878f202a3f7bca472363098ec571924670))
* resolve CSS lint warnings for baseline features ([1dde92b](https://github.com/Seiraiyu/md-review-plus/commit/1dde92be89086e62842f669582f8c59dff29e22e))
* test ([22eb57a](https://github.com/Seiraiyu/md-review-plus/commit/22eb57a6464d198483730ac9cc7e8318c9938935))
* test Trusted Publishing setup ([f5dd420](https://github.com/Seiraiyu/md-review-plus/commit/f5dd420b9adc1a1979fc7d57ab4dbd3e82f2002e))
* update repository and homepage URLs to Seiraiyu/md-review-plus ([8108cce](https://github.com/Seiraiyu/md-review-plus/commit/8108cceb1162f68b2f6d6aaf753719087b6a3b25))
* use vitest via bun run test instead of bun test in CI ([676fc76](https://github.com/Seiraiyu/md-review-plus/commit/676fc764bf99a4946d2b1d3bbd2a449d0c358fd2))


### Miscellaneous Chores

* release v1.0.0 - mark as stable ([#9](https://github.com/Seiraiyu/md-review-plus/issues/9)) ([8ce154d](https://github.com/Seiraiyu/md-review-plus/commit/8ce154d52d994fa7d4414f47ecb8901ac6130ff5))

## [1.3.2](https://github.com/ryo-manba/md-review/compare/v1.3.1...v1.3.2) (2026-02-03)


### Bug Fixes

* correct behavior when a single file is specified ([#25](https://github.com/ryo-manba/md-review/issues/25)) ([aaad335](https://github.com/ryo-manba/md-review/commit/aaad335416b1af4111ce786e254f454d286cf82e))

## [1.3.1](https://github.com/ryo-manba/md-review/compare/v1.3.0...v1.3.1) (2026-01-17)


### Bug Fixes

* prevent horizontal scrollbar in comment form ([#22](https://github.com/ryo-manba/md-review/issues/22)) ([b43920d](https://github.com/ryo-manba/md-review/commit/b43920dbe2c024ea5f5e883d1c34e6549fc1d471))

## [1.3.0](https://github.com/ryo-manba/md-review/compare/v1.2.0...v1.3.0) (2026-01-16)


### Features

* add keyboard shortcut tooltip to submit button ([#20](https://github.com/ryo-manba/md-review/issues/20)) ([47d3320](https://github.com/ryo-manba/md-review/commit/47d3320d7d05889df9f38d1b50833efb7f252ea2))


### Bug Fixes

* prevent comment form from expanding horizontally ([#18](https://github.com/ryo-manba/md-review/issues/18)) ([6a38833](https://github.com/ryo-manba/md-review/commit/6a3883348b9037b9a9beaabfc0dfe0e600ea72a0))

## [1.2.0](https://github.com/ryo-manba/md-review/compare/v1.1.0...v1.2.0) (2026-01-12)


### Features

* add tooltip to copy buttons ([#15](https://github.com/ryo-manba/md-review/issues/15)) ([b127185](https://github.com/ryo-manba/md-review/commit/b127185015df3123f574bf665fa9ffd06f99106b))


### Bug Fixes

* preserve single line breaks ([#13](https://github.com/ryo-manba/md-review/issues/13)) ([f5bbacb](https://github.com/ryo-manba/md-review/commit/f5bbacb7b90ea9e465ddb4fa73f20accec735a42))

## [1.1.0](https://github.com/ryo-manba/md-review/compare/v1.0.0...v1.1.0) (2026-01-05)


### Features

* add mermaid diagram support ([#11](https://github.com/ryo-manba/md-review/issues/11)) ([7d284a1](https://github.com/ryo-manba/md-review/commit/7d284a11279cc68110ba4cdb85170f4922328dd3))

## [1.0.0](https://github.com/ryo-manba/md-review/compare/v0.1.0...v1.0.0) (2025-12-21)


### ⚠ BREAKING CHANGES

* release v1.0.0 - mark as stable ([#9](https://github.com/ryo-manba/md-review/issues/9))

### Miscellaneous Chores

* release v1.0.0 - mark as stable ([#9](https://github.com/ryo-manba/md-review/issues/9)) ([8ce154d](https://github.com/ryo-manba/md-review/commit/8ce154d52d994fa7d4414f47ecb8901ac6130ff5))

## [0.1.0](https://github.com/ryo-manba/md-review/compare/v0.0.7...v0.1.0) (2025-12-21)


### Features

* add directory path support ([#6](https://github.com/ryo-manba/md-review/issues/6)) ([c2a6c48](https://github.com/ryo-manba/md-review/commit/c2a6c480788e3fb81e3d34ba5ffcde5c3e5fb265))


### Bug Fixes

* test ([22eb57a](https://github.com/ryo-manba/md-review/commit/22eb57a6464d198483730ac9cc7e8318c9938935))
* test Trusted Publishing setup ([f5dd420](https://github.com/ryo-manba/md-review/commit/f5dd420b9adc1a1979fc7d57ab4dbd3e82f2002e))
