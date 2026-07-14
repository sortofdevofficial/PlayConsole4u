// Every saveable ITEM gets a stable short numeric ID. IDs must NEVER be
// reused or renumbered once assigned.
const ITEM_ID_TO_NAME = {
    1: 'Oak', 2: 'Stone', 3: 'Stick', 4: 'Iron Ore', 5: 'Iron Ingot',
    6: 'Iron Plate', 7: 'Iron Gear', 8: 'Quartz', 9: 'Silicon', 10: 'Sand',
    11: 'Glass', 12: 'Workbench', 13: 'Furnace', 14: 'Stone Pickaxe',
    15: 'Stone Axe', 16: 'Auto Miner', 17: 'Conveyor', 18: 'Conveyor Left',
    19: 'Conveyor Right', 20: 'Solar Panel'
};
const ITEM_NAME_TO_ID = Object.fromEntries(Object.entries(ITEM_ID_TO_NAME).map(([id, name]) => [name, Number(id)]));

export function nameToId(name) { return ITEM_NAME_TO_ID[name]; }
export function idToName(id) { return ITEM_ID_TO_NAME[id]; }

// Same append-only ID rule, separate namespace, for PLACED STRUCTURES.
const BUILD_ID_TO_TYPE = {
    1: 'Workbench', 2: 'Furnace', 3: 'Auto Miner',
    4: 'Conveyor', 5: 'Conveyor Left', 6: 'Conveyor Right', 7: 'Solar Panel'
};
const BUILD_TYPE_TO_ID = Object.fromEntries(Object.entries(BUILD_ID_TO_TYPE).map(([id, t]) => [t, Number(id)]));

export function buildTypeToId(type) { return BUILD_TYPE_TO_ID[type]; }
export function buildIdToType(id) { return BUILD_ID_TO_TYPE[id]; }