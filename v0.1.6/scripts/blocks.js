// --- Block definitions ----------------------------------------------------------------------
export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAVES: 5,
  SAND: 6
};

export const TILE = {
  GRASS_TOP: 'GRASS_TOP',
  GRASS_SIDE: 'GRASS_SIDE',
  DIRT: 'DIRT',
  STONE: 'STONE',
  WOOD_SIDE: 'WOOD_SIDE',
  WOOD_TOP: 'WOOD_TOP',
  LEAVES: 'LEAVES',
  SAND: 'SAND'
};

export const BLOCK_DEFS = [];
BLOCK_DEFS[BLOCK.AIR] = {
  id: BLOCK.AIR,
  name: 'Air',
  solid: false,
  transparent: true,
  breakTime: 0,
  breakable: false,
  faces: [null, null, null, null, null, null]
};
BLOCK_DEFS[BLOCK.GRASS] = {
  id: BLOCK.GRASS,
  name: 'Grass',
  solid: true,
  transparent: false,
  breakTime: 280,
  faces: [
    TILE.GRASS_SIDE,
    TILE.GRASS_SIDE,
    TILE.GRASS_TOP,
    TILE.DIRT,
    TILE.GRASS_SIDE,
    TILE.GRASS_SIDE
  ]
};
BLOCK_DEFS[BLOCK.DIRT] = {
  id: BLOCK.DIRT,
  name: 'Dirt',
  solid: true,
  transparent: false,
  breakTime: 360,
  faces: [
    TILE.DIRT,
    TILE.DIRT,
    TILE.DIRT,
    TILE.DIRT,
    TILE.DIRT,
    TILE.DIRT
  ]
};
BLOCK_DEFS[BLOCK.STONE] = {
  id: BLOCK.STONE,
  name: 'Stone',
  solid: true,
  transparent: false,
  breakTime: 1500,
  faces: [
    TILE.STONE,
    TILE.STONE,
    TILE.STONE,
    TILE.STONE,
    TILE.STONE,
    TILE.STONE
  ]
};
BLOCK_DEFS[BLOCK.WOOD] = {
  id: BLOCK.WOOD,
  name: 'Wood',
  solid: true,
  transparent: false,
  breakTime: 1000,
  faces: [
    TILE.WOOD_SIDE,
    TILE.WOOD_SIDE,
    TILE.WOOD_TOP,
    TILE.WOOD_TOP,
    TILE.WOOD_SIDE,
    TILE.WOOD_SIDE
  ]
};
BLOCK_DEFS[BLOCK.LEAVES] = {
  id: BLOCK.LEAVES,
  name: 'Leaves',
  solid: true,
  transparent: true,
  breakTime: 220,
  faces: [
    TILE.LEAVES,
    TILE.LEAVES,
    TILE.LEAVES,
    TILE.LEAVES,
    TILE.LEAVES,
    TILE.LEAVES
  ]
};
BLOCK_DEFS[BLOCK.SAND] = {
  id: BLOCK.SAND,
  name: 'Sand',
  solid: true,
  transparent: false,
  breakTime: 420,
  faces: [
    TILE.SAND,
    TILE.SAND,
    TILE.SAND,
    TILE.SAND,
    TILE.SAND,
    TILE.SAND
  ]
};

export const HOTBAR_ITEMS = [
  BLOCK.GRASS,
  BLOCK.DIRT,
  BLOCK.STONE,
  BLOCK.WOOD,
  BLOCK.LEAVES,
  BLOCK.SAND,
  BLOCK.STONE,
  BLOCK.WOOD,
  BLOCK.GRASS
];

export const HOTBAR_COLORS = {};
HOTBAR_COLORS[BLOCK.GRASS] = '#5fa956';
HOTBAR_COLORS[BLOCK.DIRT] = '#7c4a1e';
HOTBAR_COLORS[BLOCK.STONE] = '#828282';
HOTBAR_COLORS[BLOCK.WOOD] = '#a6793f';
HOTBAR_COLORS[BLOCK.LEAVES] = '#4ca55a';
HOTBAR_COLORS[BLOCK.SAND] = '#d9c98c';

export const FACE_DATA = [
  {
    dir: [ 1, 0, 0 ],
    corners: [ [1,1,0], [1,1,1], [1,0,1], [1,0,0] ],
    normal: [ 1, 0, 0 ],
    ao: { u: [ 0, 1, 0 ], v: [ 0, 0, 1 ], uAxis: 1, vAxis: 2 }
  },
  {
    dir: [ -1, 0, 0 ],
    corners: [ [0,1,1], [0,1,0], [0,0,0], [0,0,1] ],
    normal: [ -1, 0, 0 ],
    ao: { u: [ 0, 1, 0 ], v: [ 0, 0, 1 ], uAxis: 1, vAxis: 2 }
  },
  {
    dir: [ 0, 1, 0 ],
    corners: [ [0,1,1], [1,1,1], [1,1,0], [0,1,0] ],
    normal: [ 0, 1, 0 ],
    ao: { u: [ 1, 0, 0 ], v: [ 0, 0, 1 ], uAxis: 0, vAxis: 2 }
  },
  {
    dir: [ 0, -1, 0 ],
    corners: [ [0,0,0], [1,0,0], [1,0,1], [0,0,1] ],
    normal: [ 0, -1, 0 ],
    ao: { u: [ 1, 0, 0 ], v: [ 0, 0, 1 ], uAxis: 0, vAxis: 2 }
  },
  {
    dir: [ 0, 0, 1 ],
    corners: [ [1,1,1], [0,1,1], [0,0,1], [1,0,1] ],
    normal: [ 0, 0, 1 ],
    ao: { u: [ 1, 0, 0 ], v: [ 0, 1, 0 ], uAxis: 0, vAxis: 1 }
  },
  {
    dir: [ 0, 0, -1 ],
    corners: [ [0,1,0], [1,1,0], [1,0,0], [0,0,0] ],
    normal: [ 0, 0, -1 ],
    ao: { u: [ 1, 0, 0 ], v: [ 0, 1, 0 ], uAxis: 0, vAxis: 1 }
  }
];
export const FACE_INDICES = [0, 1, 2, 0, 2, 3];
