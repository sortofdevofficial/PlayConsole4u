// levels.js — 10 levels, progressive obstacles, lighter backgrounds
const MAX_LEVELS = 10;

// Obstacle introduction schedule:
// L1  → platforms only (ice + conveyor) — basics
// L2  → + bounce pads
// L3  → + moving platforms
// L4  → + hazard spikes (static)
// L5  → + wind fans
// L6  → + lasers (timed)
// L7  → + falling platforms
// L8  → + saws
// L9  → + trap doors
// L10 → everything, max intensity

const LEVELS = {
  1: {
    w:1200, h:500,
    bgA:'#fdf8f0', bgB:'#f5ede0',
    accent:'#f97316',
    spawn:{x:50,y:380},
    platforms:[
      {x:0,    y:430, w:220, h:50, c:'#ffe8d0'},
      {x:280,  y:370, w:120, h:18, c:'#ffd4b0'},
      {x:460,  y:305, w:120, h:18, c:'#ffbe90', surface:'ice'},
      {x:650,  y:245, w:120, h:18, c:'#ffaa70'},
      {x:850,  y:430, w:180, h:50, c:'#ffe8d0', surface:'conveyorR'},
    ],
    hazards:[], bouncePads:[], windFans:[], lasers:[], spikes:[], saws:[], trapDoors:[], fallingPlatforms:[],
    goal:{x:1155,y:385,w:28,h:46}
  },

  2: {
    w:1500, h:520,
    bgA:'#f0fdf4', bgB:'#dcfce7',
    accent:'#22c55e',
    spawn:{x:50,y:420},
    platforms:[
      {x:0,    y:460, w:180, h:60, c:'#bbf7d0'},
      {x:240,  y:360, w:100, h:18, c:'#86efac'},
      {x:400,  y:290, w:100, h:18, c:'#4ade80'},
      {x:570,  y:380, w:100, h:18, c:'#86efac'},
      {x:740,  y:460, w:160, h:60, c:'#bbf7d0'},
      {x:960,  y:300, w:100, h:18, c:'#4ade80'},
      {x:1170, y:460, w:220, h:60, c:'#bbf7d0'},
    ],
    hazards:[],
    bouncePads:[
      {x:490, y:362, w:52, h:12, force:15},
    ],
    windFans:[], lasers:[], spikes:[], saws:[], trapDoors:[], fallingPlatforms:[],
    goal:{x:1455,y:410,w:28,h:46}
  },

  3: {
    w:1700, h:550,
    bgA:'#fff1f2', bgB:'#ffe4e6',
    accent:'#f43f5e',
    spawn:{x:50,y:460},
    platforms:[
      {x:0,    y:490, w:150, h:60, c:'#fecdd3'},
      {x:210,  y:400, w:90,  h:18, c:'#fda4af', moving:{axis:'x',range:100,speed:1.8}},
      {x:400,  y:490, w:120, h:60, c:'#fecdd3'},
      {x:570,  y:330, w:90,  h:18, c:'#fda4af'},
      {x:740,  y:255, w:90,  h:18, c:'#fb7185', surface:'conveyorR'},
      {x:920,  y:490, w:150, h:60, c:'#fecdd3'},
      {x:1130, y:360, w:90,  h:18, c:'#fda4af', moving:{axis:'y',range:80,speed:2.0}},
      {x:1310, y:280, w:90,  h:18, c:'#fb7185'},
      {x:1490, y:490, w:170, h:60, c:'#fecdd3'},
    ],
    hazards:[],
    bouncePads:[
      {x:1210, y:462, w:52, h:12, force:16},
    ],
    windFans:[], lasers:[], spikes:[], saws:[], trapDoors:[],
    fallingPlatforms:[],
    goal:{x:1650,y:432,w:28,h:56}
  },

  4: {
    w:1900, h:600,
    bgA:'#f0f9ff', bgB:'#e0f2fe',
    accent:'#06b6d4',
    spawn:{x:50,y:510},
    platforms:[
      {x:0,    y:550, w:160, h:50, c:'#bae6fd'},
      {x:220,  y:470, w:70,  h:18, c:'#7dd3fc', surface:'ice'},
      {x:360,  y:390, w:70,  h:18, c:'#38bdf8', moving:{axis:'x',range:90,speed:2.1}},
      {x:520,  y:310, w:70,  h:18, c:'#0ea5e9'},
      {x:700,  y:550, w:150, h:50, c:'#bae6fd'},
      {x:920,  y:400, w:100, h:18, c:'#38bdf8'},
      {x:1110, y:280, w:100, h:18, c:'#7dd3fc'},
      {x:1300, y:550, w:170, h:50, c:'#bae6fd'},
      {x:1540, y:430, w:80,  h:18, c:'#38bdf8'},
      {x:1700, y:330, w:80,  h:18, c:'#0ea5e9'},
      {x:1820, y:550, w:80,  h:50, c:'#bae6fd'},
    ],
    // First spikes introduced here — static, just a few
    hazards:[
      {x:155,  y:578, w:64,  h:12},
      {x:855,  y:578, w:48,  h:12},
    ],
    bouncePads:[{x:600,y:535,w:52,h:12,force:18}],
    windFans:[], lasers:[], spikes:[], saws:[], trapDoors:[],
    fallingPlatforms:[],
    goal:{x:1868,y:500,w:28,h:46}
  },

  5: {
    w:2100, h:650,
    bgA:'#faf5ff', bgB:'#f3e8ff',
    accent:'#a855f7',
    spawn:{x:50,y:580},
    platforms:[
      {x:0,    y:620, w:145, h:30, c:'#e9d5ff'},
      {x:200,  y:550, w:58,  h:18, c:'#d8b4fe', surface:'conveyorL'},
      {x:360,  y:470, w:58,  h:18, c:'#c084fc', moving:{axis:'x',range:80,speed:2.4}},
      {x:520,  y:390, w:58,  h:18, c:'#a855f7', surface:'ice'},
      {x:690,  y:620, w:145, h:30, c:'#e9d5ff'},
      {x:900,  y:470, w:80,  h:18, c:'#c084fc'},
      {x:1080, y:340, w:80,  h:18, c:'#a855f7', moving:{axis:'y',range:90,speed:2.6}},
      {x:1250, y:620, w:155, h:30, c:'#e9d5ff'},
      {x:1470, y:470, w:80,  h:18, c:'#c084fc'},
      {x:1640, y:370, w:80,  h:18, c:'#a855f7'},
      {x:1820, y:620, w:280, h:30, c:'#e9d5ff'},
    ],
    hazards:[
      {x:145, y:648, w:55,  h:12},
      {x:838, y:648, w:62,  h:12},
    ],
    bouncePads:[{x:980,y:448,w:52,h:12,force:19}],
    // Wind fans introduced here
    windFans:[
      {x:1160,y:290,w:26,h:40,dir:'right',force:0.55},
    ],
    lasers:[], spikes:[], saws:[], trapDoors:[],
    fallingPlatforms:[],
    goal:{x:2068,y:562,w:28,h:48}
  },

  6: {
    w:2300, h:650,
    bgA:'#fefce8', bgB:'#fef9c3',
    accent:'#eab308',
    spawn:{x:50,y:580},
    platforms:[
      {x:0,    y:620, w:135, h:30, c:'#fef08a'},
      {x:180,  y:540, w:54,  h:18, c:'#fde047', moving:{axis:'x',range:75,speed:2.8}},
      {x:330,  y:450, w:54,  h:18, c:'#facc15', surface:'mud'},
      {x:480,  y:620, w:150, h:30, c:'#fef08a', surface:'ice'},
      {x:650,  y:470, w:64,  h:18, c:'#eab308', moving:{axis:'y',range:80,speed:2.7}},
      {x:820,  y:360, w:64,  h:18, c:'#ca8a04'},
      {x:980,  y:250, w:64,  h:18, c:'#a16207', surface:'conveyorR'},
      {x:1140, y:620, w:150, h:30, c:'#fef08a'},
      {x:1320, y:470, w:64,  h:18, c:'#eab308', moving:{axis:'x',range:90,speed:2.8}},
      {x:1480, y:340, w:64,  h:18, c:'#ca8a04'},
      {x:1640, y:620, w:500, h:30, c:'#fef08a'},
      {x:1840, y:450, w:64,  h:18, c:'#a16207'},
      {x:2000, y:320, w:64,  h:18, c:'#eab308', moving:{axis:'y',range:72,speed:3.0}},
      {x:2180, y:620, w:120, h:30, c:'#fef08a'},
    ],
    hazards:[
      {x:135, y:648, w:45,h:12},
      {x:622, y:648, w:52,h:12},
    ],
    bouncePads:[{x:1060,y:605,w:52,h:12,force:20}],
    windFans:[
      {x:900, y:200,w:26,h:40,dir:'up',force:0.6},
      {x:1500,y:300,w:26,h:40,dir:'up',force:0.65},
    ],
    // Lasers introduced here
    lasers:[
      {x:240,y:500,w:220,h:6,cycle:120,phase:10},
    ],
    spikes:[], saws:[], trapDoors:[],
    fallingPlatforms:[],
    goal:{x:2268,y:562,w:28,h:48}
  },

  7: {
    w:2500, h:750,
    bgA:'#f0f9ff', bgB:'#e0f2fe',
    accent:'#38bdf8',
    spawn:{x:50,y:685},
    platforms:[
      {x:0,    y:720, w:145, h:30, c:'#bae6fd'},
      {x:200,  y:640, w:54,  h:18, c:'#7dd3fc', moving:{axis:'x',range:90,speed:3.0}},
      {x:360,  y:555, w:54,  h:18, c:'#38bdf8', surface:'ice'},
      {x:520,  y:470, w:54,  h:18, c:'#0ea5e9', moving:{axis:'y',range:90,speed:2.9}},
      {x:680,  y:380, w:54,  h:18, c:'#0284c7', surface:'mud'},
      {x:840,  y:720, w:130, h:30, c:'#bae6fd', surface:'conveyorR'},
      {x:1010, y:540, w:78,  h:18, c:'#38bdf8'},
      {x:1180, y:390, w:78,  h:18, c:'#0ea5e9', moving:{axis:'x',range:120,speed:3.2}},
      {x:1370, y:720, w:120, h:30, c:'#bae6fd'},
      {x:1540, y:560, w:64,  h:18, c:'#38bdf8', moving:{axis:'y',range:110,speed:3.0}},
      {x:1700, y:420, w:64,  h:18, c:'#0ea5e9'},
      {x:1860, y:720, w:170, h:30, c:'#bae6fd'},
      {x:2060, y:500, w:78,  h:18, c:'#38bdf8'},
      {x:2220, y:720, w:180, h:30, c:'#bae6fd'},
    ],
    hazards:[
      {x:145,y:748,w:60,h:12},
      {x:935,y:748,w:80,h:12},
    ],
    bouncePads:[{x:760,y:705,w:52,h:12,force:21}],
    windFans:[
      {x:1320,y:340,w:26,h:40,dir:'up',force:0.75},
    ],
    lasers:[
      {x:1040,y:450,w:220,h:6,cycle:110,phase:55},
      {x:1560,y:620,w:160,h:6,cycle:120,phase:20},
    ],
    spikes:[
      {x:1500,y:698,w:44,h:12,cycle:90,phase:10},
    ],
    saws:[],
    trapDoors:[],
    // Falling platforms introduced here
    fallingPlatforms:[
      {x:600,y:300,w:68,h:16,c:'#0ea5e9',delay:45,fallSpeed:3.5},
    ],
    goal:{x:2468,y:668,w:28,h:48}
  },

  8: {
    w:2700, h:750,
    bgA:'#fff7ed', bgB:'#ffedd5',
    accent:'#f97316',
    spawn:{x:50,y:685},
    platforms:[
      {x:0,    y:720, w:128, h:30, c:'#fed7aa'},
      {x:170,  y:650, w:44,  h:18, c:'#fdba74', moving:{axis:'x',range:70,speed:3.2}},
      {x:300,  y:580, w:44,  h:18, c:'#fb923c', surface:'mud'},
      {x:420,  y:510, w:44,  h:18, c:'#f97316', moving:{axis:'x',range:70,speed:3.4}},
      {x:540,  y:440, w:44,  h:18, c:'#ea580c', surface:'ice'},
      {x:660,  y:370, w:44,  h:18, c:'#c2410c', moving:{axis:'y',range:80,speed:3.0}},
      {x:820,  y:720, w:120, h:30, c:'#fed7aa'},
      {x:980,  y:540, w:54,  h:18, c:'#fdba74'},
      {x:1120, y:410, w:54,  h:18, c:'#fb923c', moving:{axis:'x',range:120,speed:3.3}},
      {x:1280, y:290, w:54,  h:18, c:'#f97316'},
      {x:1440, y:720, w:170, h:30, c:'#fed7aa'},
      {x:1620, y:530, w:54,  h:18, c:'#fdba74', moving:{axis:'y',range:110,speed:3.1}},
      {x:1760, y:380, w:54,  h:18, c:'#fb923c'},
      {x:1910, y:720, w:170, h:30, c:'#fed7aa'},
      {x:2060, y:500, w:54,  h:18, c:'#fdba74'},
      {x:2200, y:360, w:54,  h:18, c:'#f97316', moving:{axis:'x',range:90,speed:3.4}},
      {x:2360, y:720, w:260, h:30, c:'#fed7aa'},
    ],
    hazards:[
      {x:128,y:748,w:47,h:12},
      {x:902,y:748,w:80,h:12},
    ],
    bouncePads:[{x:760,y:705,w:52,h:12,force:22}],
    windFans:[
      {x:1380,y:260,w:26,h:40,dir:'right',force:0.8},
    ],
    lasers:[
      {x:1740,y:620,w:220,h:6,cycle:100,phase:20},
    ],
    spikes:[
      {x:2100,y:698,w:46,h:12,cycle:80,phase:40},
    ],
    // Saws introduced here
    saws:[
      {x:1880,y:640,r:15,axis:'y',range:80,speed:3.2,phase:0},
    ],
    trapDoors:[],
    fallingPlatforms:[
      {x:390,y:460,w:64,h:16,c:'#f97316',delay:32,fallSpeed:3.8},
    ],
    goal:{x:2668,y:668,w:28,h:48}
  },

  9: {
    w:2900, h:800,
    bgA:'#f0fdf4', bgB:'#dcfce7',
    accent:'#84cc16',
    spawn:{x:50,y:735},
    platforms:[
      {x:0,    y:770, w:128, h:30, c:'#bbf7d0'},
      {x:170,  y:700, w:48,  h:18, c:'#86efac', moving:{axis:'x',range:80,speed:3.5}},
      {x:310,  y:625, w:48,  h:18, c:'#4ade80', surface:'ice'},
      {x:450,  y:545, w:48,  h:18, c:'#22c55e', moving:{axis:'y',range:70,speed:3.4}},
      {x:590,  y:465, w:48,  h:18, c:'#16a34a', surface:'mud'},
      {x:730,  y:385, w:48,  h:18, c:'#15803d', moving:{axis:'x',range:100,speed:3.3}},
      {x:890,  y:770, w:118, h:30, c:'#bbf7d0'},
      {x:1080, y:575, w:64,  h:18, c:'#4ade80'},
      {x:1220, y:440, w:64,  h:18, c:'#22c55e', moving:{axis:'y',range:100,speed:3.5}},
      {x:1380, y:770, w:118, h:30, c:'#bbf7d0'},
      {x:1540, y:545, w:54,  h:18, c:'#86efac', moving:{axis:'x',range:120,speed:3.8}},
      {x:1690, y:410, w:54,  h:18, c:'#4ade80'},
      {x:1850, y:770, w:170, h:30, c:'#bbf7d0'},
      {x:2040, y:550, w:58,  h:18, c:'#22c55e'},
      {x:2190, y:410, w:58,  h:18, c:'#16a34a', moving:{axis:'y',range:90,speed:3.1}},
      {x:2350, y:770, w:260, h:30, c:'#bbf7d0'},
      {x:2630, y:640, w:60,  h:18, c:'#4ade80'},
    ],
    hazards:[
      {x:128,y:798,w:47,h:12},
      {x:1040,y:798,w:80,h:12},
    ],
    bouncePads:[{x:810,y:755,w:52,h:12,force:23}],
    windFans:[
      {x:1460,y:360,w:26,h:40,dir:'up',force:0.85},
      {x:2000,y:300,w:26,h:40,dir:'right',force:0.75},
    ],
    lasers:[
      {x:1760,y:680,w:220,h:6,cycle:90,phase:10},
    ],
    spikes:[
      {x:2280,y:748,w:44,h:12,cycle:75,phase:20},
    ],
    saws:[
      {x:2440,y:700,r:15,axis:'x',range:130,speed:3.6,phase:0},
    ],
    // Trap doors introduced here
    trapDoors:[
      {x:1130,y:575,w:60,h:12,delay:22},
    ],
    fallingPlatforms:[
      {x:520,y:370,w:60,h:16,c:'#22c55e',delay:26,fallSpeed:4.0},
    ],
    goal:{x:2868,y:718,w:28,h:48}
  },

  10: {
    w:3300, h:800,
    bgA:'#f5f3ff', bgB:'#ede9fe',
    accent:'#818cf8',
    spawn:{x:50,y:735},
    platforms:[
      {x:0,    y:770, w:118, h:30, c:'#ddd6fe'},
      {x:155,  y:715, w:40,  h:18, c:'#c4b5fd', moving:{axis:'x',range:55,speed:4.0}},
      {x:275,  y:655, w:40,  h:18, c:'#a78bfa', surface:'ice'},
      {x:395,  y:595, w:40,  h:18, c:'#8b5cf6', moving:{axis:'y',range:60,speed:3.8}},
      {x:515,  y:530, w:40,  h:18, c:'#7c3aed', surface:'mud'},
      {x:635,  y:460, w:40,  h:18, c:'#6d28d9', moving:{axis:'x',range:70,speed:3.7}},
      {x:790,  y:770, w:108, h:30, c:'#ddd6fe'},
      {x:930,  y:575, w:50,  h:18, c:'#a78bfa', moving:{axis:'y',range:90,speed:4.0}},
      {x:1080, y:430, w:50,  h:18, c:'#8b5cf6'},
      {x:1220, y:300, w:50,  h:18, c:'#7c3aed', moving:{axis:'x',range:90,speed:3.6}},
      {x:1380, y:770, w:108, h:30, c:'#ddd6fe'},
      {x:1520, y:580, w:40,  h:18, c:'#a78bfa', moving:{axis:'x',range:70,speed:4.0}},
      {x:1640, y:460, w:40,  h:18, c:'#8b5cf6'},
      {x:1760, y:340, w:40,  h:18, c:'#7c3aed', moving:{axis:'y',range:80,speed:3.8}},
      {x:1900, y:770, w:108, h:30, c:'#ddd6fe'},
      {x:2040, y:560, w:50,  h:18, c:'#a78bfa', moving:{axis:'x',range:90,speed:4.1}},
      {x:2190, y:400, w:50,  h:18, c:'#8b5cf6'},
      {x:2340, y:260, w:50,  h:18, c:'#7c3aed', moving:{axis:'y',range:100,speed:4.0}},
      {x:2480, y:770, w:140, h:30, c:'#ddd6fe'},
      {x:2660, y:690, w:40,  h:18, c:'#c4b5fd', moving:{axis:'x',range:60,speed:4.2}},
      {x:2780, y:620, w:40,  h:18, c:'#a78bfa'},
      {x:2895, y:540, w:40,  h:18, c:'#8b5cf6', moving:{axis:'y',range:70,speed:4.0}},
      {x:3020, y:770, w:280, h:30, c:'#ddd6fe'},
    ],
    hazards:[
      {x:118,y:798,w:47,h:12},
      {x:900,y:798,w:80,h:12},
      {x:1515,y:798,w:60,h:12},
      {x:2055,y:798,w:60,h:12},
    ],
    bouncePads:[
      {x:718, y:755,w:52,h:12,force:24},
      {x:1930,y:755,w:52,h:12,force:24},
    ],
    windFans:[
      {x:900, y:200,w:26,h:40,dir:'up',   force:0.9},
      {x:2500,y:200,w:26,h:40,dir:'left', force:0.8},
    ],
    lasers:[
      {x:1460,y:680,w:220,h:6,cycle:80, phase:0},
      {x:2600,y:500,w:180,h:6,cycle:80, phase:40},
    ],
    spikes:[
      {x:2140,y:748,w:46,h:12,cycle:70,phase:15},
      {x:2720,y:598,w:40,h:12,cycle:70,phase:35},
    ],
    saws:[
      {x:1700,y:700,r:15,axis:'x',range:120,speed:4.0,phase:0},
      {x:2880,y:640,r:15,axis:'y',range:70, speed:4.0,phase:0},
    ],
    trapDoors:[
      {x:1080,y:430,w:60,h:12,delay:18},
      {x:2340,y:260,w:50,h:12,delay:18},
    ],
    fallingPlatforms:[
      {x:450,y:460,w:60,h:16,c:'#8b5cf6',delay:20,fallSpeed:4.5},
    ],
    goal:{x:3268,y:718,w:28,h:48}
  }
};