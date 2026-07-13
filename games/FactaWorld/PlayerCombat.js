// Thin re-export barrel so player.js's `import * as Combat from './PlayerCombat.js'`
// keeps working with one stable import. Real logic lives in:
//   PlayerMining.js    -- held-item models, mining/damage, drop spawning
//   PlayerPlacement.js -- ghost previews, structure/conveyor/miner placement
//   PlayerCrafting.js  -- furnace smelting, workbench assembly, swing animation
//   linkSystem.js      -- conveyor/auto-miner item-flow port linking

export { updateHeldModel, handleSecondaryAction, mineOrHitTarget, spawnDrop } from './PlayerMining.js';
export { tryPlaceActiveItem, updateHoverUI, tickConveyorDrops } from './PlayerPlacement.js';
export { smeltIron, craftIronPlate, craftIronGear, smeltQuartz, smeltSand, craftSolarPanel, tickCraftProcess, applySwingPose } from './PlayerCrafting.js';
export { tickLinkVisuals } from './linkSystem.js';

import { tryPlaceActiveItem } from './PlayerPlacement.js';
import { mineOrHitTarget } from './PlayerMining.js';

export function handlePrimaryAction(player) {
    if (player.punchTimer > 0) return;
    player.punchTimer = player.punchCooldown;

    if (tryPlaceActiveItem(player)) return;
    mineOrHitTarget(player);
}