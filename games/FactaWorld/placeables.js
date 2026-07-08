export const PLACEABLE_ITEMS = ['Workbench', 'Furnace', 'Auto Miner', 'Conveyor'];

// Only used by Workbench/Furnace/Conveyor's generic ground-snapped ghost.
// Auto Miner has its own validity rule (must be an unclaimed resource node).
export const PLACEMENT_OVERLAP_DISTANCE = {
    'Workbench': 1.3,
    'Furnace': 1.3,
    'Conveyor': 1.0
};
export const DEFAULT_OVERLAP_DISTANCE = 1.3;