import { on } from 'events'

import { aiter } from 'iterator-helper'

import logger from '../logger.js'

const log = logger(import.meta)
const Mouse = {
  LEFT_CLICK: 1,
}

export function reduce_deal_damage(state, { type, payload }) {
  if (type === 'deal_damage') {
    const { damage } = payload
    const health = Math.max(0, state.health - damage)

    log.info({ damage, health }, 'Deal Damage')

    return {
      ...state,
      health,
    }
  }
  return state
}

export function deal_damage({ client, get_state, world }) {
  client.on('use_entity', ({ target, mouse, sneaking }) => {
    if (mouse === Mouse.LEFT_CLICK) {
      /* TODO:
        V : Basic Weapon Damages
        V : Critical damage
        X : Sync to inventory
        X : Add Statistics of Belt, Amulet and other
        V : Add WeaponStatistics+PlayerStatistics algorithm
      */

      const { inventory, stats } = get_state()
      const player_stats = {
        strength: stats[1].value,
        dexterity: stats[4].value,
      }

      // Get weaponDamage from the inHand Weapon.
      const slot_number = 2 + 36 // For the player 0 is the first item in hotbar. But for the game the hotbat begin at 36.
      const item = inventory[slot_number]
      const weapon = { damage: 0, critical: 0 }
      if (item) {
        const { type } = item
        const itemData = world.items[type]
        if (itemData.type === 'weapon') {
          const [minDamage, maxDamage] = itemData.damage
          weapon.damage = minDamage + Math.random() * (maxDamage - minDamage)
          if (itemData.critical) {
            weapon.critical += itemData.critical * 100 * 4
          }
        }
      }

      const armor_stats = { strength: 0, dexterity: 0 }

      // Get the strength statistics of all equipped armor.
      for (const armor_slot of [5, 6, 7, 8]) {
        const item = inventory[armor_slot]
        if (inventory[armor_slot]) {
          const { type } = item
          const itemData = world.items[type]
          if (itemData.stats.strength) {
            armor_stats.strength += itemData.stats.strength
          }
        }
      }
      player_stats.strength = Math.max(0, player_stats.strength)

      const strength = player_stats.strength + armor_stats.strength
      const dexterity =
        player_stats.dexterity + armor_stats.dexterity + weapon.critical

      // Check if Critical Damage.
      const rand = Math.random() * 100
      const critc = Math.min(50, 1 + dexterity / 4)
      let is_critical = false
      if (rand < critc) {
        is_critical = true
      }
      const damage_multiplier = is_critical ? 1.6 : 1.0
      const damage = Math.floor(
        (1 + weapon.damage + strength * 0.5) * damage_multiplier
      )

      const mob = world.mobs.by_entity_id(target)
      if (mob) {
        mob.dispatch('deal_damage', {
          damage,
        })
      }
    }
  })

  for (const mob of world.mobs.all) {
    aiter(on(mob.events, 'state')).reduce((last_health, [{ health }]) => {
      if (last_health !== health) {
        client.write('entity_status', {
          entityId: mob.entity_id,
          entityStatus: health > 0 ? 2 : 3, // Hurt Animation and Hurt Sound (sound not working)
        })
      }
      return health
    }, null)
  }
}
