const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { generate, corners, point, rotateHull } = require('../tools/generate_compat_bounds.cjs')
const { envelopes, functions, models } = generate()
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(__dirname, '../src/compat/resources/approved-bounds.json'))), envelopes)
// Analytic circle-extremum contract, independent of an angular sample grid.
assert.deepEqual(rotateHull([0, 3, 4, 0, 3, 4], 'x'), [0, -5, -5, 0, 5, 5])
assert.deepEqual(rotateHull([3, 0, 4, 3, 0, 4], 'y'), [-5, 0, -5, 5, 0, 5])
let vertices = 0, poses = 0
function check(kind, parts, worldAdapter) {
  const envelope = envelopes[kind]
  for (const part of parts) {
    for (const corner of corners(models[kind][part.ref || part.part])) {
      let p = point(part.m || part.matrix, corner)
      if (worldAdapter) p = point(worldAdapter, p)
      for (let i = 0; i < 3; i++) assert.ok(Number.isFinite(p[i]) && p[i] >= envelope[i] && p[i] <= envelope[i + 3],
        kind + '/' + (part.ref || part.part) + ': ' + p + ' outside ' + envelope)
      vertices++
    }
  }
  poses++
}
// Fractional/end-point rotations audit the scene-graph port, not the proof of
// continuous coverage, which is supplied by the analytic hull construction.
for (let yaw = 0; yaw <= 360; yaw += 7.5) {
  for (let elevation = -180; elevation <= 180; elevation += 3.75) {
    const pose = functions.dcpRailV17Pose(yaw, elevation)
    check('rail', pose.parts, pose.worldAdapter)
  }
}
for (let pitch = 0; pitch <= 70; pitch += .125) check('receiver', functions.DCP_RECEIVER_V6_POSE.scene(pitch, 0))
for (const native of [-720, -360, -180, -90, -.001, 0, .001, 90, 180, 360, 720])
  check('receiver', functions.DCP_RECEIVER_V6_POSE.fromNative(native, 'linear_70'))
console.log(JSON.stringify({ status: 'PASS', envelopes, poses, transformedCorners: vertices }))
