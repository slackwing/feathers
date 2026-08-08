# 17.super-metroid-hack

Making my own Super Metroid ROM hack. Research notes below (gathered 2026-08).

## Setup state (2026-08-03)

Installed without sudo:
- `~/.local/bin/asar` — v1.91, built from source (RPGHacker/asar)
- `~/.local/bin/flips` — CLI build from source (Alcaro/Flips), -O3
- `~/.local/bin/mesen` → `~/.local/opt/mesen2/Mesen` — official 2.1.1 Linux build
- `~/.local/opt/smart/SMART.exe` — beta 2.0.9570.38488 from edit-sm.art (needs Wine)

Verified: asar assembles onto a 3MB image at correct lorom offsets; flips BPS
create/apply round-trips byte-identical; Mesen binary runs (all libs resolve).

Still needed (sudo): `pacman -S wine` (extra/wine 11.x, multilib enabled) for
SMART; optionally `snes9x-gtk` for casual play. Base ROM: see below, not yet
supplied.

## First mechanic: health-scaled aim jitter

`patches/health-aim-jitter.asm` — below 99 energy (absolute, NOT % of max —
energy tanks never penalize), Samus degrades: beam shots deviate randomly
(amplitude = deficit/3), and jump launch speed drops with per-jump
randomness (factor = 256 − d − rand·d/256, d = deficit/2; worst case at
1 HP ≈ 38–65% of vanilla jump height). Jump hook: shared
`STZ GrappleWalljumpTimer` tail of Make_Samus_Jump ($90993A) and
Make_Samus_WallJump ($9099C7); launch speed lives as an 8.8 word at $0B2D
(SamusYSpeedCombined). Bomb jumps and morph bounces stay vanilla. Status: **built against the real base ROM
(`./build.sh` → `build/health-aim-jitter.sfc` + distributable `.bps`);
awaiting first in-game playtest.** Base ROM at `roms/base.sfc` (git-ignored,
never commit). Mesen has no headless mode (Avalonia inits before arg
parsing), so dynamic testing is manual — an in-game savestate would enable
automated Lua-script regression tests later.

Design (addresses from InsaneFirebat/sm_disassembly, clone anywhere and
grep the labels):
- Hook: the `JSR InitializeProjectileVelocities` at `$90B1C3` inside
  `InitializeBeamVelocities` — one hijack covers uncharged/charged/hyper
  beams and enemy reflections. Missiles deliberately untouched (they launch
  at ~0 speed and accelerate, so spawn-time jitter would be extreme).
- Amplitude = ~32·(max−current)/max energy via hardware divide
  ($4204-$4214). Full health ⇒ 0 ⇒ vanilla-straight.
- Deviation = triangular random (difference of the two bytes of one
  `JSL $808111` RNG call), scaled by amplitude via hardware multiply;
  independent draw per axis, added to the projectile's 8.8 fixed-point
  velocities ($0BDC/$0BF0 + slot). Max ≈ ±1.94 px/f vs 4 px/f beam ≈ ±27°.
  Tune strength via the four LSRs in `.computeJitter`.
- Trap discovered: straight shots dispatch to single-axis movers each frame
  (tables `$90AF36` beams, `$90B127` wave), which would ignore perpendicular
  velocity — patch retargets all 10 entries of both tables to the diagonal
  handlers ($AF52/$B143), which run both axes (no-op at zero velocity).
- Fun fact: wave beam's wiggle is cosmetic (baked into sprite frames), not
  actual motion — its movers just never die on block collision.

## Toolchain

| Piece | Tool | Linux status |
|---|---|---|
| Level editor | **SMART** (Super Metroid Auto Repoint Tool) — https://edit-sm.art/ (prefer the Beta build) | Windows-only .NET WinForms exe; run under Wine (community-acknowledged) or a VM |
| Assembler | **asar** (65816) — https://github.com/RPGHacker/asar | Native, builds from source |
| Patching | **Floating IPS (flips)** — BPS/IPS patch create/apply | Native |
| Playtest emulator | **Mesen2** — https://github.com/SourMesen/Mesen2 | Native Linux; best debugger (breakpoints, trace, VRAM/sprite viewers). AUR: `mesen2-git` / `mesen-ce` |
| Alt debug emulator | **bsnes-plus** — https://bsnes.revenant1.net/ | Compiles from source (Qt) |
| Quick play | snes9x | `extra/snes9x-gtk` in official repos |

SMART superseded the old SMILE editor. Its killer feature: auto-repoints room
data as sizes change, and exports the whole project to XML/ASM files — meaning
the hack lives in **git** as text, and builds with asar. That's why this can
be a normal repo project.

New/niche alternative if Wine is annoying: **SMEDIT**, a natively
cross-platform editor (Kotlin/Compose, May 2026, young project):
https://github.com/kennycason/super_metroid_editor

## Base ROM

- Super Metroid **(Japan, USA) "(JU)"**, **unheadered**, `.sfc`
- Exactly 3,145,728 bytes; MD5 `21f3e98df4780ee1c667b84e57d88675`
- Must be self-dumped from my own cartridge. Never distribute the ROM or a
  patched ROM — distribute **BPS/IPS patches only**.
- Do NOT commit the ROM (or a patched ROM) to this repo. `.gitignore` it.

## Workflow

1. Dump/obtain base ROM, verify MD5.
2. New project in SMART → edit rooms, tilesets, PLMs (interactive objects),
   enemies, doors, scroll data.
3. Custom behavior = 65816 ASM patches assembled with asar.
   References: P.JBoy's bank logs; full disassembly at
   https://github.com/InsaneFirebat/sm_disassembly
4. Playtest in Mesen2 (savestates + debugger).
5. Ship as a BPS patch; submit to metroidconstruction.com hack database.

## Community & learning

- **Metroid Construction** — the hub: https://metroidconstruction.com
  (hack DB, resources), forum at forum.metroidconstruction.com, wiki at
  https://wiki.metroidconstruction.com/doku.php?id=sm (SMART guide, ASM
  tutorials, RAM/ROM maps). MetConst Discord is the live channel.
- **Super Metroid Mod Manual (SMMM)** — the classic absolute-beginner
  deep-dive on ROM structure (rooms, states, PLMs, scrolls):
  https://metroidconstruction.com/SMMM/ (updated: https://begrimed.com/sm/).
  SMILE-era but still the best conceptual grounding.

## Related

- `../lib-super-metroid` — old JS utils for the game's RNG (see also
  `../09.smrng`). Unrelated to hacking the ROM itself.
