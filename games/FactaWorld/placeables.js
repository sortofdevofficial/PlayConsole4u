export const PLACEABLE_ITEMS = ['Workbench', 'Furnace', 'Auto Miner', 'Conveyor', 'Conveyor Left', 'Conveyor Right'];

export const PLACEMENT_OVERLAP_DISTANCE = {
    'Workbench': 1.3,
    'Furnace': 1.3,
    'Conveyor': 1.0
};
export const DEFAULT_OVERLAP_DISTANCE = 1.3;

// Assist radius ONLY for the placement ghost snapping cleanly onto an existing
// conveyor's or Auto Miner's output port (so building a run is easy and lands
// exactly on-port). This does NOT decide whether a link forms — it just helps
// the ghost land precisely enough that the strict port-match check below
// succeeds naturally instead of by luck.
export const CONVEYOR_CHAIN_SNAP_RADIUS = 1.2;

// ===== PORT-MATCHING TOLERANCES — this is the actual linking logic now =====
// A link forms ONLY when a source's output port and a target's entry port are
// physically touching (this tight) AND facing the same direction (this
// aligned). This replaces "find some conveyor within a radius" entirely —
// proximity is no longer sufficient on its own. Only a true physically-
// adjacent, correctly-oriented connection counts, matching how real belt
// systems in Factorio/Satisfactory detect connections: is something literally
// touching my output, facing into it — not "is something nearby."
export const PORT_MATCH_DISTANCE = 0.22;
export const PORT_MATCH_MIN_DOT = 0.94; // ~20 degrees of tolerance