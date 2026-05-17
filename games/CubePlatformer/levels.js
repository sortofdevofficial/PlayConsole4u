// levels.js — 5 levels, clean progressive obstacles
// L1: platforms + ice + conveyor
// L2: + bounce pads
// L3: + moving platforms + static hazards
// L4: + wind fans + lasers
// L5: + timed spikes + more lasers, max speed

const MAX_LEVELS = 5;

const LEVELS = {
  1: {
    w:1200, h:500,
    bgA:'#1a1a2e', bgB:'#16213e',
    accent:'#f97316',
    spawn:{x:50,y:390},
    platforms:[
      {x:0,   y:440, w:220,h:50, c:'#252545'},
      {x:280, y:375, w:110,h:18, c:'#303060'},
      {x:450, y:310, w:110,h:18, c:'#383870', surface:'ice'},
      {x:640, y:248, w:110,h:18, c:'#404080'},
      {x:820, y:440, w:180,h:50, c:'#252545', surface:'conveyorR'},
    ],
    hazards:[],bouncePads:[],windFans:[],lasers:[],spikes:[],
    goal:{x:1155,y:392,w:28,h:46}
  },

  2: {
    w:1500, h:520,
    bgA:'#0d1b2a', bgB:'#1b263b',
    accent:'#22c55e',
    spawn:{x:50,y:425},
    platforms:[
      {x:0,   y:465, w:180,h:55, c:'#1a2a38'},
      {x:240, y:365, w:100,h:18, c:'#223040'},
      {x:400, y:295, w:100,h:18, c:'#2a3848'},
      {x:580, y:385, w:100,h:18, c:'#223040'},
      {x:760, y:465, w:150,h:55, c:'#1a2a38'},
      {x:980, y:295, w:100,h:18, c:'#2a3848'},
      {x:1175,y:465, w:220,h:55, c:'#1a2a38'},
    ],
    hazards:[],
    bouncePads:[
      {x:495,y:367,w:52,h:12,force:16},
    ],
    windFans:[],lasers:[],spikes:[],
    goal:{x:1458,y:413,w:28,h:46}
  },

  3: {
    w:1800, h:580,
    bgA:'#120020', bgB:'#1e0038',
    accent:'#f43f5e',
    spawn:{x:50,y:490},
    platforms:[
      {x:0,   y:528, w:150,h:52, c:'#280048'},
      {x:210, y:438, w:88, h:18, c:'#330058', moving:{axis:'x',range:90,speed:1.9}},
      {x:410, y:528, w:120,h:52, c:'#280048'},
      {x:575, y:358, w:88, h:18, c:'#330058'},
      {x:745, y:278, w:88, h:18, c:'#3a0065', surface:'conveyorR'},
      {x:930, y:528, w:150,h:52, c:'#280048'},
      {x:1130,y:398, w:88, h:18, c:'#330058', moving:{axis:'y',range:80,speed:2.1}},
      {x:1315,y:298, w:88, h:18, c:'#3a0065'},
      {x:1510,y:528, w:170,h:52, c:'#280048'},
    ],
    // Static hazard spikes introduced
    hazards:[
      {x:155, y:556,w:55,h:12},
      {x:862, y:556,w:68,h:12},
    ],
    bouncePads:[{x:1220,y:508,w:52,h:12,force:17}],
    windFans:[],lasers:[],spikes:[],
    goal:{x:1658,y:470,w:28,h:56}
  },

  4: {
    w:2100, h:650,
    bgA:'#001018', bgB:'#001a28',
    accent:'#06b6d4',
    spawn:{x:50,y:565},
    platforms:[
      {x:0,   y:608, w:150,h:42, c:'#002030'},
      {x:215, y:528, w:60, h:18, c:'#002c3e', surface:'ice'},
      {x:355, y:448, w:60, h:18, c:'#003650', moving:{axis:'x',range:88,speed:2.3}},
      {x:498, y:368, w:60, h:18, c:'#004060'},
      {x:660, y:608, w:140,h:42, c:'#002030'},
      {x:870, y:428, w:88, h:18, c:'#003650', moving:{axis:'y',range:80,speed:2.4}},
      {x:1055,y:298, w:88, h:18, c:'#004060'},
      {x:1240,y:608, w:160,h:42, c:'#002030'},
      {x:1470,y:448, w:72, h:18, c:'#003650'},
      {x:1630,y:338, w:72, h:18, c:'#004060'},
      {x:1880,y:608, w:120,h:42, c:'#002030'},
    ],
    hazards:[
      {x:155, y:636,w:60,h:12},
      {x:800, y:636,w:70,h:12},
    ],
    bouncePads:[{x:577,y:590,w:52,h:12,force:19}],
    // Wind fans introduced
    windFans:[
      {x:1160,y:258,w:26,h:40,dir:'up',force:0.5},
    ],
    // Lasers introduced
    lasers:[
      {x:960, y:380,w:190,h:6,cycle:120,phase:10},
    ],
    spikes:[],
    goal:{x:1960,y:558,w:28,h:46}
  },

  5: {
    w:2500, h:720,
    bgA:'#0a0a18', bgB:'#12122a',
    accent:'#a855f7',
    spawn:{x:50,y:635},
    platforms:[
      {x:0,   y:678, w:138,h:42, c:'#181838'},
      {x:195, y:618, w:44, h:18, c:'#222258', moving:{axis:'x',range:70,speed:3.6}},
      {x:335, y:558, w:44, h:18, c:'#2a2a68', surface:'ice'},
      {x:475, y:488, w:44, h:18, c:'#323278', moving:{axis:'y',range:72,speed:3.4}},
      {x:615, y:418, w:44, h:18, c:'#3a3a88', surface:'mud'},
      {x:760, y:678, w:118,h:42, c:'#181838'},
      {x:930, y:498, w:60, h:18, c:'#2a2a68', moving:{axis:'x',range:110,speed:3.8}},
      {x:1100,y:358, w:60, h:18, c:'#323278'},
      {x:1265,y:678, w:118,h:42, c:'#181838'},
      {x:1445,y:508, w:50, h:18, c:'#2a2a68', moving:{axis:'y',range:100,speed:3.6}},
      {x:1600,y:378, w:50, h:18, c:'#3a3a88'},
      {x:1760,y:678, w:138,h:42, c:'#181838'},
      {x:1940,y:498, w:56, h:18, c:'#2a2a68', moving:{axis:'x',range:90,speed:4.0}},
      {x:2100,y:358, w:56, h:18, c:'#323278'},
      {x:2280,y:678, w:220,h:42, c:'#181838'},
    ],
    hazards:[
      {x:138, y:706,w:57,h:12},
      {x:878, y:706,w:72,h:12},
      {x:1766,y:706,w:62,h:12},
    ],
    bouncePads:[
      {x:680, y:660,w:52,h:12,force:22},
      {x:1800,y:660,w:52,h:12,force:22},
    ],
    windFans:[
      {x:1170,y:318,w:26,h:40,dir:'up',   force:0.7},
      {x:2050,y:318,w:26,h:40,dir:'right',force:0.65},
    ],
    lasers:[
      {x:840, y:558,w:210,h:6,cycle:100,phase:0},
      {x:1660,y:478,w:180,h:6,cycle:90, phase:45},
    ],
    // Timed spikes introduced
    spikes:[
      {x:1360,y:656,w:48,h:12,cycle:80,phase:20},
      {x:2150,y:336,w:44,h:12,cycle:75,phase:10},
    ],
    goal:{x:2458,y:626,w:28,h:48}
  }
};