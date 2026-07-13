export const PLACEABLE_ITEMS = ['Workbench', 'Furnace', 'Auto Miner', 'Conveyor', 'Conveyor Left', 'Conveyor Right', 'Solar Panel'];

export const PLACEMENT_OVERLAP_DISTANCE = {
    'Workbench': 1.3,
    'Furnace': 1.3,
    'Conveyor': 1.0,
    'Conveyor Left': 1.0,
    'Conveyor Right': 1.0,
    'Solar Panel': 0.8
};
export const DEFAULT_OVERLAP_DISTANCE = 1.3;

export const CONVEYOR_CHAIN_SNAP_RADIUS = 1.2;

// Strict item-flow port matching (conveyor <-> conveyor, auto-miner output ->
// conveyor entry): the two ports must be genuinely touching and facing the
// same way for a link to form.
export const PORT_MATCH_DISTANCE = 0.22;
export const PORT_MATCH_MIN_DOT = 0.94;

// Power linking (Solar Panel <-> Auto Miner) is proximity-only and far more
// forgiving -- Auto Miners sit wherever their target resource node happens to
// be (not grid-aligned), so requiring pixel-perfect port touching like items
// need would make wiring power nearly impossible in practice.
export const POWER_LINK_DISTANCE = 1.5;