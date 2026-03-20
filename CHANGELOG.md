# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.19.1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.19.0..v1.19.1) - 2026-03-20

### Changed

- **(readme)** GFM tables, roadmap, and contributors - ([9efdb61](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/9efdb6162f7832785dcfd223baa74f8e8649c72a))

## [1.19.0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.18.2..v1.19.0) - 2026-03-20

### Added

- add GFM table rendering with visual grid decorations ([#55](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/55)) - ([7869f40](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/7869f405e5f2589aabac068cb8598d0a58a0a133))

### Changed

- **(deps)** audit fix lockfile (flatted, undici) - ([e4a8d66](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/e4a8d66a5385960a347ba924cc61140d19dd22a2))
- **(readme)** add contributors to acknowledgments - ([c97f30b](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/c97f30bfdd24f5822aa3a8a10e9684a179157b12))
- improve README - showcase best features early - ([a098673](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/a09867318cfc163221f079fbe3e2b0066a0fd41c))

### Fixed

- **(parser)** address GFM table findings (boundary, docs, tests) - ([35c09bc](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/35c09bc071d54e2473c71541fc8b2079ff906f86))

## [1.18.2](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.18.1..v1.18.2) - 2026-03-09

### Changed

- update README and references for consolidated todo list and LaTeX done - ([33fbcab](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/33fbcababef1252ed335e62a53302ad7dc3626e2))

## [1.18.1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.18.0..v1.18.1) - 2026-03-09

### Changed

- **(docs)** exclude todo.md from feature outline validation - ([9395842](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/9395842a68112b5553215ab4fe9d281999f03e63))
- **(features)** consolidate todo into single list, move latex-math to done - ([c3f6cc9](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/c3f6cc985ac5521c4bdf06a65d5d6dca8da0cb15))
- **(specs)** add 004-code-block-math-environments spec and design artifacts - ([d35a104](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/d35a1048be1a645c3950dea6df32488d9301e2a0))
- add .eslintignore - ([ae20179](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/ae20179cb385b8348e0edd456b80c8ce93f16bbe))

### Fixed

- **(math)** correct block math SVG height and body line count - ([1a79aa8](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/1a79aa806291b5ec47daba4ed93e654d9049fc9d))

## [1.18.0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.17.0..v1.18.0) - 2026-03-09

### Added

- **(math)** add support for inline and block LaTeX math rendering - ([dde7c27](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/dde7c27aad3d437bdf1b130422ccd731146f34bf))

### Changed

- **(spec)** mark US5 theme-appropriate math font color as broken - ([68871db](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/68871dbaa114bcd22903e3f8509b4179ef86da24))

## [1.17.0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.16.2..v1.17.0) - 2026-03-08

### Added

- **(config)** add image, horizontalRule, checkbox color settings - ([75d601e](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/75d601e3f30a19bdc5e8b64ecaecb94b9fa58dc0))

### Changed

- **(deps)** npm audit fix - resolve high/moderate vulnerabilities - ([b3a8965](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/b3a89654fa2ba13126665503a9078b9afee258ad))
- **(speckit)** add constitution, product spec, implementation plan, and tasks - ([46a2136](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/46a21369bcdc5d66b0e517db79685d4963bc6997))
- document customizable syntax colors in README; react to colors config and theme in extension - ([ee79d9e](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/ee79d9eacc1763f5cbefe6dc10a25cf2cb3b52ed))

## [1.16.2](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.16.1..v1.16.2) - 2026-02-11

### Fixed

- **(parser)** render bracket-style mailto/URL links as regular links - ([d88b058](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/d88b05880c096ccc9165f1d6ba7790849394f1ca))

## [1.16.1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.16.0..v1.16.1) - 2026-02-11

### Fixed

- state audit - ([a21c093](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/a21c0938b6349affb503312fa5d9db3dfd960fc2))

## [1.16.0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.15.3..v1.16.0) - 2026-02-11

### Added

- **(parser)** show only checkbox for task list items, not bullet - ([37a2818](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/37a281851e761ae6e953f0fa985cdffde62af25b))

### Changed

- **(markdown)** add global toggle for default decorator rendering behavior - ([a4aa998](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/a4aa998df37660abdec659f21b2e388fc2e85a85))

## [1.15.3](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.15.2..v1.15.3) - 2026-02-01

### Fixed

- **(decorations)** use ☑ for checked checkbox to fix blank rectangle ([#47](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/47)) - ([bf507e4](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/bf507e4a49aca129482d8e763b3759e6fbde9fda))

## [1.15.2](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.15.1..v1.15.2) - 2026-02-01

### Fixed

- **(mermaid)** ensure webview is created in VS Code and set view container title - ([98f8c75](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/98f8c7542c66a1ba8375ff05ec650dda9f2b1032))

## [1.15.1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.15.0..v1.15.1) - 2026-01-28

### Changed

- update icon assets and table column alignment docs - ([2367631](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/2367631f66bc4c23a41cdb7e509602cf06174192))

## [1.15.0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.14.1..v1.15.0) - 2026-01-28

### Added

- **(mermaid)** minimize sidebar button visibility and add webview explanation - ([b9d663f](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/b9d663ffec6c1fc973ff1e23b88059b0103e2eea))

## [1.14.1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.14.0..v1.14.1) - 2026-01-27

### Changed

- **(readme)** add video demos section and update demo gif - ([a03743f](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/a03743f719fbc3e7b97d1195f39b0328e9d13061))
- **(readme)** adjust demo layout sizing - ([a836307](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/a83630729a50af0d00c548c35d4826e4a7a3548a))
- **(readme)** add loading attribute to demo GIF for improved performance - ([2529f9a](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/2529f9af1c10bc5d639cba1e1f5101c8a295dcfd))
- **(readme)** update demo GIF layout for better visibility - ([0c0a7f2](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/0c0a7f25a414690482889518a89eab689933570e))
- **(readme)** improve marketing and user experience - ([4fa6b18](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/4fa6b1811dbf306a9f0903bf9592e56da6dae4e8))
- clean up assets and update feature docs - ([c088b9d](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/c088b9dba9d3797b2a8453feebe8b03120edd082))
- update autoplay demo gif - ([580d527](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/580d5276db3f946fd81591639c4946ce8439d0ca))

### Fixed

- restore accidentally deleted icon.png - ([21f565f](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/21f565fb457ad0154ec4416f3cf98d422afc2d22))
- update icon.png - ([0d9d040](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/0d9d040d80fa6c5af603ae3d2577a60d48001398))

## [1.14.0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.13.3..v1.14.0) - 2026-01-27

### Added

- **(parser)** implement autolinks and bare links - ([496770b](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/496770bd441973a6e02e2c78b535e3d1ad722143))

## [1.13.3](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.13.2..v1.13.3) - 2026-01-25

### Changed

- emphasize pushing tags in release process - ([f766940](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/f766940a530dede94381e341c2c4c407f73462b8))

### Fixed

- **(ci)** remove ci dependency from release jobs - ([43c4bf1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/43c4bf125ae1911482f4abeee73274e4e43cf67e))
- **(ci)** add workflow_dispatch to manually trigger releases - ([1510954](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/1510954865018fe811cfc1965052568a67d3387b))
- **(ci)** restore ci dependency for releases with improvements - ([90525ab](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/90525ab66306fff88df5e714659dd8a2562ed1c6))

## [1.13.1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.13.0..v1.13.1) - 2026-01-25

### Changed

- **(deps)** use fixed mermaid version 10.9.5 - ([7c226f8](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/7c226f88924df8178644668082c75ca836ba0bd9))

## [1.13.0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.12.0..v1.13.0) - 2026-01-25

### Added

- **(hover)** add code block hover preview with dynamic sizing - ([10c0dc4](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/10c0dc4daabdcfd1e265900537afd4278b9ac72a))
- **(mermaid)** bundle Mermaid locally for offline support - ([9285fbf](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/9285fbf2fcbc4c26564d1fe304bf485a0d570d42))
- **(mermaid)** add hover indicator and improve height calculation - ([ecca9e1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/ecca9e1bdad7387bb3326382d0e90bf79438bdaf))
- **(mermaid)** add error SVG display for rendering failures - ([7a1bc7e](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/7a1bc7e7fbeb6fefc9aee22d51838485993e3873))

### Changed

- **(bundle)** exclude TypeScript declaration files from package - ([27a1113](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/27a11137d9651d7b3ba416ce4ac440805f5ba2ae))
- **(deps)** downgrade mermaid to v10.9.5 - ([41f3f51](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/41f3f514d087c732892dc73f95725fa27b2c4961))
- **(deps)** update mermaid to 11.12.2 - ([58585ef](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/58585ef9774e7f0eaf4a635759dc38918c699860))
- **(lint)** fix linting errors and warnings - ([641c5ce](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/641c5cea172f943cd66fc763a0ae3f6fd9ac06b6))
- **(mermaid)** implement Phase 1 performance improvements - ([2092b72](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/2092b72d279930bd75b733b6c4cb5c36c119d555))
- remove duplicate media directory to reduce extension size - ([edc3351](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/edc335125ccf09280b3ffeab946df250ed287c8b))
- update feature documentation and test coverage references - ([e46613e](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/e46613eef86982580b26dc840a9d7be9712c2be8))

### Fixed

- **(config)** exclude examples folder from TypeScript checking - ([81abaf6](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/81abaf68acbf3b1e693808b108dc19a10f980f16))
- **(hover)** convert Mermaid SVG to data URI for hover popup - ([2087f2d](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/2087f2d38a7f85a70d502bce72121db91c4d1006))
- **(mermaid)** correct SVG extraction from cheerio processing - ([69765bf](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/69765bf812c08a8e8b77985cfda086433244fd31))
- **(mermaid)** render gantt charts in explicit-width container to fix zero-width layout issue - ([ae88bb4](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/ae88bb4a28887120cb250b2f5360e12b6c496044))
- **(mermaid)** resolve race condition in concurrent render requests - ([1c2fcb1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/1c2fcb13fc8271f2eb08b565f68daa2a75b53b8c))
- **(mermaid)** resolve memory leaks and improve hover rendering - ([0416a0d](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/0416a0d7000e60df470ea36bc3c3f114c945629d))
- **(mermaid)** handle large SVG rendering in hover dialogs - ([9e21f75](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/9e21f75acdc11d44a0981f88f43df42074190e79))
- **(parser)** prevent markdown formatting decorations inside code blocks - ([cd5f859](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/cd5f8598d5ca0705e5b6be1b86771cd6f363b1c1))

## [1.12.0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.11.1..v1.12.0) - 2026-01-24

### Added

- Add emoji shortcode rendering - ([2988d28](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/2988d281bbb273b306339cddef2a9f96d90b9c9d))

### Changed

- **(build)** remove Makefile and streamline build/release with npm scripts - ([68c9391](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/68c93919cdb54363759c268affeef40a41197b72))
- **(parser)** implement lazy loading for emoji map and improve test coverage - ([1141a8c](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/1141a8c6dc6bfd980384522314af90745982301a))
- update feature documentation and README for emoji support - ([7c62b77](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/7c62b777236accb7353cdf7e84eff9e39c6ec604))
- add git-cliff to devDependencies - ([f44225f](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/f44225fed3fc91fa2b942346d164a519a78d8fba))

### Fixed

- **(build)** exclude sourcemaps and dev config from extension package - ([12f2749](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/12f2749c69cb24d0cb76ae0ccef1916ca0150610))
- **(release)** address PR review feedback - ([d58908d](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/d58908d43071cb7829d00bce0f870196b12610f4))
- **(release)** address PR review feedback - ([2bdc35c](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/2bdc35c22ce5557de68c2914579ad5dee502de62))
- **(release)** improve git-cliff availability check - ([09bcae2](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/09bcae2cac1e5e6c3395a9c189a87e55f68706a7))

### Build

- **(versioning)** add release generation instructions - ([0a61a8b](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/0a61a8bbad40f69c4afb9d0fb8be21e4fb1c06ae))
- **(versioning)** add release generation instructions - ([4b17246](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/4b1724607c56af35591d7d24236c467fae2072c6))

## [1.11.1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.11.0..v1.11.1) - 2026-01-22

### Changed

- **(architecture)** update documentation to reflect refactored structure - ([c4b28cb](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/c4b28cb3ffa42b2acacb5cc1417c6124c15c41d7))
- fix hover provider and click handler tests for refactored architecture - ([8091998](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/80919988b09efc8603ce3038beede3e05e1ed4bc))
- optimize VSIX package size by excluding dev files - ([8d00fa0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/8d00fa0df5436aa084ad63a2d600a70c24ffdea0))

### Fixed

- **(docs)** correct markdown table formatting in UAT template - ([474c494](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/474c4948c18b5a71411a3dcccfb030e3ff3db94e))
- **(parser)** prevent markdown formatting decorations inside code blocks - ([9c75ab8](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/9c75ab84fbc5c1367a1774957ce8b52ce90c4b67))

## [1.11.0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.10.0..v1.11.0) - 2026-01-20

### Added

- **(build)** add Makefile for release automation - ([16e167f](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/16e167f5a810a1e0876002a26ec632d4b76ffa16))

### Changed

- **(agents)** add release checklist with validation steps - ([8637577](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/8637577910574a72d17aa980448699df52d2c765))
- **(agents)** add Makefile quick reference to release section - ([32ba7ba](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/32ba7baf95fa2246d257c2eb1d906ec95176c825))

### Fixed

- **(docs)** restructure image-ux-improvements to match feature file format - ([ccac3fc](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/ccac3fcf6761e345233533a6400f879ab7735d28))

## [1.10.0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.9.2..v1.10.0) - 2026-01-20

### Added

- **(hover)** add image and link hover providers with comprehensive test coverage - ([9ab7e9a](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/9ab7e9ab2438deb9a753ab84bfd42af8397db14e))

### Changed

- **(hover)** add comprehensive tests for hover providers and click handler - ([6d3b995](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/6d3b995943e5a50c6e568ba15c41ad8ab428a3c9))
- update README and docs to reflect new test coverage - ([153fc67](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/153fc67781346b5502159616adbef03833b7700f))

## [1.9.2](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.9.1..v1.9.2) - 2026-01-19

### Fixed

- **(decorator)** suppress code block background in raw state to restore selection visibility - ([fc88cc1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/fc88cc117b106ca8767add4f88586fecc92347aa))
- **(decorator)** add selection overlay to restore visibility in code blocks - ([6d4cc12](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/6d4cc12fb677511aeef6dd793340dc346da341b6))

## [1.9.1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.9.0..v1.9.1) - 2026-01-19

### Changed

- showcase syntax shadowing 3-state model in README - ([dce2ef1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/dce2ef132b0335b570752f7fdb11a8ee69fada9b))
- add code blocks and frontmatter screenshot to README - ([e0c5eac](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/e0c5eac184217bfb3a5d2d93fcc4bba59669aa74))
- add syntax shadowing screenshot to README - ([f3361fd](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/f3361fd7651abc9591e79b1ba8d9f10780511671))
- reorganize README layout and improve demo section - ([5a186a3](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/5a186a345ac7ed2e558b16b21cf263847c09e3d9))

## [1.9.0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.8.0..v1.9.0) - 2026-01-18

### Added

- **(decorations)** add configurable opacity for frontmatter and code block language - ([60f1555](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/60f1555c7c8df6d672e756716ebc3793149e7866))
- **(decorator)** implement syntax shadowing M1 - keep semantic styling while editing - ([abe024c](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/abe024c785cf24487de6e21eb2ebf77e81e776e1))
- **(decorator)** implement 3-state syntax shadowing model (Rendered/Ghost/Raw) - ([601d37c](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/601d37c742434519a1479b42a8ab11435edda4a9))
- **(decorator)** 3-state model working correctly - ([0d574a4](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/0d574a49b898e6702ea3a0f9813c8b2f22ffe74c))

### Changed

- **(config)** [**breaking**] remove redundant editor.applyDecorations setting - ([1562309](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/15623090fd2f58c5fe6dd72f8830cdccbce05b1d))
- **(decorator)** eliminate O(n²) scope extraction via parser-emitted scopes - ([d8eb850](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/d8eb850e4e0757702b43dd5f8ccf1d5cd25773b2))
- **(docs)** organize feature files into todo/done folders - ([ecddd75](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/ecddd757ba41e10d2bc3192aa44d231f0474b1ce))
- **(example)** expand Markdown example document with comprehensive formatting and syntax examples - ([12624be](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/12624bed88eab109207c849e6faa38c78840eeac))
- **(features)** split syntax-shadowing into milestone-based files - ([1268b33](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/1268b33b45caa499e177b197f9f183b18ee49519))
- uat 1 done - ([85cc44c](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/85cc44c62875895a08265f5feffb8221f45ca2b5))
- organize UAT files into separate folder - ([e5aefa6](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/e5aefa69144ebf07c3dd8d908a1ebfb26b9f64e0))
- remove M3 milestone and clean up feature documentation - ([94981e0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/94981e0085b37ce794d290be6630cb66222256ed))
- update documentation for implemented features from syntax-shadowing-m2 branch - ([42367bc](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/42367bc7b143915aa82068f2acd8f9d39aac6315))

### Fixed

- **(decorator)** reveal horizontal rules in raw state when cursor/selection intersects - ([fa23fd0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/fa23fd029316392f5cdb4b689d988ef35da1b6fe))
- **(decorator)** improve inline code scope detection and increase ghost visibility - ([76df38c](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/76df38cde9a1f645495373446d8a73668e444ad3))
- **(decorator)** keep leading markers rendered on active line, show raw only on overlap - ([3891a98](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/3891a983be92c6bdf11c5a73f2b50a7aca573732))

### Ci

- update GitHub Actions to use latest checkout and setup-node versions - ([0f20630](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/0f20630fe1d31dbebb1e8416caf85c11e893ae06))

## [1.8.0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.7.4..v1.8.0) - 2026-01-10

### Added

- **(decorations)** ensure list markers and checkboxes match text color - ([3ca6419](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/3ca641945ba99f5ee731240e1251e040890733c1))
- **(decorations)** add theme-aware background colors for inline code - ([158ca1b](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/158ca1b661d156fa60ce28abb0ac1f1c64f32f80))
- **(parser)** add inline code border styling with transparent backticks - ([d1cad62](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/d1cad62783a6382a0018e423b785663e57ad51c3))

### Changed

- improve code quality, type safety, and DRY compliance - ([cd1e07e](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/cd1e07eb10be8659c4661ccb9e93061f43f4ff05))
- remove agent roster and fix documentation inconsistencies - ([7561707](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/756170786c16070f2429d7e8c47a9c8fd133a0be))
- remove unused markdown preview settings and custom CSS - ([58279bd](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/58279bd9b525f16124a1fae83680f7ae5884844d))

## [1.7.4](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.7.2..v1.7.4) - 2026-01-10

### Changed

- **(decorations)** add bold font weight to checkbox decorations - ([6bc3c02](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/6bc3c02842533e718c765fc9780776495ae3d18a))
- **(position-mapping)** extract shared position mapping utility - ([a5fa4cc](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/a5fa4cc06bbb70276b9e2edc44c47d0607127b74))
- update architecture documentation for position-mapping utility - ([c5f3365](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/c5f3365c97f459205174d5de7a5f43b974b551a5))

### Fixed

- **(link-provider)** handle CRLF line endings in table of contents links - ([57f40c7](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/57f40c710f860c42c5e60a64d0411d005fdb3261))

## [1.7.2](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.7.1..v1.7.2) - 2026-01-09

### Changed

- change list markers from dashes to asterisks in README - ([c75d2b7](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/c75d2b7f3c632493b260edbcd7f02f9775d3b4dc))

## [1.7.1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.7.0..v1.7.1) - 2026-01-09

### Changed

- add OpenVSX and GitHub Releases links to README - ([f33f130](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/f33f1303c447e131749d1da03fde8633c03c67d4))

## [1.7.0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.6.1..v1.7.0) - 2026-01-09

### Added

- **(parser)** add YAML frontmatter support - ([15ceb9c](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/15ceb9cf635586e36e12d0e96c20d0f1135ad532))

### Changed

- add issue links to upcoming features in README - ([91d1fa7](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/91d1fa7e25543faacff1e3254de65d077ff56e8c))
- add verification step for issue list in AGENTS.md - ([73c8f31](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/73c8f312f2e30f2e564365dfebc143f7ab875379))
- update section header for Configuration in README - ([88388f6](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/88388f6311a46d5680364d06ea12946d503cd2ca))
- reorganize upcoming features section in README for clarity - ([c7ba333](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/c7ba33397e2a0db9572243e4746a6c822b2bff77))
- move YAML Frontmatter to implemented features section - ([b6f8234](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/b6f8234f0bb4302e5d3e8138776c16c74febe5af))

## [1.6.1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.6.0..v1.6.1) - 2026-01-09

### Changed

- add v1.6.0 implementation entry to AGENTS.md - ([41d011e](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/41d011e8c37b658b3a718f4f4a57310989100b3c))
- add changelog update reminder to release process - ([242c3b1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/242c3b1fd0fd6f52329c9ab59dd5c0bef71d252a))

## [1.6.0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.5.1..v1.6.0) - 2026-01-09

### Added

- **(decorator)** add defaultBehaviors settings for diff view and editor - ([f7d205f](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/f7d205fa07386540065b0cc6f81bfb6d9b041a36))
- **(docs)** add feature file outline validation - ([20bbea8](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/20bbea8fa251262a255743178dbed623f24f0071))

### Changed

- **(features)** add feature request tracking and disable-for-diffs spec - ([9e575ec](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/9e575ec59dfd5475bd6371eb4551f0b3212133fb))
- **(features)** add table column alignment feature specification - ([f955791](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/f955791919fc1a60594ba744683e0a4ab12d6b65))
- **(features)** rename disable-for-diffs to show-raw-markdown-in-diffs - ([de52503](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/de5250361b0e4b892c6b2c47254895b5f3075a9a))
- **(features)** update status of multiple features to TODO and DONE - ([69a2f27](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/69a2f27d4bfa1a11addcbedaad5204a29b2f21ee))
- add E2E testing strategy for visual decoration verification - ([f8b4efd](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/f8b4efd94cff4639a6ee29c36919c9843836151e))
- update documentation guidelines and feature workflow - ([283a50f](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/283a50fcf7b404453c4c465264e590e86a64a17e))

### Fixed

- **(scripts)** exclude AGENTS.md from feature validation - ([5286d75](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/5286d75bc0dafb9e40ebb6964471d921442c6044))

## [1.5.1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.5.0..v1.5.1) - 2026-01-07

### Fixed

- **(decorations)** remove explicit color override for H4-H6 headings to respect editor theme - ([bba18c3](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/bba18c3837a5ce127a6e725155a13c747d08c2bd))

## [1.5.0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.4.0..v1.5.0) - 2026-01-07

### Added

- **(ci)** add automated npm audit fix workflow - ([02ec710](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/02ec7106daf8526df78e99ba3e99b3948fa47a2e))
- **(ci)** add test verification to automated npm audit fix workflow - ([8530678](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/8530678697792aee49a3dab650e5a2e2ac9c22b0))
- **(parser)** implement task list enhancements with GFM compliance - ([6969e2e](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/6969e2e20d51816b9ac89c280646c423c7dab26d))

### Changed

- **(ci)** update CI workflow and add release job - ([c4b9321](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/c4b9321999d176955a8190ad6115914736bd4b0e))
- **(decorations)** use ThemeColor for horizontal rule border - ([1edc6d1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/1edc6d1de5a6ff1d309f7480fff0356547d26b80))
- **(decorations)** reduce horizontal rule border width to 1px - ([5e50ff0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/5e50ff0c61bb238cf360c33fc326ba8306da7d82))
- **(deps)** fix npm audit vulnerabilities - ([e72468f](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/e72468f108a1d242ebe8dfb10e538f597cf3cbdb))
- **(security)** add SC1 Security Requirements document - ([70d2fbc](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/70d2fbc8d1bfd638df6d782131cba0842375e43a))
- **(test)** update test report paths to use dist directory - ([bf16d87](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/bf16d87a0f3f8bd30550be522cea17afe3b94f42))
- reorganize documentation into project and product directories - ([5b5dbcd](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/5b5dbcdad54e2e74bdfc308d1cfd26136292de13))
- add workflow chart design guidelines and update stages.csv format - ([af08413](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/af08413def883641e9a5f6d1c562c2c7c0b4ebf5))
- enhance example.md with GFM edge cases and formatting examples - ([222b299](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/222b29920aa0d6f8521c9887e8fc586bd5353a5c))
- remove obsolete project documentation files - ([164ac65](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/164ac650e985536b603a3b5db3fa7dfb710f7e2c))
- update PO1-Problem-Definition.md for improved clarity and organization - ([9e9eae5](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/9e9eae528399cdaced44dde6a6d9d7ca9492e50a))
- remove outdated AI documentation files - ([86d2908](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/86d290827a69059ac25be9c5b6fdaba3b4c4728a))
- refine documentation structure and update content organization - ([9cb50a3](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/9cb50a33f8ee86d8ea2143844dab96a547a582b0))
- add new use cases for Markdown extension features - ([cf03acf](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/cf03acfe67ceb18365c3343d2fd74aedbcb0d468))
- remove obsolete AI-related documentation files - ([c756db2](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/c756db20dac364b1c0e60887fa0cf1c4727761ca))
- remove obsolete documentation files and templates - ([2f37b52](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/2f37b5273ff3dd541909db81d8dcfbb5febc2fa9))
- streamline documentation by removing outdated files and templates - ([4f86cde](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/4f86cdecd5181c43d0790488dc7237648a4bb1f3))
- update artifact paths and validation scripts in workflow documentation - ([0e5abf3](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/0e5abf399048e260a19790bbea193e6413424775))
- enhance AGENTS.md with clearer human input protocols and execution steps - ([e01c2c1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/e01c2c186be7545efa8db992c12779c118059c8b))
- update .gitignore to include new directories - ([d6b4bc9](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/d6b4bc963dc3e7d21f13788c4ab4ea1b6ffffcb7))
- update .gitignore to reflect new context directory - ([5863892](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/5863892b3881f774e07852333c1f7dbc946e637a))
- update README.md to enhance Markdown features section and outline upcoming enhancements - ([655a4f7](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/655a4f7307ca51a426ebbe4d8f26550cb83231a9))
- add feature implementation table and split features into separate files - ([fed98a1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/fed98a13561363fcf2927496dca19daba7257418))
- add implemented features documentation - ([a8b9f08](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/a8b9f08a51d8e95639be2db7153c6047288eedc7))
- add acknowledgements and license attribution - ([ebe8b4b](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/ebe8b4bfe3c8ee4902886967f6180c16d5363c97))
- update .gitignore to include context-example-repositories and examples directories - ([931e9c1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/931e9c13e50e0f6862e69627fd43b25655c41a7f))
- remove old vsix package file - ([2f450d0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/2f450d0a8de5a44a20c47e54c0858f07789feffd))

### Fixed

- **(decorations)** prevent horizontal rule from expanding editor width - ([721a258](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/721a258296536ce138db5e4526375c0d55b3d8b7))
- **(parser)** prevent ordered lists from being replaced with bullet points - ([67ad46f](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/67ad46fc6ef77cd7d15b12276e2d799d2dbc45b1))
- update workflow node identifiers and enhance validation script paths - ([fe006b3](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/fe006b3e8c1d7728c88a31ee132541bd53b18f2a))

## [1.4.0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.3.12..v1.4.0) - 2025-12-25

### Added

- **(decorator)** toggle checkbox on click - ([7aeb4e8](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/7aeb4e8be2d90a31dddc8cf94f02efc7d0e59f7f))

### Changed

- **(ci)** trigger CI build - ([6f60486](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/6f60486bfd5c06c3ee115845e0a7948dc2e83a21))
- **(deps)** adjust dependency strategy and add Dependabot - ([b4b2b10](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/b4b2b10608c651ba4e56e75abd61506d0d04cc63))

### Fixed

- **(ci)** downgrade VS Code engines and fix Jest test script - ([e439c9f](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/e439c9fd3ff2b8209375ba0570953827f1f4469f))
- **(lint)** resolve all ESLint warnings and improve config - ([ff2479d](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/ff2479dba205c0322073a179c8505ae607f67ffa))

## [1.3.12](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.3.11..v1.3.12) - 2025-12-21

### Changed

- reduce extension size from 8MB to 328KB by excluding demo assets - ([4c3a9d0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/4c3a9d0528fd1bf5c8a6022e306f46b1c1df71a1))

## [1.3.11](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.3.10..v1.3.11) - 2025-12-21

### Changed

- update README - ([d956dd5](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/d956dd51b4f616151208f20a2b762cfe67f0155e))
- fix image layout in README - ([3209549](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/3209549934600c42058d0afb3931de9d4ffa198f))

## [1.3.9](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.3.8..v1.3.9) - 2025-12-21

### Changed

- update README links and assets - ([f78a074](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/f78a074b81f50ef3848b609b441fae3cc4da6261))

## [1.3.6](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.3.5..v1.3.6) - 2025-12-21

### Changed

- bump version to 1.3.6 and rename images folder to assets - ([00e9e39](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/00e9e3959e5c52ffb471191a9d4163312101d0e7))

## [1.3.5](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.3.4..v1.3.5) - 2025-12-19

### Changed

- bump version to 1.3.5 - ([9cf141c](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/9cf141ced314cb93361b3a1c6a51c5bd9183261c))

### Fixed

- **(decorator)** handle CRLF line endings correctly - ([7766aa6](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/7766aa6fa8e41a27d289506cb90cdb26e3207126))

## [1.3.4](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.3.3..v1.3.4) - 2025-12-19

### Changed

- **(ci)** split CD jobs into separate vsce and ovsx jobs - ([41569ec](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/41569ec6d969273798879b44be75033f051fda55))

## [1.3.3](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.3.2..v1.3.3) - 2025-12-19

### Fixed

- **(ci)** use npx vsce instead of global vsce command - ([5e4f7da](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/5e4f7daccb033cefc3fa54f67f20ace023a60d3a))

## [1.3.2](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.3.1..v1.3.2) - 2025-12-19

### Added

- **(ci)** add OpenVSX publish step and inline deploy commands - ([816912d](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/816912da3b748014a7ed982aa72d23354919309c))

### Changed

- add comprehensive CONTRIBUTING.md guide - ([8aee8b1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/8aee8b10c7d35dee61b4e0db9f38c2da1b42dc3a))
- bump version to 1.3.2 - ([d007f78](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/d007f78b5d025d37334b2444ec676cb60f7a7706))

## [1.3.1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.3.0..v1.3.1) - 2025-12-19

### Fixed

- **(build)** bundle runtime deps for packaged extension - ([9365306](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/9365306eff07e061818a20867e959cfd948b2aa5))

## [1.3.0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.2.0..v1.3.0) - 2025-12-19

### Changed

- **(parser)** implement phase 1 optimizations - ([4278842](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/4278842c8357013dfd7e7693c299ce9765624124))

## [1.2.0](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.1.5..v1.2.0) - 2025-12-19

### Changed

- implement high-impact performance optimizations - ([9396d9e](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/9396d9e6a9a25ba8ccd449982994de68681612d7))

## [1.1.5](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.1.4..v1.1.5) - 2025-12-19

### Changed

- replace video files with optimized GIF - ([ff94da1](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/ff94da177b5c4a9f4028f59602ee9278b738b354))
- bump version to 1.1.5 - ([1c08c2b](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/1c08c2b443ad4f879c0e73c082dfa5a482a19645))

## [1.1.4](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.1.3..v1.1.4) - 2025-12-19

### Changed

- add MP4 video format and bump version to 1.1.4 - ([709ab2d](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/709ab2dee25eb1ff63df601ca37a9c547ed08d7b))

## [1.1.3](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/compare/v1.1.1..v1.1.3) - 2025-12-19

### Changed

- bump version to 1.1.3 - ([03d35ac](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/03d35acbfe550c38d954816079c0d5f988b4da40))

### Fixed

- **(ci)** remove Open VSX publishing from deploy workflow - ([7c6d04e](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/7c6d04e8cef41b7f4953ddcf739c2676a704e4ae))

## [1.1.1] - 2025-12-19

### Changed

- **(ci)** add clarifying comments for cd job conditions - ([fe8733e](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/fe8733e427c8e18c8e3ae4af784171a21ed44850))
- improve README structure and add @docs agent - ([a905b59](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/a905b597345ad1e1edba9e1b13d6cb7aee404987))
- remove Open VSX publishing from deploy script - ([0992e55](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/0992e55c1a88bb0575a2e1ca1778276f8ec15554))
- update version and readme.md with example videos/images - ([7bc34be](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/commit/7bc34be463b732e099980d15a0f3de4cce1413e6))
