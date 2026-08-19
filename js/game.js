/**
 * Vote of Confidence — game engine.
 *
 * The division is on this year's NHS budget in the Kingdom of Albrion. Patronage is a reshuffle
 * of 15 existing cabinet posts, with factions, feuds, and the risk of
 * a sacked minister leaking to the papers.
 */
(function (global) {
  const FORENAMES = GAME_DATA.forenames;
  const SURNAMES = GAME_DATA.surnames;
  const SEATS = GAME_DATA.seats;
  const MP_COUNT = 498;
  const HOUSE_SIZE = MP_COUNT + 1;
  const MAJORITY = 250;
  const MIN_PARTY_GAP = 12;
  const GOV_SEATS_MIN = 228;
  const GOV_SEATS_MAX = 255;

  const MINOR_PARTY_POOL = [
    { name: "Green League", possessive: "has", slug: "greens", mean: 7, spread: 4 },
    { name: "Peace Union", possessive: "has", slug: "peace", mean: 12, spread: 5 },
    { name: "Civic Alliance", possessive: "has", slug: "civic", mean: 48, spread: 7, centrist: true },
    { name: "National League", possessive: "has", slug: "nationals", mean: 80, spread: 5 },
    { name: "Country Party", possessive: "has", slug: "country", mean: 87, spread: 4 },
    { name: "Free Traders", possessive: "have", slug: "traders", mean: 93, spread: 4 },
  ];

  const CABINET_POSTS = [
    { id: "chancellor", title: "Chancellor of the Exchequer", prestige: 100 },
    { id: "foreign", title: "Foreign Secretary", prestige: 95 },
    { id: "home", title: "Home Secretary", prestige: 90 },
    { id: "health", title: "Health Secretary", prestige: 88 },
    { id: "defence", title: "Defence Secretary", prestige: 82 },
    { id: "justice", title: "Justice Secretary", prestige: 76 },
    { id: "education", title: "Education Secretary", prestige: 70 },
    { id: "dwp", title: "Work and Pensions Secretary", prestige: 64 },
    { id: "business", title: "Business Secretary", prestige: 58 },
    { id: "energy", title: "Energy Secretary", prestige: 54 },
    { id: "transport", title: "Transport Secretary", prestige: 50 },
    { id: "housing", title: "Housing Secretary", prestige: 48 },
    { id: "leader", title: "Leader of the House", prestige: 46 },
    { id: "chiefsec", title: "Chief Secretary to the Treasury", prestige: 44 },
    { id: "culture", title: "Culture Secretary", prestige: 40 },
  ];

  const SCANDAL_HEADLINES = [
    {
      paper: "The Daily Clarion",
      dirt: false,
      text: "SHAME: sacked {post} {name} dumps files on the PM — Crown House billed a donor shooting weekend to the NHS, then called the service 'a nice-to-have'.",
    },
    {
      paper: "Westmonster",
      dirt: false,
      text: "Messages seen by this paper: the PM calls a colleague 'wet lettuce', plots a 'stitch-up', and offers a peerage 'to keep this quiet'. It is not quiet.",
    },
    {
      paper: "The Whisper",
      dirt: true,
      text: "Which Prime Minister was seen leaving the Albrion Grand with an NHS lobbyist and one ministerial pass? Sources have the receipts. And the room number.",
    },
    {
      paper: "Sunday Gazette",
      dirt: true,
      text: "EXCLUSIVE: the PM was 'comforted' by a lobby correspondent after Questions. Repeatedly. Friends of the Crown House flatmate say they have been told.",
    },
    {
      paper: "The Herald",
      dirt: false,
      text: "A senior figure briefs that the PM's 'fact-finding' was a hip flask, a donor, and no agenda — all on the departmental Amex.",
    },
    {
      paper: "Evening Standard-Bearer",
      dirt: true,
      text: "PM's 'special adviser' — 26, no known policy brief — on £140k after a midnight reshuffle. Allies call it 'the Millmead job'. Sleaze watchdog circling.",
    },
    {
      paper: "The Watchman",
      dirt: false,
      text: "Sources close to Cabinet: the PM 'couldn't organise a drink in a brewery' and is 'finished by Thursday'. They then named the intern who fetched the drink.",
    },
    {
      paper: "Clarion on Sunday",
      dirt: true,
      text: "Second home, second family? Late red boxes, a red door in Millmead, and very little paperwork — according to documents passed to this newspaper.",
    },
    {
      paper: "The Dispatch",
      dirt: true,
      text: "Conference afterparty: the PM, a junior whip, and a broom cupboard. Photographs have been seen by this paper. Nobody is naming the photographer.",
    },
    {
      paper: "National Courier",
      dirt: false,
      text: "Allies of a sacked minister say the PM threw them under a bus to bury a 'bribe to the backbenches'. The bus, they add, was a ministerial Jaguar with the PM in the back.",
    },
    {
      paper: "The Sketch",
      dirt: false,
      text: "A Cabinet source: the PM asked whether the NHS was 'the one with the boats'. Officials said no. The PM wrote 'boats??' on the settlement and underlined it. Twice.",
    },
    {
      paper: "First Edition",
      dirt: false,
      text: "LEAK: a voicemail passed to the lobby — the PM sacking a minister, then pocket-dialling for six minutes of a kettle, heavy breathing, and one very clear 'oh God'.",
    },
    {
      paper: "The Albrion Argus",
      dirt: true,
      text: "The PM's red box contained extra-strong mints, a hotel keycard, and a lipstick note: 'Don't be late this time.' A photocopy is in circulation. The mints were not extra-strong enough.",
    },
    {
      paper: "Sunday Sentinel",
      dirt: true,
      text: "PM's 'constituency surgery' was a hot tub in Millmead, two special advisers, and House champagne marked 'visiting dignitaries'. The booking, seen by this paper: 'listening exercise'.",
    },
    {
      paper: "The Order Paper",
      dirt: false,
      text: "The PM's whipping spreadsheet, circulated anonymously. It is a family calendar. Thursday: 'VOTES??'. Saturday: 'dentist (maybe)'. The Chief Whip is listed as 'mum?'.",
    },
    {
      paper: "Lobby Extra",
      dirt: true,
      text: "EXCLUSIVE: the PM's dating profile is called HungParliament. Bio: 'looking for a majority'. Three matches were journalists. None of them swiped right.",
    },
  ];

  function randInt(maxExclusive) {
    return Math.floor(Math.random() * maxExclusive);
  }

  function clamp(n, lo, hi) {
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }

  function clamp0to100(n) {
    return clamp(n, 0, 100);
  }

  function noisyVisible(trueValue) {
    return clamp0to100(trueValue + (-5 + randInt(11)));
  }

  function gauss(scale) {
    const u = 1 - Math.random();
    const v = Math.random();
    return scale * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function sigmoid(z) {
    if (z > 20) return 1;
    if (z < -20) return 0;
    return 1 / (1 + Math.exp(-z));
  }

  function minorCohesion(n) {
    if (n <= 6) return 0.94;
    if (n <= 10) return 0.91;
    if (n <= 16) return 0.86;
    if (n <= 24) return 0.78;
    return 0.7;
  }

  function partyBlocPosition(party) {
    if (party.blocPosition != null) return party.blocPosition;
    return party.position;
  }

  function cachePartyBlocPositions() {
    partys.forEach(function (party) {
      if (party.isMajor || !party.mpsInParty.length) {
        party.blocPosition = party.position;
        return;
      }
      const members = party.mpsInParty.slice().sort(function (a, b) {
        return a.position - b.position;
      });
      const median = members[Math.floor(members.length / 2)].position;
      const leaderPos = party.leader ? party.leader.position : party.position;
      party.blocPosition = 0.55 * leaderPos + 0.45 * median;
    });
  }

  function factionCohesion(n) {
    if (n <= 1) return 0;
    return clamp(0.2 + 0.42 * (1 - (n - 2) / 70), 0.18, 0.58);
  }

  function whipDiscipline(mp) {
    if (mp.governing) return 1.38;
    if (mp.opposition) return 0.36;
    return 0.92;
  }

  function followWeight(satisfaction, baseCohesion) {
    if (baseCohesion <= 0) return 0;
    const s = clamp(satisfaction, 0, 100);
    let w =
      s >= 42
        ? baseCohesion * ((s - 42) / 58)
        : -baseCohesion * 0.32 * ((42 - s) / 42);
    return clamp(w, -0.85, 0.85);
  }

  function mixTowardLeader(p, mp, leader, sat, baseCohesion, x) {
    if (!leader || leader === mp) return p;
    const w = followWeight(sat, baseCohesion);
    if (Math.abs(w) < 0.01) return p;
    const leaderP = sigmoid(leader.supportLogit(x));
    if (w > 0) return (1 - w) * p + w * leaderP;
    return (1 + w) * p + -w * (1 - leaderP);
  }

  function leaderSatisfaction(mp, leader, kind) {
    if (!leader) return 50;
    if (mp === leader) return 100;
    const like = getLike(mp, leader);
    const policyFit = 100 - Math.abs(mp.position - leader.position);
    let sat =
      kind === "faction"
        ? 0.74 * like + 0.26 * policyFit
        : 0.5 * like + 0.32 * mp.loyalty + 0.18 * policyFit;
    if (areFeuding(mp, leader)) {
      sat = Math.min(sat, 10 + 0.18 * like);
    }
    return clamp(sat, 0, 100);
  }

  function uniformNoise(span) {
    return -span + Math.random() * span * 2;
  }

  function genRanNoRep(num, from, to) {
    const pool = [];
    for (let i = 0; i < to - from + 1; i++) pool.push(from + i);
    const sel = [];
    for (let i = 0; i < num; i++) {
      const x = randInt(to - from + 1 - i);
      sel.push(pool[x]);
      pool.splice(x, 1);
    }
    return sel;
  }

  function cutsBn(x) {
    return Math.round((Number(x) - 50) * 1.2);
  }

  function budgetBn(x) {
    return 150 - cutsBn(x);
  }

  function budgetBand(x) {
    if (x < 20) return "Major expansion";
    if (x < 40) return "Modest rise";
    if (x < 55) return "Standstill";
    if (x < 75) return "Real-terms cuts";
    return "Deep cuts";
  }

  function formatBudget(x) {
    const cuts = cutsBn(x);
    if (cuts > 2) return "£" + cuts + " billion in cuts";
    if (cuts < -2) return "£" + Math.abs(cuts) + " billion extra";
    return "a freeze";
  }

  function seniorityBand(value) {
    if (value < 25) return "New intake";
    if (value < 50) return "Backbench regular";
    if (value < 75) return "Old hand";
    return "Grandee";
  }

  function sleazeWhisper(value) {
    if (value < 35) return "Clean";
    if (value < 65) return "Murmurs";
    return "Trouble";
  }

  function prestigeLabel(value) {
    if (value >= 90) return "Great office";
    if (value >= 70) return "Senior post";
    if (value >= 50) return "Middle rank";
    return "Junior post";
  }

  function grievanceLabel(value) {
    if (value < 25) return "Content";
    if (value < 45) return "Unsettled";
    if (value < 65) return "Grumbling";
    if (value < 80) return "Bitter";
    return "Out for blood";
  }

  function refreshGrievance(mp) {
    mp.grievance = clamp0to100(
      0.35 * (100 - mp.likeOfPm) +
        0.28 * mp.ambition +
        0.22 * (100 - mp.loyalty) +
        0.15 * mp.pastGrudge
    );
    mp.visibleGrievance = noisyVisible(mp.grievance);
  }

  function loyaltyLabel(value) {
    if (value >= 80) return "Rock-solid";
    if (value >= 60) return "Loyal";
    if (value >= 40) return "Wavering";
    if (value >= 20) return "Disloyal";
    return "Mutinous";
  }

  function ambitionLabel(value) {
    if (value >= 80) return "Hungry for office";
    if (value >= 60) return "On manoeuvres";
    if (value >= 40) return "Quietly ambitious";
    if (value >= 20) return "Content on the backbenches";
    return "Would rather be in the tea room";
  }

  function charismaLabel(value) {
    if (value >= 80) return "A star";
    if (value >= 60) return "A performer";
    if (value >= 40) return "Decent on their feet";
    if (value >= 20) return "Grey";
    return "A walking filing cabinet";
  }

  function voteLabel(p) {
    if (p >= 0.75) return "Likely aye";
    if (p >= 0.6) return "Leaning aye";
    if (p >= 0.4) return "Toss-up";
    if (p >= 0.25) return "Leaning no";
    return "Likely no";
  }

  function cutsStance(value) {
    if (value < 20) return "Wants a big expansion";
    if (value < 40) return "Wants a modest rise";
    if (value < 55) return "Happy with a freeze";
    if (value < 75) return "Wants cuts";
    return "Wants deep cuts";
  }

  class Party {
    constructor(id, position) {
      this.partyId = id;
      this.position = position;
      this.name = "";
      this.possessive = "";
      this.numMps = 0;
      this.mpsInParty = [];
      this.isMajor = false;
      this.slug = "";
      this.spread = 8;
      this.plannedSize = 0;
      this.leader = null;
    }

    increaseNumMps() {
      this.numMps += 1;
    }

    insertMp(mp) {
      this.mpsInParty.push(mp);
    }

    getMedianMpPos() {
      this.mpsInParty.sort((a, b) => a.visiblePosition - b.visiblePosition);
      if (this.mpsInParty.length === 0) return 0;
      if (this.mpsInParty.length % 2 === 1) {
        const middle = Math.min(
          (this.mpsInParty.length + 1) / 2,
          this.mpsInParty.length - 1
        );
        return this.mpsInParty[middle].visiblePosition;
      }
      const middle = this.mpsInParty.length / 2;
      return this.mpsInParty[middle].visiblePosition;
    }

    areGovernment() {
      sortPartiesByMps();
      return partys[0] === this;
    }

    areOpposition() {
      sortPartiesByMps();
      return partys[1] === this;
    }
  }

  class ParlMember {
    constructor(opts) {
      this.mpId = opts.id;
      this.forename = opts.forename;
      this.surname = opts.surname;
      this.seat = opts.seat;
      this.ambition = opts.ambition;
      this.visibleAmbition = noisyVisible(opts.ambition);
      this.loyalty = opts.loyalty;
      this.visibleLoyalty = noisyVisible(opts.loyalty);
      this.position = opts.position;
      this.visiblePosition = noisyVisible(opts.position);
      this.seniority = opts.seniority;
      this.visibleSeniority = noisyVisible(opts.seniority);
      this.charisma = opts.charisma;
      this.visibleCharisma = noisyVisible(opts.charisma);
      this.sleaze = opts.sleaze;
      this.likeOfPm = clamp0to100(
        0.5 * opts.loyalty +
          0.25 * (100 - Math.abs(opts.position - opts.party.position)) +
          uniformNoise(20)
      );
      this.pastGrudge = randInt(101);
      this.grievance = 0;
      this.visibleGrievance = 0;
      this.party = opts.party;
      this.governing = 0;
      this.opposition = 0;
      this.cabinetPost = null;
      this.sackedThisSitting = false;
      this.factionMood = 0;
      this.factionId = -1;
      this.factionLeader = null;
      this.factionName = "";
      this.factionSize = 0;
      this.factionLeaderStanding = 50;
      this.partyLeaderStanding = 50;
      this.feudWith = [];
      opts.party.increaseNumMps();
      mps.push(this);
      opts.party.insertMp(this);
      refreshGrievance(this);
    }

    get name() {
      return this.forename + " " + this.surname;
    }

    giveGovStatus() {
      if (this.party.areGovernment()) {
        this.governing = 1;
      } else if (this.party.areOpposition()) {
        this.opposition = 1;
      } else {
        this.governing = 0;
        this.opposition = 0;
      }
    }

    factionHasNoMinister() {
      if (!this.governing || this.factionSize < 5) return false;
      const members = this.party.mpsInParty;
      for (let i = 0; i < members.length; i++) {
        if (members[i].factionId === this.factionId && members[i].cabinetPost) {
          return false;
        }
      }
      return true;
    }

    supportLogit(x) {
      if (this.party && !this.party.isMajor) {
        return this.minorSupportLogit(x);
      }
      const dist = Math.abs(x - this.position);
      let inner =
        -0.055 * dist * (1 - this.governing) -
        0.075 * dist * this.opposition +
        (-0.03 * dist - 0.014 * this.ambition + 0.046 * this.loyalty) *
          this.governing +
        1.86 * this.governing +
        0.38 * (1 - this.governing) -
        1.48 * this.opposition +
        (this.cabinetPost ? 1.55 : 0) +
        0.032 * this.factionMood +
        0.012 * (pmStanding - 50) +
        (this.sackedThisSitting ? -1.35 : 0) +
        (this.factionHasNoMinister() ? -0.4 : 0);
      return inner;
    }

    minorSupportLogit(x) {
      const bloc = partyBlocPosition(this.party);
      const ownDist = Math.abs(x - this.position);
      const blocDist = Math.abs(x - bloc);
      const outlier = Math.abs(this.position - bloc);
      const ownShare = clamp(0.1 + outlier / 90, 0.1, 0.28);
      const dist = ownShare * ownDist + (1 - ownShare) * blocDist;
      let inner = 0.22 - 0.16 * dist;
      if (dist > 18) inner -= 0.22 * (dist - 18);
      if (dist < 16) {
        const close = 1 - dist / 16;
        inner += 2.4 * close * close;
      }
      return inner;
    }

    isSmallMinorLeader() {
      return (
        this.party &&
        !this.party.isMajor &&
        this.party.leader === this &&
        this.party.numMps < 14
      );
    }

    getProbSup(x) {
      let p = sigmoid(this.supportLogit(x));
      if (this.party && !this.party.isMajor) {
        const leader = this.party.leader;
        if (leader && leader !== this) {
          const w = minorCohesion(this.party.numMps);
          const leaderP = sigmoid(leader.supportLogit(x));
          p = (1 - w) * p + w * leaderP;
        }
        return p;
      }
      const disc = whipDiscipline(this);
      p = mixTowardLeader(
        p,
        this,
        this.factionLeader,
        this.factionLeaderStanding,
        factionCohesion(this.factionSize) * disc,
        x
      );
      const party = this.party;
      if (party && party.leader) {
        p = mixTowardLeader(
          p,
          this,
          party.leader,
          this.partyLeaderStanding,
          0.16 * disc,
          x
        );
      }
      return p;
    }

    getBinaryVote(p) {
      return Math.random() < p ? 1 : 0;
    }
  }

  let partys = [];
  let mps = [];
  let likes = null;
  let feudSet = {};
  let factionLeaderStandingMap = {};
  let partyLeaderStandingMap = {};
  let pmStanding = 50;
  let offeredThisTurn = false;
  let sittingEvents = [];
  let lastOfferResult = null;

  function likeIndex(a, b) {
    return a.mpId * MP_COUNT + b.mpId;
  }

  function getLike(a, b) {
    if (!likes || a === b) return 100;
    return likes[likeIndex(a, b)];
  }

  function setLike(a, b, value) {
    likes[likeIndex(a, b)] = clamp0to100(value);
  }

  function feudKey(a, b) {
    return Math.min(a.mpId, b.mpId) + ":" + Math.max(a.mpId, b.mpId);
  }

  function areFeuding(a, b) {
    return !!feudSet[feudKey(a, b)];
  }

  function sortPartiesByPosition() {
    partys.sort((a, b) => a.position - b.position);
  }

  function sortPartiesByMps() {
    partys.sort((a, b) => b.numMps - a.numMps);
  }

  function getClosestParty(x) {
    let distance = Math.abs(partys[0].position - x);
    let idx = 0;
    for (let c = 1; c < partys.length; c++) {
      const cdistance = Math.abs(partys[c].position - x);
      if (cdistance < distance) {
        idx = c;
        distance = cdistance;
      }
    }
    return partys[idx];
  }

  function poisson(lambda) {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k += 1;
      p *= Math.random();
    } while (p > L);
    return k - 1;
  }

  function sampleMinorSize() {
    const roll = Math.random();
    if (roll < 0.025) {
      return clamp(Math.round(18 + 32 * Math.pow(Math.random(), 2.2)), 18, 50);
    }
    if (roll < 0.07) {
      return clamp(16 + poisson(8), 16, 50);
    }
    let n = poisson(10);
    if (n >= 10 && n <= 16 && Math.random() < 0.09) {
      n = 2 + randInt(8);
    }
    return clamp(n, 1, 50);
  }

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function generateParties(n) {
    partys = [];
    let ranPos = genRanNoRep(n, 0, 100);
    for (let attempt = 0; attempt < 80; attempt++) {
      const sorted = ranPos.slice().sort((a, b) => a - b);
      if (
        sorted[1] - sorted[0] >= MIN_PARTY_GAP &&
        sorted[2] - sorted[1] >= MIN_PARTY_GAP
      ) {
        break;
      }
      ranPos = genRanNoRep(n, 0, 100);
    }
    for (let i = 0; i < n; i++) {
      partys.push(new Party(i, ranPos[i]));
    }
    sortPartiesByPosition();
    partys[0].name = "Workers Party";
    partys[0].possessive = "has";
    partys[0].isMajor = true;
    partys[0].slug = "workers";
    partys[1].name = "Liberals";
    partys[1].possessive = "have";
    partys[1].isMajor = true;
    partys[1].slug = "liberals";
    partys[2].name = "Royalists";
    partys[2].possessive = "have";
    partys[2].isMajor = true;
    partys[2].slug = "royalists";

    const nMinor = 2 + randInt(2);
    const chosen = shuffle(MINOR_PARTY_POOL).slice(0, nMinor);
    const sizes = chosen.map(function () {
      return sampleMinorSize();
    });
    chosen.sort(function (a, b) {
      return Math.abs(b.mean - 50) - Math.abs(a.mean - 50);
    });
    sizes.sort(function (a, b) {
      return a - b;
    });
    const leftMajor = partys[0].position;
    const rightMajor = partys[2].position;
    for (let i = 0; i < nMinor; i++) {
      const spec = chosen[i];
      const size = sizes[i];
      const exception = spec.centrist || Math.random() < 0.12;
      let pos = spec.mean + gauss(spec.spread * 0.35);
      if (!exception) {
        if (spec.mean < 50) {
          const cap = Math.max(1, leftMajor - 5);
          pos = Math.min(pos, cap - 2 + gauss(3));
          pos = clamp(pos, 0, cap);
        } else {
          const floor = Math.min(99, rightMajor + 5);
          pos = Math.max(pos, floor + 2 + gauss(3));
          pos = clamp(pos, floor, 100);
        }
      }
      const small = Math.max(0, (12 - size) / 11);
      if (small > 0 && !exception) {
        const pole = spec.mean < 50 ? 3 + gauss(3) : 97 + gauss(3);
        pos = (1 - 0.55 * small) * pos + 0.55 * small * pole;
      }
      const party = new Party(partys.length, clamp0to100(Math.round(pos)));
      party.name = spec.name;
      party.possessive = spec.possessive;
      party.isMajor = false;
      party.slug = spec.slug;
      party.spread = spec.spread;
      party.plannedSize = size;
      partys.push(party);
    }
  }

  function getClosestMajor(x) {
    const majors = partys.filter(function (p) {
      return p.isMajor;
    });
    let distance = Math.abs(majors[0].position - x);
    let idx = 0;
    for (let c = 1; c < majors.length; c++) {
      const cdistance = Math.abs(majors[c].position - x);
      if (cdistance < distance) {
        idx = c;
        distance = cdistance;
      }
    }
    return majors[idx];
  }

  function makeMp(id, position, party, seniority) {
    new ParlMember({
      id: id,
      forename: FORENAMES[randInt(FORENAMES.length)],
      surname: SURNAMES[randInt(SURNAMES.length)],
      seat: SEATS[id],
      ambition: randInt(101),
      loyalty: randInt(101),
      position: position,
      seniority:
        seniority !== undefined
          ? seniority
          : Math.random() < 0.1
            ? 4 + randInt(20)
            : clamp0to100(Math.round(gauss(22) + 42)),
      charisma: randInt(101),
      sleaze: randInt(101),
      party: party,
    });
  }

  function generateMps() {
    mps = [];
    let nextId = 0;
    partys.forEach(function (party) {
      if (party.isMajor) return;
      const n = party.plannedSize || sampleMinorSize();
      const spread = n <= 10 ? 2.6 : n <= 18 ? 3.8 : Math.min(party.spread || 5, 5);
      for (let i = 0; i < n && nextId < MP_COUNT; i++) {
        const position = clamp0to100(
          Math.round(party.position + gauss(spread))
        );
        makeMp(nextId, position, party);
        nextId += 1;
      }
    });
    while (nextId < MP_COUNT) {
      const position = randInt(101);
      makeMp(nextId, position, getClosestMajor(position));
      nextId += 1;
    }
    assignPartyLeaders();
    cachePartyBlocPositions();
    for (let i = 0; i < MP_COUNT; i++) {
      mps[i].giveGovStatus();
    }
  }

  function assignPartyLeaders() {
    partys.forEach(function (party) {
      const members = party.mpsInParty;
      if (!members.length) {
        party.leader = null;
        return;
      }
      party.leader = members.reduce(function (best, mp) {
        if (mp.seniority > best.seniority) return mp;
        if (mp.seniority === best.seniority && mp.charisma > best.charisma) {
          return mp;
        }
        return best;
      }, members[0]);
    });
  }

  function buildAffinity() {
    likes = new Float32Array(MP_COUNT * MP_COUNT);
    for (let i = 0; i < MP_COUNT; i++) {
      const a = mps[i];
      likes[likeIndex(a, a)] = 100;
      for (let j = 0; j < MP_COUNT; j++) {
        if (i === j) continue;
        const b = mps[j];
        const similarity = 100 - Math.abs(a.position - b.position);
        const loyaltySim = 100 - Math.abs(a.loyalty - b.loyalty);
        setLike(
          a,
          b,
          0.55 * similarity + 0.35 * b.charisma + 0.1 * loyaltySim + uniformNoise(8)
        );
      }
    }
  }

  function overlayFeuds() {
    feudSet = {};
    partys.forEach(function (party) {
      const members = party.mpsInParty;
      if (members.length < 2) return;
      const nFeuds = Math.min(
        Math.floor((members.length * (members.length - 1)) / 2),
        8 + randInt(Math.max(6, Math.floor(members.length / 12)))
      );
      let placed = 0;
      let guard = 0;
      while (placed < nFeuds && guard < nFeuds * 40) {
        guard += 1;
        const a = members[randInt(members.length)];
        const b = members[randInt(members.length)];
        if (a === b || areFeuding(a, b)) continue;
        if (getLike(a, b) < 52 && Math.random() < 0.7) continue;
        feudSet[feudKey(a, b)] = true;
        a.feudWith.push(b);
        b.feudWith.push(a);
        setLike(a, b, 4 + randInt(10));
        setLike(b, a, 4 + randInt(10));
        placed += 1;
      }
    });
  }

  function leadershipScore(mp) {
    return 0.5 * mp.charisma + 0.5 * mp.seniority + uniformNoise(10);
  }

  function nPotentialLeaders(partySize) {
    const minL = partySize < 80 ? 2 : partySize < 150 ? 3 : 5;
    const maxL = Math.min(8, Math.max(minL + 1, Math.round(partySize / 36)));
    return minL + randInt(maxL - minL + 1);
  }

  function groupingCanTake(members, mp) {
    for (let i = 0; i < members.length; i++) {
      if (areFeuding(mp, members[i])) return false;
    }
    return true;
  }

  function buildFactions() {
    let nextId = 0;
    partys.forEach(function (party) {
      const members = party.mpsInParty.slice();
      members.forEach(function (mp) {
        mp._lead = leadershipScore(mp);
      });
      members.sort(function (a, b) {
        return b._lead - a._lead;
      });
      const nLead = Math.min(members.length, nPotentialLeaders(members.length));
      const factions = [];
      for (let i = 0; i < nLead; i++) {
        const leader = members[i];
        const faction = {
          id: nextId,
          leader: leader,
          members: [leader],
          name: "the " + leader.surname + " grouping",
        };
        nextId += 1;
        leader.factionId = faction.id;
        leader.factionLeader = leader;
        leader.factionName = faction.name;
        factions.push(faction);
      }
      members.slice(nLead).forEach(function (mp) {
        const ranked = factions.slice().sort(function (fa, fb) {
          return getLike(mp, fb.leader) - getLike(mp, fa.leader);
        });
        let joined = null;
        for (let i = 0; i < ranked.length; i++) {
          const f = ranked[i];
          if (areFeuding(mp, f.leader)) continue;
          if (!groupingCanTake(f.members, mp)) continue;
          joined = f;
          break;
        }
        if (!joined) {
          joined = {
            id: nextId,
            leader: mp,
            members: [mp],
            name: "the " + mp.surname + " grouping",
          };
          nextId += 1;
          factions.push(joined);
        } else {
          joined.members.push(mp);
        }
        mp.factionId = joined.id;
        mp.factionLeader = joined.leader;
        mp.factionName = joined.name;
      });
      factions.forEach(function (f) {
        f.members.forEach(function (mp) {
          mp.factionSize = f.members.length;
        });
        for (let i = 0; i < f.members.length; i++) {
          for (let j = 0; j < f.members.length; j++) {
            if (i === j) continue;
            const a = f.members[i];
            const b = f.members[j];
            if (areFeuding(a, b)) continue;
            setLike(a, b, getLike(a, b) + 12);
          }
        }
      });
    });
  }

  function govPolicyMedian() {
    const vals = getGovernment()
      .mpsInParty.map(function (mp) {
        return mp.position;
      })
      .sort(function (a, b) {
        return a - b;
      });
    return vals[Math.floor(vals.length / 2)] || 50;
  }

  function cabinetWeight(mp) {
    const policyFit = 100 - Math.abs(mp.position - govPolicyMedian());
    const raw =
      0.24 * mp.seniority +
      0.16 * mp.loyalty +
      0.14 * mp.charisma +
      0.14 * policyFit +
      0.14 * mp.ambition +
      0.18 * mp.likeOfPm;
    return Math.pow(Math.max(1, raw), 2.3);
  }

  function weightedPick(pool, n) {
    const remaining = pool.slice();
    const chosen = [];
    while (chosen.length < n && remaining.length) {
      let total = 0;
      const weights = remaining.map(function (mp) {
        const w = cabinetWeight(mp);
        total += w;
        return w;
      });
      let r = Math.random() * total;
      let idx = remaining.length - 1;
      for (let i = 0; i < remaining.length; i++) {
        r -= weights[i];
        if (r <= 0) {
          idx = i;
          break;
        }
      }
      chosen.push(remaining[idx]);
      remaining.splice(idx, 1);
    }
    return chosen;
  }

  function governmentFactions() {
    const map = {};
    getGovernment().mpsInParty.forEach(function (mp) {
      if (!map[mp.factionId]) {
        map[mp.factionId] = {
          id: mp.factionId,
          name: mp.factionName,
          leader: mp.factionLeader,
          members: [],
        };
      }
      map[mp.factionId].members.push(mp);
    });
    return Object.keys(map)
      .map(function (k) {
        return map[k];
      })
      .sort(function (a, b) {
        return b.members.length - a.members.length;
      });
  }

  function getUnrepresentedFactions() {
    return governmentFactions().filter(function (f) {
      return (
        f.members.length >= 5 &&
        !f.members.some(function (m) {
          return m.cabinetPost;
        })
      );
    });
  }

  function getRebelliousFactions(x) {
    return governmentFactions()
      .filter(function (f) {
        return f.members.length >= 5;
      })
      .map(function (f) {
        let expectedRebels = 0;
        f.members.forEach(function (mp) {
          expectedRebels += 1 - mp.getProbSup(x);
        });
        return {
          id: f.id,
          name: f.name,
          leader: f.leader,
          size: f.members.length,
          expectedRebels: Math.round(expectedRebels),
          rate: expectedRebels / f.members.length,
          inCabinet: f.members.some(function (m) {
            return m.cabinetPost;
          }),
        };
      })
      .filter(function (f) {
        return f.rate >= 0.18;
      })
      .sort(function (a, b) {
        return b.rate - a.rate || b.expectedRebels - a.expectedRebels;
      });
  }

  function assignCabinet() {
    const factions = governmentFactions().filter(function (f) {
      return f.members.length >= 5;
    });
    const excludedIds = {};
    const outsiders = factions.length >= 3 ? factions.slice(1) : [];
    for (let i = 0; i < outsiders.length && i < 2; i++) {
      excludedIds[outsiders[i].id] = true;
    }
    let pool = getGovernment().mpsInParty.filter(function (mp) {
      return !excludedIds[mp.factionId];
    });
    if (pool.length < CABINET_POSTS.length) {
      pool = getGovernment().mpsInParty.slice();
    }

    const picked = [];
    function addFrom(filterFn, n) {
      const avail = pool.filter(function (mp) {
        return picked.indexOf(mp) === -1 && (!filterFn || filterFn(mp));
      });
      weightedPick(avail, n).forEach(function (mp) {
        picked.push(mp);
      });
    }
    addFrom(function (mp) {
      return mp.seniority >= 50;
    }, 12);
    addFrom(function (mp) {
      return mp.seniority < 50 && mp.seniority >= 22;
    }, 2);
    addFrom(function (mp) {
      return mp.seniority < 22;
    }, 1);
    addFrom(null, CABINET_POSTS.length - picked.length);

    const remaining = picked.slice();
    CABINET_POSTS.forEach(function (post) {
      const eligible = remaining.filter(function (mp) {
        if (post.prestige >= 82 && mp.seniority < 40) return false;
        return true;
      });
      const from = eligible.length ? eligible : remaining;
      const choice = weightedPick(from, 1)[0];
      if (!choice) return;
      choice.cabinetPost = post;
      remaining.splice(remaining.indexOf(choice), 1);
    });
  }

  function parliamentLooksCompetitive() {
    const gov = getGovernment().numMps;
    const third = getThirdParty().numMps;
    return gov >= GOV_SEATS_MIN && gov <= GOV_SEATS_MAX && third >= 48;
  }

  function getGovernment() {
    sortPartiesByMps();
    return partys[0];
  }

  function getOpposition() {
    sortPartiesByMps();
    return partys[1];
  }

  function getThirdParty() {
    sortPartiesByMps();
    return partys[2];
  }

  function getWhipForecast(x, playerVote) {
    const gov = getGovernment();
    const opp = getOpposition();
    const third = getThirdParty();
    const byParty = {};
    partys.forEach(function (p) {
      byParty[p.name] = p === gov ? playerVote : 0;
    });
    let government = playerVote;
    let opposition = 0;
    let thirdAyes = 0;
    let rebels = 0;
    for (let i = 0; i < MP_COUNT; i++) {
      const mp = mps[i];
      const p = mp.getProbSup(x);
      byParty[mp.party.name] += p;
      if (mp.party === gov) {
        government += p;
        rebels += 1 - p;
      } else if (mp.party === opp) {
        opposition += p;
      } else {
        thirdAyes += p;
      }
    }
    const total = government + opposition + thirdAyes;
    return {
      total: Math.floor(total),
      government: Math.floor(government),
      opposition: Math.floor(opposition),
      third: Math.floor(thirdAyes),
      rebels: Math.floor(rebels),
      shortfall: MAJORITY - Math.floor(total),
      byParty: byParty,
    };
  }

  function holdDivision(x, playerVote) {
    const gov = getGovernment();
    const opp = getOpposition();
    const third = getThirdParty();
    const byParty = {};
    partys.forEach(function (p) {
      byParty[p.name] = p === gov ? playerVote : 0;
    });
    let total = playerVote;
    let rebels = 0;
    for (let i = 0; i < mps.length; i++) {
      const mp = mps[i];
      const vote = mp.getBinaryVote(mp.getProbSup(x));
      total += vote;
      byParty[mp.party.name] += vote;
      if (mp.party === gov && vote === 0) rebels += 1;
    }
    return {
      total: total,
      nos: HOUSE_SIZE - total,
      byParty: byParty,
      rebels: rebels,
    };
  }

  function selWhipTargets(n, x) {
    const gov = getGovernment();
    const rebelRate = {};
    getRebelliousFactions(x).forEach(function (f) {
      rebelRate[f.id] = f.rate;
    });
    const unrep = {};
    getUnrepresentedFactions().forEach(function (f) {
      unrep[f.id] = true;
    });
    return gov.mpsInParty
      .filter(function (mp) {
        return !mp.cabinetPost;
      })
      .map(function (mp) {
        const revolt = 1 - mp.getProbSup(x);
        const leverage = (rebelRate[mp.factionId] || 0) * Math.min(1, mp.factionSize / 40);
        const stature =
          ((mp.charisma + mp.seniority) / 200) * Math.min(1, mp.factionSize / 30);
        const score =
          revolt * 0.55 +
          leverage * 0.35 +
          (unrep[mp.factionId] ? 0.22 : 0) +
          stature * 0.15 +
          (mp.ambition / 100) * 0.08;
        return { mp: mp, score: score };
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .slice(0, n)
      .map(function (row) {
        return row.mp;
      });
  }

  function getCabinet() {
    return CABINET_POSTS.map(function (post) {
      const mp = mps.find(function (m) {
        return m.cabinetPost && m.cabinetPost.id === post.id;
      });
      return { post: post, mp: mp || null };
    });
  }

  function findPost(postId) {
    return CABINET_POSTS.find(function (p) {
      return p.id === postId;
    });
  }

  function holderOf(postId) {
    return mps.find(function (m) {
      return m.cabinetPost && m.cabinetPost.id === postId;
    });
  }

  function acceptanceChance(mp, post) {
    const prestige = post.prestige;
    const ambition = mp.ambition;
    return clamp(
      0.14 +
        0.0072 * prestige +
        0.0035 * (ambition - 35) -
        0.004 * Math.max(0, ambition - prestige),
      0.08,
      0.97
    );
  }

  function chanceLabel(p) {
    if (p >= 0.7) return "likely";
    if (p >= 0.4) return "toss-up";
    return "long shot";
  }

  function leakChance(mp) {
    return clamp(0.06 + 0.82 * (mp.grievance / 100), 0.04, 0.95);
  }

  function applyFactionAnger(sacked, post) {
    const allies = mps.filter(function (mp) {
      return (
        mp !== sacked &&
        mp.party === sacked.party &&
        mp.factionId === sacked.factionId
      );
    });
    const share = clamp(0.18 + 0.72 * (sacked.seniority / 100), 0.18, 0.9);
    const nAngry = Math.max(1, Math.round(allies.length * share));
    const hit =
      (post.prestige / 100) * (0.5 + 0.5 * (sacked.seniority / 100)) * 30;
    allies.sort(function (a, b) {
      return getLike(b, sacked) - getLike(a, sacked);
    });
    allies.slice(0, nAngry).forEach(function (mp) {
      mp.factionMood -= (getLike(mp, sacked) / 100) * hit;
    });
    sacked.factionMood -= 10 + 16 * (sacked.seniority / 100);
  }

  function applyFactionBoost(promoted, post) {
    const weight = post.prestige / 100;
    const stature = (0.5 * promoted.charisma + 0.5 * promoted.seniority) / 100;
    mps.forEach(function (mp) {
      if (mp.party !== promoted.party || mp.factionId !== promoted.factionId) return;
      mp.factionMood += (getLike(mp, promoted) / 100) * weight * stature * 24;
    });
    promoted.factionMood += 8;
  }

  function maybeScandal(sacked, post) {
    if (Math.random() >= leakChance(sacked)) return null;
    const wantDirt = Math.random() < sacked.sleaze / 100;
    let pool = SCANDAL_HEADLINES.filter(function (h) {
      return wantDirt ? h.dirt : !h.dirt;
    });
    if (!pool.length) pool = SCANDAL_HEADLINES;
    const hit = pool[randInt(pool.length)];
    const drop = 12 + randInt(7);
    applyPmStandingDrop(drop);
    return {
      paper: hit.paper,
      text: hit.text.replace(/\{name\}/g, sacked.name).replace(/\{post\}/g, post.title),
      drop: drop,
    };
  }

  function offerPost(mp, postId) {
    if (offeredThisTurn) return { ok: false, reason: "already-offered" };
    if (!mp || mp.cabinetPost || mp.governing !== 1) {
      return { ok: false, reason: "invalid-target" };
    }
    const post = findPost(postId);
    const incumbent = holderOf(postId);
    if (!post || !incumbent) return { ok: false, reason: "invalid-post" };

    offeredThisTurn = true;
    const pAccept = acceptanceChance(mp, post);
    if (Math.random() >= pAccept) {
      mp.loyalty = clamp0to100(mp.loyalty - 6);
      mp.visibleLoyalty = clamp0to100(mp.visibleLoyalty - 6);
      refreshGrievance(mp);
      lastOfferResult = {
        ok: true,
        accepted: false,
        mp: mp,
        post: post,
        incumbent: incumbent,
        scandal: null,
        chance: pAccept,
      };
      sittingEvents.push({
        type: "refuse",
        mpName: mp.name,
        postTitle: post.title,
      });
      return lastOfferResult;
    }

    incumbent.cabinetPost = null;
    incumbent.sackedThisSitting = true;
    incumbent.likeOfPm = clamp0to100(incumbent.likeOfPm - 18);
    refreshGrievance(incumbent);
    applyFactionAnger(incumbent, post);
    const scandal = maybeScandal(incumbent, post);
    mp.cabinetPost = post;
    const bump = Math.floor(0.35 * mp.ambition) + 6;
    mp.loyalty = clamp0to100(mp.loyalty + bump);
    mp.visibleLoyalty = clamp0to100(mp.visibleLoyalty + bump);
    mp.likeOfPm = clamp0to100(mp.likeOfPm + 10);
    refreshGrievance(mp);
    applyFactionBoost(mp, post);

    lastOfferResult = {
      ok: true,
      accepted: true,
      mp: mp,
      post: post,
      incumbent: incumbent,
      scandal: scandal,
      chance: pAccept,
    };
    sittingEvents.push({
      type: "reshuffle",
      mpName: mp.name,
      sackedName: incumbent.name,
      postTitle: post.title,
      factionIn: mp.factionName,
      factionOut: incumbent.factionName,
    });
    if (scandal) {
      sittingEvents.push({
        type: "scandal",
        paper: scandal.paper,
        text: scandal.text,
        drop: scandal.drop,
      });
    }
    return lastOfferResult;
  }

  function drawLeaderClimate() {
    const u = Math.random();
    if (u < 0.56) return clamp(70 + gauss(11), 52, 94);
    if (u < 0.84) return clamp(44 + gauss(9), 24, 64);
    return clamp(26 + gauss(9), 6, 46);
  }

  function writeStandingForMp(mp, climate, hiveFaction) {
    const partyLeader = mp.party && mp.party.leader;
    const factionLeader = mp.factionLeader;
    const personalParty = leaderSatisfaction(mp, partyLeader, "party");
    const personalFaction = leaderSatisfaction(mp, factionLeader, "faction");
    if (mp === partyLeader) {
      mp.partyLeaderStanding = 100;
    } else if (partyLeader && areFeuding(mp, partyLeader)) {
      mp.partyLeaderStanding = clamp(0.22 * climate + 0.78 * personalParty, 0, 100);
    } else {
      mp.partyLeaderStanding = clamp(0.68 * climate + 0.32 * personalParty, 0, 100);
    }
    if (mp === factionLeader) {
      mp.factionLeaderStanding = 100;
    } else if (factionLeader && areFeuding(mp, factionLeader)) {
      mp.factionLeaderStanding = clamp(
        0.22 * hiveFaction + 0.78 * personalFaction,
        0,
        100
      );
    } else {
      mp.factionLeaderStanding = clamp(
        0.68 * hiveFaction + 0.32 * personalFaction,
        0,
        100
      );
    }
    factionLeaderStandingMap[mp.mpId] = mp.factionLeaderStanding;
    partyLeaderStandingMap[mp.mpId] = mp.partyLeaderStanding;
  }

  function refreshLeaderStandingForParty(party) {
    const climate = party.leaderStanding;
    const factionClimate = party.factionClimates || {};
    party.mpsInParty.forEach(function (mp) {
      writeStandingForMp(mp, climate, factionClimate[mp.factionId] || climate);
    });
  }

  function syncPmStanding() {
    const gov = getGovernment();
    pmStanding = Math.round(
      gov && gov.leaderStanding != null ? gov.leaderStanding : 50
    );
  }

  function applyPmStandingDrop(drop) {
    const gov = getGovernment();
    if (!gov) {
      pmStanding = clamp(pmStanding - drop, 0, 100);
      return;
    }
    gov.leaderStanding = clamp((gov.leaderStanding || 50) - drop, 0, 100);
    if (gov.factionClimates) {
      Object.keys(gov.factionClimates).forEach(function (fid) {
        gov.factionClimates[fid] = clamp(
          gov.factionClimates[fid] - drop * 0.8,
          0,
          100
        );
      });
    }
    refreshLeaderStandingForParty(gov);
    syncPmStanding();
  }

  function assignLeaderStanding() {
    factionLeaderStandingMap = {};
    partyLeaderStandingMap = {};
    partys.forEach(function (party) {
      const climate = drawLeaderClimate();
      party.leaderStanding = climate;
      const factionClimate = {};
      party.mpsInParty.forEach(function (mp) {
        const fid = mp.factionId;
        if (factionClimate[fid] == null) {
          factionClimate[fid] = clamp(
            0.8 * climate + 0.2 * (46 + gauss(14)),
            0,
            100
          );
        }
      });
      party.factionClimates = factionClimate;
      party.mpsInParty.forEach(function (mp) {
        writeStandingForMp(mp, climate, factionClimate[mp.factionId] || climate);
      });
    });
    syncPmStanding();
  }

  function finishParliamentSetup() {
    buildAffinity();
    overlayFeuds();
    buildFactions();
    assignLeaderStanding();
    assignCabinet();
  }

  function startNewParliament() {
    pmStanding = 50;
    offeredThisTurn = false;
    sittingEvents = [];
    lastOfferResult = null;
    feudSet = {};
    for (let i = 0; i < 140; i++) {
      generateParties(3);
      generateMps();
      if (!parliamentLooksCompetitive()) continue;
      finishParliamentSetup();
      if (getUnrepresentedFactions().length >= 2) return;
    }
    generateParties(3);
    generateMps();
    finishParliamentSetup();
  }

  function beginTurn() {
    offeredThisTurn = false;
    lastOfferResult = null;
  }

  function governmentSpectrum() {
    const bins = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    getGovernment().mpsInParty.forEach(function (mp) {
      bins[Math.min(9, Math.floor(mp.visiblePosition / 10))] += 1;
    });
    return bins;
  }

  function partySlug(name) {
    const party = partys.filter(function (p) {
      return p.name === name;
    })[0];
    if (party && party.slug) return party.slug;
    if (name === "Workers Party") return "workers";
    if (name === "Liberals") return "liberals";
    return "royalists";
  }

  function feudWhisper(mp) {
    if (!mp.feudWith.length) return "";
    const notable = mp.feudWith.filter(function (other) {
      return (
        other.party === mp.party &&
        (other.cabinetPost || other.factionLeader === other)
      );
    });
    const target = notable[0] || mp.feudWith[0];
    return "Does not speak to " + target.surname;
  }

  global.VocGame = {
    MP_COUNT,
    HOUSE_SIZE,
    MAJORITY,
    CABINET_POSTS,
    startNewParliament,
    beginTurn,
    getParties: function () {
      return partys;
    },
    getMps: function () {
      return mps;
    },
    getGovernment,
    getOpposition,
    getThirdParty,
    getWhipForecast,
    holdDivision,
    selWhipTargets,
    getUnrepresentedFactions,
    getRebelliousFactions,
    getCabinet,
    offerPost,
    acceptanceChance,
    chanceLabel,
    leakChance,
    getLike,
    areFeuding,
    getFactionLeaderStandingMap: function () {
      return factionLeaderStandingMap;
    },
    getPartyLeaderStandingMap: function () {
      return partyLeaderStandingMap;
    },
    getFactionLeaderStanding: function (mp) {
      return mp.factionLeaderStanding;
    },
    getPartyLeaderStanding: function (mp) {
      return mp.partyLeaderStanding;
    },
    getPartyLeaderStandingFor: function (party) {
      return party.leaderStanding;
    },
    budgetBn,
    budgetBand,
    formatBudget,
    seniorityBand,
    sleazeWhisper,
    prestigeLabel,
    grievanceLabel,
    loyaltyLabel,
    ambitionLabel,
    charismaLabel,
    cutsStance,
    voteLabel,
    feudWhisper,
    governmentSpectrum,
    partySlug,
    getPmStanding: function () {
      return pmStanding;
    },
    getPmPopularity: function () {
      return pmStanding;
    },
    hasOfferedThisTurn: function () {
      return offeredThisTurn;
    },
    getLastOffer: function () {
      return lastOfferResult;
    },
    getEvents: function () {
      return sittingEvents;
    },
  };
})(window);
