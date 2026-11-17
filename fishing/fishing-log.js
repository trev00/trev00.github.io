// The trip log behind the fishing page. fishing.js draws the map, the table and the
// totals from this list, so logging a trip is adding one object to the end.
//
//   spot     shown on the map; trips with the same spot share one marker
//   pos      the GPS reading as written, degrees and decimal minutes:
//            "N33°43.29' W118°21.47'"
//   date     'YYYY-MM-DD'
//   start    24-hour local time, 'HH:MM'. An end earlier than the start
//   end      means the trip ran past midnight, as hoop netting often does.
//   kind     'fishing' or 'lobster'
//   goal     what the trip was after, e.g. 'Large yellowtail'
//   catch    [{ species, n, kept }] with kept optional; [] for nothing caught.
//            A species can repeat, one entry per fish or group as it came up,
//            with optional fields that put it on the map:
//              at     'HH:MM' it was caught
//              pos    where, as [lat, lon] in decimal degrees or like trip pos
//              troll  a name for the troll it came on; the map draws a line
//                     through each troll's catches in the order listed
//   trolls   optional { name: { start, end } }, each [lat, lon] and optional:
//            where a troll began and ended, if not at a catch. Its line runs
//            from start through its catches to end.
//   notes    free text: bait, tide, conditions, what to try next time
//   photos   optional [{ src, w, h, caption }]: files in fishing/images/, with
//            a 480 px copy in images/thumbs/. tools/prep_photos.py writes both
//            and prints this list, sizes filled in.

export const TRIPS = [
  {
    spot: 'Portuguese Bend kelp',
    pos: "N33°43.29' W118°21.47'",
    date: '2026-10-17',
    start: '15:45',
    end: '19:15',
    kind: 'fishing',
    goal: 'Large yellowtail',
    catch: [],
    notes: 'Fished with Ace and crew. Didn\'t catch anything but the water was 72F which was perfect for swimming.',
    photos: [
      { src: '2026-10-17-1.jpg', w: 1600, h: 1200, caption: 'A swim off the boat at sunset' },
      { src: '2026-10-17-2.jpg', w: 1600, h: 1200, caption: 'A Hapag-Lloyd container ship passing after dark' },
      { src: '2026-10-17-3.jpg', w: 1600, h: 1200, caption: 'Another container ship, from our wake' },
      { src: '2026-10-17-4.jpg', w: 1600, h: 1200, caption: 'Rod out, with the Palos Verdes coast behind' },
      { src: '2026-10-17-5.jpg', w: 1600, h: 1200, caption: 'Everyone in the water at sundown' },
    ],
  },
  {
    spot: 'Portuguese Bend kelp',
    pos: "N33°43.29' W118°21.47'",
    date: '2026-10-23',
    start: '06:30',
    end: '12:00',
    kind: 'fishing',
    goal: 'Large yellowtail',
    catch: [
      { species: 'Bonito', n: 1, kept: 0, at: '07:28', pos: [33.71080, -118.32420], troll: 'Point Fermin' },
      { species: 'Calico bass', n: 1, kept: 0, at: '08:05', pos: [33.72748, -118.35750] },
      { species: 'Yellowtail', n: 1, kept: 0, at: '08:29', pos: [33.72457, -118.35571] },
      { species: 'Ocean whitefish', n: 1, kept: 0, at: '08:38', pos: [33.72479, -118.35629] },
      { species: 'Calico bass', n: 2, kept: 0, at: '08:52', pos: [33.72531, -118.35721] },
      { species: 'Bonito', n: 1, kept: 0, pos: [33.69275, -118.26843], troll: 'To Horseshoe Kelp' },
      { species: 'Mackerel', n: 2, kept: 0, at: '11:10', pos: [33.68639, -118.25479], troll: 'To Horseshoe Kelp' },
    ],
    trolls: {
      // Not logged: a point on the 80 ft line off Point Fermin, where trolling
      // started. NOAA's relief model puts it at about 23 m (77 ft).
      'Point Fermin': { start: [33.6980, -118.2935] },
      // From the last stop off the golf course, where the 8:52 calicos came
      // up, out to Horseshoe Kelp (N33°40.07' W118°12.15'), where we turned in
      // around 11:25.
      'To Horseshoe Kelp': { start: [33.72531, -118.35721], end: "N33°40.07' W118°12.15'" },
    },
    notes: 'Fished with Sean. Fish too small to keep. Trolled from Point Fermin to Portuguese Bend with a Rapala Magnum, then fished squid at Trump Golf course until a sea lion got our lines. Trolled back and went in at 11:25.',
    photos: [
      { src: '2026-10-23-1.jpg', w: 1600, h: 1200, caption: 'Swinging one in below the Palos Verdes bluffs' },
      { src: '2026-10-23-2.jpg', w: 1600, h: 1200, caption: 'A small yellowtail, released' },
      { src: '2026-10-23-3.jpg', w: 1200, h: 1600, caption: 'A double on calico bass off the golf course' },
      { src: '2026-10-23-4.jpg', w: 1600, h: 1200, caption: 'A bonito on the troll' },
      { src: '2026-10-23-5.jpg', w: 1200, h: 1600, caption: 'The bonito up close' },
    ],
  },
  {
    // The stops, each catch logged where the stop began:
    //   7:50–8:30   the 105, drifting 33.662915, -118.227842 to 33.661687, -118.236625
    //   8:40–9:00   33.654259, -118.230302
    //   then a troll from there to 33.657534, -118.220535, with no catch on it
    //   10:00–10:40 33.648513, -118.102959, Izor's Reef; 1 whitefish, the rest not logged
    //   11:00–11:30 the oil rig, 33.662045, -118.061465
    spot: 'The 105, Izors, and Oil Rig',
    pos: "N33°39.77' W118°13.67'",
    date: '2026-10-26',
    start: '07:00',
    end: '12:00',
    kind: 'fishing',
    goal: 'Large yellowtail/seabass',
    catch: [
      { species: 'Sheephead', n: 1, kept: 1, pos: [33.662915, -118.227842] },
      { species: 'Calico bass', n: 2, pos: [33.662915, -118.227842] },
      { species: 'Calico bass', n: 1, pos: [33.654259, -118.230302] },
      { species: 'Ocean whitefish', n: 1, pos: [33.648513, -118.102959] },
      { species: 'Other', n: 5, pos: [33.648513, -118.102959] },
      { species: 'Mackerel', n: 11, pos: [33.662045, -118.061465] },
      { species: 'Barracuda', n: 1, pos: [33.662045, -118.061465] },
    ],
    notes: 'Went on the Sea Fox with Sean and ran squid/live mackerel, he caught a barracuda fly fishing by the oil rig. No luck trolling. Running heavier weights kept the bait out of bird reach.',
    photos: [
      { src: '2026-10-26-1.jpg', w: 1600, h: 1200, caption: 'A Navy destroyer passing at sunrise' },
      { src: '2026-10-26-2.jpg', w: 1600, h: 1200, caption: 'One from the stop by Izor\'s Reef' },
      { src: '2026-10-26-3.jpg', w: 1600, h: 1200, caption: 'An Osprey flying over' },
      { src: '2026-10-26-4.jpg', w: 1600, h: 1200, caption: 'Mackerel and barracuda by the oil rig' },
      { src: '2026-10-26-5.jpg', w: 1600, h: 1200, caption: 'The barracuda from the oil rig' },
    ],
  },
];
