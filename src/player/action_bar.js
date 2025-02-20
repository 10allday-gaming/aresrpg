import { on } from 'events'
import { setInterval } from 'timers/promises'

import { aiter } from 'iterator-helper'

import { Formats } from '../chat.js'
import { Context } from '../events.js'
import { abortable } from '../iterator.js'
import {
  get_max_health,
  get_remaining_stats_point,
} from '../player_statistics.js'
import { write_action_bar } from '../title.js'

function to_rgb(percent) {
  if (percent < 50)
    return { red: 255, green: Math.round(5.1 * percent), blue: 0 }
  return { red: Math.round(510 - 5.1 * percent), green: 255, blue: 0 }
}

function to_hex({ red, green, blue }) {
  const hue = red * 0x10000 + green * 0x100 + blue * 0x1
  return `#${hue.toString(16).padStart(6, '0')}`
}

function compute_health_component(health, max_health) {
  const percent = (100 * health) / max_health
  const color = to_hex(to_rgb(percent))
  return { text: health, color, bold: true }
}

function compute_stats_component(points) {
  if (points)
    return [
      { text: ' | +', ...Formats.BASE, italic: false, bold: true },
      { text: points, ...Formats.WARN },
      { text: ' stats point', ...Formats.BASE, italic: false, bold: true },
    ]
  return []
}

function update_action_bar({
  client,
  health,
  max_health,
  remaining_stats_point,
}) {
  write_action_bar({
    client,
    text: [
      { text: '>> Life ', ...Formats.BASE, italic: false, bold: true },
      compute_health_component(health, max_health),
      { text: '/', ...Formats.BASE, italic: false, bold: true },
      { text: max_health, ...Formats.SUCCESS },
      { text: ' | Zone: ', ...Formats.BASE, italic: false, bold: true },
      { text: 'Thebes (F1)', ...Formats.INFO },
      ...compute_stats_component(remaining_stats_point),
      { text: ' <<', ...Formats.BASE, italic: false, bold: true },
    ],
  })
}

export default {
  /** @type {import('../context.js').Observer} */
  observe({ client, get_state, world, events, signal }) {
    aiter(abortable(setInterval(2000, { signal }))).forEach(() => {
      const state = get_state()
      update_action_bar({
        client,
        health: state.health,
        max_health: get_max_health(state),
        remaining_stats_point: get_remaining_stats_point(state),
      })
    })

    aiter(abortable(on(events, Context.STATE, { signal }))).reduce(
      (
        { last_health, last_max_health, last_remaining_stats_point },
        [state]
      ) => {
        const { health } = state
        const max_health = get_max_health(state)
        const remaining_stats_point = get_remaining_stats_point(state)

        const health_changed = last_health !== health
        const max_health_changed = last_max_health !== max_health
        const stats_points_changed =
          last_remaining_stats_point !== remaining_stats_point

        if (health_changed || max_health_changed || stats_points_changed)
          update_action_bar({
            client,
            health,
            max_health,
            remaining_stats_point,
          })
        return {
          last_health: health,
          last_max_health: max_health,
          last_remaining_stats_point: remaining_stats_point,
        }
      },
      {
        // thanks ts-lint to make the code more verbose
        last_health: undefined,
        last_max_health: undefined,
        last_remaining_stats_point: undefined,
      }
    )
  },
}
