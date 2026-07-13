// Every saveable item gets a stable short numeric ID. IDs must NEVER be
// reused or renumbered once assigned -- doing so would silently corrupt
// anyone's already-saved inventory (their saved "5" would suddenly mean a
// different item). Always append new items at the end.
const ITEM_ID_TO_NAME = {
    1: 'Oak',
    2: 'Stone',
    3: 'Stick',
    4: 'Iron Ore',
    5: 'Iron Ingot',
    6: 'Iron Plate',
    7: 'Iron Gear',
    8: 'Quartz',
    9: 'Silicon',
    10: 'Sand',
    11: 'Glass',
    12: 'Workbench',
    13: 'Furnace',
    14: 'Stone Pickaxe',
    15: 'Stone Axe',
    16: 'Auto Miner',
    17: 'Conveyor',
    18: 'Conveyor Left',
    19: 'Conveyor Right',
    20: 'Solar Panel'
};

const ITEM_NAME_TO_ID = Object.fromEntries(
    Object.entries(ITEM_ID_TO_NAME).map(([id, name]) => [name, Number(id)])
);

export function nameToId(name) {
    return ITEM_NAME_TO_ID[name];
}

export function idToName(id) {
    return ITEM_ID_TO_NAME[id];
}