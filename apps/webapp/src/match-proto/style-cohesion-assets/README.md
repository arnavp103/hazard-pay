# Shared bake-off control board

`grime-market-board.prototype.svg` and its rasterization
`grime-market-board.prototype.png` are the **shared control** for the art
modality bake-off tracked on
[#69](https://github.com/arnavp103/hazard-pay/issues/69).

Every lane renders the same board, under the same fixed-angle 2:1 dimetric
camera, with the same palette roles and light direction, so that the variable
under test is the modality and not the scene:

- pixel control (#74) · real-time cel-shaded 3D (#81) · Blender baked sprites
  (#82) · flat low-poly + procedural (#89) · environment register (#91)

These assets originated on the throwaway `prototype/style-cohesion` branch
(PR #79). They were promoted here because a control shared by five lanes must
not depend on an unmerged prototype branch surviving.

**Do not change these files while the bake-off is open.** Re-valuing the
walkable plane is a live question on #69 — two lanes measured their silhouettes
dissolving into it and both correctly declined to move the shared board
unilaterally. Any change invalidates cross-lane comparison and belongs to a
recorded ruling, not to one lane.
