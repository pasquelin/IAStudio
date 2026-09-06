/**
 * The scripts a scene template lays down beside itself, named once for the three places that
 * have to agree: the component a template writes, the file the seeding creates, and the source
 * each one opens on.
 */
export type TemplateScriptId = 'player' | 'car' | 'plane'

export const TEMPLATE_SCRIPT_IDS: readonly TemplateScriptId[] = ['player', 'car', 'plane']

/**
 * What each one opens on. Named ACTIONS, never a key code: the same body then answers a keyboard
 * and a gamepad alike, and rebinding one is a line of the control map rather than of this file.
 *
 * 🛑 Empty of gameplay on purpose — walking, driving and flying are the runtime's, and a template
 * that reimplemented them would teach a beginner to fight the controller it ships with.
 */
export const TEMPLATE_SCRIPT_SOURCES: Record<TemplateScriptId, string> = {
  player: `import { defineScript } from '@studio'

export default defineScript({
  onUpdate(self, ctx, dt) {
    // The runtime already walks, runs and jumps this body off the \`character\` context.
    // What goes here is what the game does ON TOP of that.
    const walking = ctx.input.axis2('move')
    if (ctx.input.button('interact')) {
      // Whatever standing in front of something means in your game.
    }
  },
})
`,

  car: `import { defineScript } from '@studio'

export default defineScript({
  onUpdate(self, ctx, dt) {
    // The runtime drives, brakes and steers this body off the \`vehicle\` context.
    const throttle = ctx.input.axis('accelerate') - ctx.input.axis('brake')
    if (ctx.input.button('exit')) {
      // Getting out is yours to write: the runtime holds the pedals, not the doors.
    }
  },
})
`,

  plane: `import { defineScript } from '@studio'

export default defineScript({
  onUpdate(self, ctx, dt) {
    // The runtime flies this body off the \`flight\` context — stick, rudder and throttle.
    const throttle = ctx.input.axis('throttle')
  },
})
`,
}
