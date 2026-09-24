---
name: Bug report
about: Report a problem with the decoder, the renderer or the integration
title: ""
labels: bug
assignees: ""
---

<!-- Thanks for helping! Please fill in the sections below. -->

## 1. Before you report

- [ ] I have searched the open and closed issues for duplicates.
- [ ] I have read the README status and roadmap; the affected feature
      is expected to work at the current stage. (The project is
      pre-alpha; in-skin capes were removed upstream and are not
      supported.)
- [ ] I can reproduce the problem with the latest available build
      (note: nothing is published to npm yet).

## 2. Description

<!-- A clear and concise description of the problem. -->

## 3. Affected area

- [ ] decoder (`decodeSkin()`)
- [ ] transparency (translucent skins)
- [ ] emissive (glowing pixels)
- [ ] nose (villager / textured)
- [ ] blinking
- [ ] integration / lifecycle (`refresh()`, `rebind()`, `detach()`)
- [ ] demo page

## 4. Environment

- skinview3d-etf version or commit:
- skinview3d version:
- three version:
- Browser and version:
- Operating system:
- Other viewer extensions in use (e.g. skinview3d-blockbench):

## 5. Steps to reproduce

<!--
  A minimal code snippet helps a lot. Please attach a skin only if you have the
  right to share it (the ETF example skins are not MIT-licensed); a self-drawn
  minimal skin is perfect.
-->

1.
2.
3.

## 6. Expected behaviour

## 7. Actual behaviour

## 8. Debug information

<!--
  Console output, `onWarning` messages, and - for decoder problems - the JSON
  summary from the demo's "Decoder preview" tab.
-->

- Console / `onWarning` output:
- Decoder preview JSON summary:

## 9. Additional context
