// Continuous all-pose bounds from the approved scene graph and locked meshes.
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ROOT = path.resolve(__dirname, '..')

function corners(b) {
  const result = []
  for (const x of [b[0], b[3]]) for (const y of [b[1], b[4]]) for (const z of [b[2], b[5]]) result.push([x, y, z])
  return result
}
function hull(points) {
  assert.ok(points.length)
  return [0, 1, 2].map(i => Math.min(...points.map(p => p[i])))
    .concat([0, 1, 2].map(i => Math.max(...points.map(p => p[i]))))
}
function point(m, p) { return [0, 1, 2].map(i => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i]) }
function transform(b, m) { return hull(corners(b).map(p => point(m, p))) }
function move(b, lo, hi = lo) { return b.map((v, i) => v + (i < 3 ? lo[i] : hi[i - 3])) }
function union(boxes) { return hull(boxes.flatMap(corners)) }
function rotateHull(b, axis, pivot = [0, 0, 0]) {
  const dims = axis === 'x' ? [1, 2] : [0, 2]
  assert.ok(axis === 'x' || axis === 'y')
  const radius = Math.max(...corners(b).map(p => Math.hypot(p[dims[0]] - pivot[dims[0]], p[dims[1]] - pivot[dims[1]])))
  const result = b.slice()
  for (const i of dims) { result[i] = pivot[i] - radius; result[i + 3] = pivot[i] + radius }
  return result
}
function meshes(kind) {
  const folder = path.join(ROOT, 'resources/assets/dcp_scripted_' + kind + '/models/block')
  return Object.fromEntries(fs.readdirSync(folder).filter(name => name.endsWith('.obj') && name !== 'item_assembled.obj').map(name => {
    const vertices = fs.readFileSync(path.join(folder, name), 'utf8').split('\n').filter(line => line.startsWith('v '))
      .map(line => line.trim().split(/\s+/).slice(1).map(Number))
    assert.ok(vertices.length && vertices.flat().every(Number.isFinite))
    return [name.slice(0, -4), hull(vertices)]
  }))
}
function poseFunctions() {
  const context = vm.createContext({ Math })
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'work/scripted-rail/pose-v17.js'), 'utf8'), context)
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'work/scripted-receiver/receiver_pose.js'), 'utf8'), context)
  return context
}
function generate() {
  const functions = poseFunctions(), rail = meshes('rail'), receiver = meshes('receiver')
  const boxes = { rail: [], receiver: [] }, covered = { rail: new Set(), receiver: new Set() }
  const yaw = b => rotateHull(b, 'y', [.5, 0, .5])
  const fixed = new Set(['fixed_base', 'modern_base_transformers', 'modern_slew_fixed_windowed', 'power_fixed_v10'])
  const yawed = new Set(['modern_slew_rotor_plain', 'power_yaw_v10', 'modern_loading_station', 'modern_loading_carriage', 'modern_staged_package'])
  const gun = new Set(['modern_cradle', 'modern_rear_hood', 'modern_rear_radiators', 'modern_tail_hatch', 'modern_launcher',
    'electromagnetic_modules', 'inner_winding_rims', 'power_breech_boots_v10'])
  const scene = functions.dcpRailV17Pose(0, 0)
  assert.equal(scene.parts.length, 30)
  for (const part of scene.parts) {
    const name = part.ref, b = rail[name]
    assert.ok(b, name)
    let result
    if (fixed.has(name)) result = transform(b, scene.worldAdapter)
    else if (yawed.has(name)) result = yaw(b)
    else if (name === 'modern_mount') result = move(yaw(b), [0, 36 / 16, 0])
    else if (gun.has(name)) result = yaw(move(rotateHull(b, 'x', [.5, .5, 0]), [0, 52 / 16, .5]))
    else if (name === 'modern_pitch_lugs') result = move(yaw(rotateHull(b, 'x', [.5, 1.5, .5])), [0, 36 / 16, 0])
    else if (name === 'modern_rammer_rod') {
      const scaled = b.map((value, i) => i % 3 === 2 ? value * 2 : value)
      result = yaw(move(scaled, [.5, 60 / 16, -35 / 16]))
    } else if (name === 'power_pitch_leg12_v10' || name === 'power_pitch_elbow_v10') {
      // A=(x,46,-8), B_y in [52,68], B_z in [0,16], all in pixels.
      // dy>=6,dz>=8 => d>=10. h<=12, |dy/d|,|dz/d|<=1:
      // C_y in [37,69], C_z in [-16,16]. No angular sampling is used.
      const cLo = [-2 / 16, 37 / 16, -1], cHi = [18 / 16, 69 / 16, 1]
      if (name === 'power_pitch_elbow_v10') result = yaw(move(b, cLo, cHi))
      else result = yaw(union([
        move(rotateHull(b, 'x'), [-2 / 16, 46 / 16, -8 / 16], [18 / 16, 46 / 16, -8 / 16]),
        move(rotateHull(b, 'x'), cLo, cHi)
      ]))
    } else if (name === 'modern_ram_barrel' || name === 'modern_ram_rod') {
      // Q_y=24-6cos+12sin in [6,42], Q_z=8+6sin+12cos in [-10,26].
      // Q_y-B_y>=2 guarantees a finite hydraulic direction at every angle.
      const lo = [-9 / 16, name === 'modern_ram_barrel' ? 4 / 16 : 6 / 16, name === 'modern_ram_barrel' ? 0 : -10 / 16]
      const hi = [25 / 16, name === 'modern_ram_barrel' ? 4 / 16 : 42 / 16, name === 'modern_ram_barrel' ? 0 : 26 / 16]
      result = move(yaw(move(rotateHull(b, 'x'), lo, hi)), [0, 36 / 16, 0])
    } else throw new Error('Unclassified rail part ' + name)
    boxes.rail.push(result); covered.rail.add(name)
  }
  const receiverScene = functions.DCP_RECEIVER_V6_POSE.scene(0, 0)
  const receiverFixed = new Set(['base_frame', 'deck', 'controller_output_socket', 'deck_wire_north', 'connector_small_passive',
    'metal_bearing_plate', 'bearing_spacer', 'bearing_fixed', 'bearing_rotor', 'transformer_bridge_supports',
    'transformer_left', 'transformer_right', 'transformer_coil1', 'transformer_coil2', 'transformer_saddles',
    'upper_fork', 'central_energy_hose', 'hydraulic_fixed_mounts', 'hydraulic_base_pin'])
  assert.equal(receiverScene.length, 47)
  for (const part of receiverScene) {
    const name = part.part, b = receiver[name]
    assert.ok(b, name)
    let result
    if (name === 'upper_head') result = move(rotateHull(b, 'x', [.5, .5, .5]), [0, 75 / 16, 0])
    else if (name === 'hydraulic_cranks') result = move(rotateHull(b, 'x', [.5, 24 / 16, .5]), [0, 59 / 16, 0])
    else if (['hydraulic_barrel_skin', 'hydraulic_rod_skin', 'hydraulic_eye_base', 'hydraulic_eye_rod'].includes(name)) {
      // Q_y in [16,32], Q_z in [0,16], d_y>=5, |u_y|,|u_z|<=1 pixel.
      const origins = {
        hydraulic_barrel_skin: [[-13 / 16, 10 / 16, 7 / 16], [29 / 16, 12 / 16, 9 / 16]],
        hydraulic_rod_skin: [[-13 / 16, 15 / 16, -1 / 16], [29 / 16, 33 / 16, 17 / 16]],
        hydraulic_eye_base: [[-13 / 16, 11 / 16, 8 / 16], [29 / 16, 11 / 16, 8 / 16]],
        hydraulic_eye_rod: [[-13 / 16, 16 / 16, 0], [29 / 16, 32 / 16, 16 / 16]]
      }[name]
      result = move(move(rotateHull(b, 'x'), origins[0], origins[1]), [0, 59 / 16, 0])
    } else if (receiverFixed.has(name)) result = transform(b, part.matrix)
    else throw new Error('Unclassified receiver part ' + name)
    boxes.receiver.push(result); covered.receiver.add(name)
  }
  for (const kind of ['rail', 'receiver']) {
    const expected = Object.keys(kind === 'rail' ? rail : receiver).filter(name => name !== 'em_railejector_projectile').sort()
    assert.deepEqual([...covered[kind]].sort(), expected, kind + ' part coverage')
  }
  const envelopes = {}
  for (const kind of ['rail', 'receiver']) {
    const b = union(boxes[kind])
    // Outward 1/16-block rounding plus 1/64-block render-float margin.
    envelopes[kind] = b.map((value, i) => (i < 3 ? Math.floor(value * 16) / 16 - 1 / 64 : Math.ceil(value * 16) / 16 + 1 / 64))
    assert.ok(envelopes[kind].every(Number.isFinite))
  }
  return { envelopes, functions, models: { rail, receiver } }
}
if (require.main === module) {
  const { envelopes } = generate()
  const target = path.join(ROOT, 'src/compat/resources/approved-bounds.json')
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, JSON.stringify(envelopes, null, 2) + '\n')
  console.log(JSON.stringify(envelopes))
}
module.exports = { generate, corners, hull, point, transform, rotateHull, move }
