doc_version: 2025-09-17
target: codex_onboarding
project:
  root: C:\Users\oscar\OneDrive\Documents\AIMinecraft
  entry_point: index.html
  size_hint: ~65KB, HTML plus JS modules (scripts/)
  backlog_file: TODO.txt
  run_notes:
    - Works offline; open index.html in a modern desktop browser
    - Click Start to lock pointer; Esc releases pointer lock
    - Avoid mobile; pointer lock and keyboard controls are required
  dependencies:
    - three.js@0.158.0 via https://unpkg.com
    - No bundler, no build step
  vibe: keep inline vibe-coded style; prefer minimal external assets
controls:
  - Movement: WASD, Shift to run, Space to jump
  - Look: mouse while pointer locked
  - Blocks: Left mouse destroys, Right mouse places selected block
  - Select: keys 1-9 or mouse wheel cycles hotbar
  - HUD toggle: KeyE
  - Render distance toggle: KeyR or on-screen button
architecture:
  config: scripts/config.js (CONFIG constants, shadow tuning, cloud shaders, shared settings object)
  block_registry: scripts/blocks.js (BLOCK enum, TILE keys, BLOCK_DEFS, hotbar lists, face geometry data)
  utils: scripts/utils.js (shared THREE scratch objects, seeded RNG, math helpers, mod)
  terrain: scripts/terrain.js (PerlinNoise implementation, TerrainGenerator height/tree logic)
  chunk: scripts/chunk.js (Chunk storage, voxel generation per chunk)
  world: scripts/world.js (chunk map, meshing, ambient occlusion, render distance management)
  player_controller: scripts/player.js (input state, physics integration, collision resolution, flight toggle callback)
  block_interaction: scripts/blockInteraction.js (raycast targeting, break/place logic, hotbar sync, damage overlay control)
  texture_atlas: scripts/textureAtlas.js (procedural tile atlas generator and UV mapping)
  ui_helpers: scripts/ui.js (hotbar DOM factory, message system, break overlay/highlight mesh helpers)
  bootstrap: scripts/bootstrap.js (initialize() sets up renderer, world, controller, UI, settings bindings, animate loop)
  entry: scripts/main.js (imports initialize and boots the game)
runtime_flow:
  - Hotbar slots and message system initialize before pointer lock is requested
  - buildTextureAtlas generates atlas texture and uv lookup passed to World
  - World.refreshChunks throttles at 200ms (performance.now) and keeps renderDistance ring of chunks alive
  - World.setBlock rebuilds the target chunk mesh and neighboring chunks when edits touch boundaries
  - animate loop uses CONFIG.FIXED_TIME_STEP accumulator for physics; renderer draws every frame; FPS label updates every 0.5s
  - Pointer lock change toggles HUD visibility and BlockInteraction/PlayerController enable flags
extension_guides:
  add_block_type:
    - Extend BLOCK enum, TILE map, and BLOCK_DEFS in scripts/blocks.js
    - Update HOTBAR_ITEMS and HOTBAR_COLORS if the block should be selectable (scripts/blocks.js)
    - Add a texture generator inside buildTextureAtlas.generators (scripts/textureAtlas.js); ensure tile key matches BLOCK_DEFS faces
    - Adjust TerrainGenerator if new block participates in world generation (scripts/terrain.js)
  tune_terrain:
    - Modify noise scaling/weights inside TerrainGenerator.getHeightAt/getTreeHeightAt (scripts/terrain.js)
    - Update CONFIG.WATER_LEVEL or CHUNK_HEIGHT (scripts/config.js) — CHUNK_HEIGHT must remain a multiple of CONFIG.CHUNK_SIZE
  customise_controls:
    - Key/mouse bindings live in initialize() event wiring (scripts/bootstrap.js)
    - Pointer lock gating enforced via player.setEnabled and blockInteraction.setEnabled (scripts/bootstrap.js)
    - Block edit rate uses CONFIG.ACTION_COOLDOWN_MS (scripts/config.js and scripts/blockInteraction.js)
  streaming_perf:
    - Render distance constants: CONFIG.RENDER_DISTANCE_DEFAULT/REDUCED (scripts/config.js); toggled via KeyR/button (scripts/bootstrap.js)
    - Chunk disposal occurs in World.removeChunk which also disposes geometry/material references (scripts/world.js)
  style_notes:
    - Keep code in ES module format; reuse exported helpers instead of introducing globals
    - Continue reusing shared TMP_* THREE objects from utils to avoid garbage
    - Maintain vibe-coded aesthetic; keep modules focused and avoid unnecessary dependencies
observability:
  - Use console logging within classes/animate for debugging; no logging layer exists
  - Message overlay managed by createMessageSystem; resets on pointer unlock
  - Highlight mesh (EdgesGeometry) shows targeted block; disabled when BlockInteraction not enabled
pending_backlog (TODO.txt):
  - Make shadows more accurate
  - Fix terrain gen (currently too sand heavy)
  - Add flying mechanics
  - Prototype mobs
  - Investigate volumetric clouds
  - Improve lighting model
  - Introduce tools
  - Creative ideas backlog: seasonal biomes, caves with crystals, gliders, dynamic weather, NPC villages
known_quirks:
  - HUD message string contains replacement characters (?) from copy; safe to swap for ASCII text when editing UI
  - Pointer lock requires explicit user interaction; automated testing must simulate click
  - World seed fixed at CONFIG.WORLD_SEED (default 1337); TerrainGenerator caches keyed as "x,z"
  - No persistence layer; reload regenerates terrain from seed
operational_checklist_for_new_work:
  1. Inspect CONFIG for scale/physics settings relevant to the feature
  2. Locate the module listed in architecture for the system you will modify
  3. When touching block data, keep BLOCK_DEFS, texture atlas generators, and hotbar definitions in sync
  4. After edits, open index.html in browser, start pointer lock, verify chunk streaming and HUD/FPS updates, and sanity-check new functionality

versioning:
  - v0.1.0: Initial snapshot stored at v0.1.0/index.html (2025-09-18)
  - v0.1.1: Shadow tuning and CONFIG exposure snapshot stored at v0.1.1/index.html (2025-09-18)
  - v0.1.2: Settings overlay with uncapped render distance input stored at v0.1.2/index.html (2025-09-18)
  - v0.1.3: Block breaking progression with crack overlay stored at v0.1.3/index.html (2025-09-18)
  - v0.1.4: Ambient occlusion pass and flight controls stored at v0.1.4/index.html (2025-09-19)
  - v0.1.5: Volumetric cloud layer and settings sync stored at v0.1.5/index.html (2025-09-19)
  - v0.1.6: Codebase modularised into scripts/ with bootstrap initialise flow stored at v0.1.6/index.html (2025-09-19)
  - v0.1.7: Raised default render distance, set high-quality low-coverage clouds, and ensured grass biome spawns stored at v0.1.7/index.html (2025-09-19)
  - v0.1.8: Volumetric cloud lighting overhaul with terrain shadows and responsive wind control stored at v0.1.8/index.html (2025-09-19)
versioning_workflow:
  1. Duplicate the latest version folder (copy v<major.minor.patch> to the next version folder). Major version numbers should only be added if the user specifies.
  2. Apply updates inside the new folder only.
  3. Update in-file version identifiers and metadata to match the new folder name.
  4. Document the new version entry in the versioning section above.
  5. Update the TODO.txt file in the root folder where appropriate
  6. Append a human-readable entry to the update log as defined in update_log policy.

update_log:
  path: UPDATE_LOG.md
  policy:
    - Keep newest entry at the top of the file.
    - Use header format: "v<major.minor.patch> - YYYY-MM-DD".
    - Summarize changes in 3-7 concise, human-readable bullets.
    - Mention the snapshot folder path (e.g., `vX.Y.Z/index.html`).
    - Note notable dependency, controls, or config changes when relevant.






