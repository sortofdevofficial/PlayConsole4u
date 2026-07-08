export const PLACEABLE_ITEMS = ['Workbench', 'Furnace', 'Auto Miner', 'Conveyor'];

export const PLACEMENT_OVERLAP_DISTANCE = {
    'Workbench': 1.3,
    'Furnace': 1.3,
    'Conveyor': 1.0
};
export const DEFAULT_OVERLAP_DISTANCE = 1.3;

// How close two conveyors' exit/entry points need to be, during PLACEMENT, to snap
// the new one into perfect end-to-end alignment with an existing one.
export const CONVEYOR_CHAIN_SNAP_RADIUS = 1.2;

// How close an output point (Auto Miner chute / Conveyor exit) needs to be to an
// entry point (Conveyor entry) for the smart auto-linking system to connect them
// automatically at placement time — no manual right-click linking needed.
export const MACHINE_LINK_RADIUS = 2.0;

// Hard safety cap: a link is NEVER created if its two endpoints end up farther
// apart than this, regardless of how it was proposed. This is what actually
// prevents "linking from too far away" — enforced at the one place links are
// created (completeLink), not just relied upon by the auto-link heuristics.
export const MAX_LINK_DISTANCE = 2.5;