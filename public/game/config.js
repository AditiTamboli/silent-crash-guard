// Centralized tuning for TRAFFIC RUSH.
export const CONFIG = {
  lanes: 5,
  roadWidthRatio: 0.68,
  maxRoadWidth: 700,
  minRoadWidth: 360,
  playerYRatio: 0.78,

  // Speed is expressed in km/h; pixels move at speed * pxPerKmh.
  pxPerKmh: 2.3,
  speedMin: 45,
  speedIdle: 95,
  speedMax: 275,
  accel: 62, // km/h per second while accelerating
  brake: 130, // km/h per second while braking
  coastDrag: 26, // km/h per second drifting back to idle

  // Steering (lane units per second)
  steerAccel: 58,
  steerDamp: 0.8,
  steerMaxVel: 7,

  nearMissLaneDist: 0.92,
  nearMissPoints: 100,
  comboTimeout: 3.2,

  spawnBaseInterval: 1.15,
  spawnMinInterval: 0.42,
  difficultyRamp: 145, // seconds to approach max difficulty

  // Pickups, nitro and coin cannon
  coinSpawnInterval: 4.2,
  coinValue: 1,
  nitroSpawnInterval: 22,
  nitroDuration: 5,
  nitroSpeedBonus: 70, // km/h added to the top speed while boosting
  nitroAccel: 190,
  bulletCost: 20,
  bulletSpeed: 1500,
  bulletKillPoints: 150,

  eventMinDelay: 16,
  eventMaxDelay: 28,
  weatherDuration: 42,
  rainBrakeMul: 0.85, // rain cuts braking force by exactly 15%

  vehicles: {
    car: { w: 0.6, h: 92, minSpeed: 85, maxSpeed: 125, weight: 44, lush: false },
    aggressive: { w: 0.58, h: 88, minSpeed: 145, maxSpeed: 195, weight: 14 },
    truck: { w: 0.82, h: 178, minSpeed: 62, maxSpeed: 82, weight: 16 },
    bus: { w: 0.78, h: 152, minSpeed: 66, maxSpeed: 86, weight: 12 },
    moto: { w: 0.3, h: 58, minSpeed: 135, maxSpeed: 185, weight: 14 },
    police: { w: 0.6, h: 96, minSpeed: 160, maxSpeed: 205, weight: 0 },
  },

  palettes: {
    car: ["#e34d4d", "#4d8fe3", "#f0c04a", "#57c98a", "#c96fd6", "#e8e8ee"],
    aggressive: ["#ff5a2b", "#ff2f6d", "#ffd23f"],
    truck: ["#5c6b8a", "#8a6b4f", "#4f7d6a"],
    bus: ["#f2a33c", "#3c8ef2", "#d9d4c6"],
    moto: ["#20232b", "#c4362f", "#2f7fc4"],
    police: ["#ffffff"],
  },
};

export const STORAGE_KEYS = {
  best: "trafficrush.best",
  settings: "trafficrush.settings",
  ghost: "trafficrush.ghost",
};
