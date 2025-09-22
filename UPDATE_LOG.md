# AIMinecraft Update Log

Most recent entries appear first. Dates use YYYY-MM-DD (ISO-8601)

## v0.1.11 - 2025-09-20
- Snapshot stored at 'v0.1.11/index.html'.
- Retuned the volumetric cloud march with adaptive step scaling, tighter search budgets, and density-gated shadows to cut high-quality GPU cost.
- Mirrored the adaptive sampling inside terrain cloud shadows so world lighting matches the faster sky pass.
- Reduced default quality presets to leaner step counts while preserving coverage and lighting balance across settings.
- Added an overlay version badge to make it obvious which snapshot a local server is hosting.

## v0.1.10 - 2025-09-20
- Snapshot stored at 'v0.1.10/index.html'.
- Replaced procedural FBM in the cloud shader with precomputed 3D noise textures to slash raymarch ALU cost while preserving detail.
- Added adaptive empty-space skipping and denser lighting fallbacks so high-quality marches converge in far fewer steps.
- Mirrored the texture-driven sampling inside terrain cloud shadows for consistent shading and lower fragment workload.
- Gated the new path behind WebGL2 checks and kept the legacy noise path as a fallback for older browsers.

## v0.1.9 - 2025-09-19
- Snapshot stored at 'v0.1.9/index.html'.
- Reworked cloud raymarch with jittered stepping and fewer samples to cut GPU cost on high settings.
- Reduced FBM octaves and tuned density blending to preserve structure with the lighter march.
- Optimised terrain shadow projection to share the faster noise stack and early-outs when thin.
- Updated quality presets so 'High' targets 56 steps instead of 80 while keeping visuals stable.

## v0.1.8 - 2025-09-19
- Snapshot stored at 'v0.1.8/index.html'.
- Volumetric cloud marching now darkens undersides, adds rim highlights, and improves absorption for richer lighting.
- World chunk material samples the cloud volume to project moving shadows across terrain and structures.
- Cloud blend state drives both sky rendering and terrain shading so toggles and fades stay in sync.`r`n- Wind speed slider now adjusts cloud drift velocity smoothly without positional popping.

## v0.1.7 - 2025-09-19
- Snapshot stored at 'v0.1.7/index.html'.
- Raised the default render distance to 10 chunk rings and aligned the runtime toggle to the new baseline.
- Set volumetric clouds to launch with high quality sampling and 0.12 coverage for crisper skies.
- Spawn routine now finds the nearest grass column so new worlds begin in a grassy biome.

## v0.1.6 - 2025-09-19
- Snapshot stored at 'v0.1.6/index.html'.
- Split the monolithic inline game script into ES modules under 'scripts/' for easier ongoing upkeep.
- Ported config, world, player, interaction, UI, and texture systems into dedicated files without altering gameplay behaviour.
- Added 'scripts/main.js' bootstrapper and updated 'index.html' to load the module entry point.
- Refreshed codex_bootstrap documentation to describe the new modular layout.

## v0.1.5 - 2025-09-19
- Snapshot stored at 'v0.1.5/index.html'.
- Added raymarched volumetric cloud layer rendered via a fullscreen ShaderMaterial over the main scene.
- Wired new settings controls (Volumetric Clouds toggle, quality dropdown, coverage/density/wind sliders) that feed shader uniforms.
- Updated the render loop to composite clouds after the world draw, handle window resizing, and fade clouds on toggle.
- Synced cloud parameters with the existing settings panel and runtime camera state for consistent visuals.

## v0.1.4 - 2025-09-19
- Snapshot stored at 'v0.1.4/index.html'.
- Baked voxel ambient occlusion with directional + sky-aware shading into chunk meshes using vertex colors.
- Updated block face material to vertex-colored MeshStandardMaterial and expanded mesher helpers for corner, directional, and sky samples.
- Added settings UI toggle plus extended strength range; edits force chunk rebuilds so lighting updates instantly.
- Added KeyN flight toggle with free-flight controls (Space ascend, Ctrl descend).
- Sun directional light now follows the player so shadows remain visible when traveling far.
- Documented the new AO default strength for future lighting follow-ups.






