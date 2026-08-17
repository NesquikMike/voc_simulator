/**
 * Vote of Confidence — game engine.
 *
 * The Java original used a huge intercept on the vote logit, so a
 * party-median policy almost always cleared 250 on the first try.
 * This version keeps the same structure (policy distance, loyalty,
 * ambition, government vs opposition) but is calibrated so most
 * sittings are hung or knife-edge, and backbenchers can rebel.
 */
(function (global) {
  const FORENAMES = GAME_DATA.forenames;
  const SURNAMES = GAME_DATA.surnames;
  const SEATS = GAME_DATA.seats;
  const MP_COUNT = 498;
  const HOUSE_SIZE = MP_COUNT + 1;
  const MAJORITY = 250;
  const CABINET_POSTS = 3;
  const MIN_PARTY_GAP = 12;
  const GOV_SEATS_MIN = 228;
  const GOV_SEATS_MAX = 255;

  function javaRandomInt(maxExclusive) {
    return Math.floor(Math.random() * maxExclusive);
  }

  function clamp0to100(n) {
    if (n < 0) return 0;
    if (n > 100) return 100;
    return n;
  }

  function noisyVisible(trueValue) {
    const eta = -5 + javaRandomInt(11);
    return clamp0to100(trueValue + eta);
  }

  function genRanNoRep(num, from, to) {
    const selFrom = [];
    for (let i = 0; i < to - from + 1; i++) {
      selFrom.push(from + i);
    }
    const sel = [];
    for (let i = 0; i < num; i++) {
      const x = javaRandomInt(to - from + 1 - i);
      const y = selFrom[x];
      selFrom.splice(x, 1);
      sel.push(y);
    }
    return sel;
  }

  class Party {
    constructor(id, position) {
      this.partyId = id;
      this.position = position;
      this.name = "";
      this.possessive = "";
      this.numMps = 0;
      this.mpsInParty = [];
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
    constructor(id, forename, surname, seat, ambition, loyalty, position, party) {
      this.mpId = id;
      this.forename = forename;
      this.surname = surname;
      this.seat = seat;
      this.ambition = ambition;
      this.visibleAmbition = noisyVisible(ambition);
      this.loyalty = loyalty;
      this.visibleLoyalty = noisyVisible(loyalty);
      this.position = position;
      this.visiblePosition = noisyVisible(position);
      this.party = party;
      this.governing = 0;
      this.opposition = 0;
      this.cabinetPost = false;
      party.increaseNumMps();
      mps.push(this);
      party.insertMp(this);
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

    getProbSup(x) {
      const dist = Math.abs(x - this.position);
      const inner =
        -0.055 * dist * (1 - this.governing) -
        0.075 * dist * this.opposition +
        (-0.03 * dist - 0.014 * this.ambition + 0.046 * this.loyalty) *
          this.governing +
        1.88 * this.governing +
        0.28 * (1 - this.governing) -
        1.55 * this.opposition +
        (this.cabinetPost ? 1.6 : 0);
      return 1 / (1 + Math.pow(Math.E, -inner));
    }

    getBinaryVote(p) {
      return Math.random() < p ? 1 : 0;
    }

    offerJob() {
      if (this.cabinetPost) return false;
      const x = Math.floor(0.45 * this.ambition) + 8;
      this.loyalty = this.loyalty + x > 100 ? 100 : this.loyalty + x;
      this.visibleLoyalty =
        this.visibleLoyalty + x > 100 ? 100 : this.visibleLoyalty + x;
      this.cabinetPost = true;
      return true;
    }
  }

  let partys = [];
  let mps = [];
  let postsRemaining = CABINET_POSTS;

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
    partys[1].name = "Liberals";
    partys[1].possessive = "have";
    partys[2].name = "Royalists";
    partys[2].possessive = "have";
  }

  function generateMps() {
    mps = [];
    for (let i = 0; i < MP_COUNT; i++) {
      const forename = FORENAMES[javaRandomInt(FORENAMES.length)];
      const surname = SURNAMES[javaRandomInt(SURNAMES.length)];
      const seat = SEATS[i];
      const amb = javaRandomInt(101);
      const loy = javaRandomInt(101);
      const pol = javaRandomInt(101);
      const party = getClosestParty(pol);
      new ParlMember(i, forename, surname, seat, amb, loy, pol, party);
    }
    for (let i = 0; i < MP_COUNT; i++) {
      mps[i].giveGovStatus();
    }
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
    let government = playerVote;
    let opposition = 0;
    let thirdAyes = 0;
    let rebels = 0;
    for (let i = 0; i < MP_COUNT; i++) {
      const mp = mps[i];
      const p = mp.getProbSup(x);
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
    };
  }

  function getExpVotesFor(x, playrVote) {
    return getWhipForecast(x, playrVote).total;
  }

  function holdDivision(x, playerVote) {
    const gov = getGovernment();
    const opp = getOpposition();
    const third = getThirdParty();
    const byParty = {};
    byParty[gov.name] = playerVote;
    byParty[opp.name] = 0;
    byParty[third.name] = 0;
    let total = playerVote;
    let rebels = 0;
    for (let i = 0; i < mps.length; i++) {
      const mp = mps[i];
      const vote = mp.getBinaryVote(mp.getProbSup(x));
      total += vote;
      byParty[mp.party.name] += vote;
      if (mp.party === gov && vote === 0) {
        rebels += 1;
      }
    }
    return {
      total: total,
      nos: HOUSE_SIZE - total,
      byParty: byParty,
      rebels: rebels,
    };
  }

  function addVotes(x, playrVote) {
    return holdDivision(x, playrVote).total;
  }

  function selWhipTargets(n, x) {
    const gov = getGovernment();
    const scored = [];
    for (let i = 0; i < MP_COUNT; i++) {
      const p = mps[i].getProbSup(x);
      if (p > 0.34 && p < 0.66) {
        scored.push({ mp: mps[i], p: p });
      }
    }
    scored.sort(function (a, b) {
      return Math.abs(a.p - 0.5) - Math.abs(b.p - 0.5);
    });
    const govRows = scored.filter(function (row) {
      return row.mp.party === gov && !row.mp.cabinetPost;
    });
    const otherRows = scored.filter(function (row) {
      return row.mp.party !== gov;
    });
    const picked = [];
    const seen = {};
    function take(row) {
      if (picked.length >= n || seen[row.mp.mpId]) return;
      seen[row.mp.mpId] = true;
      picked.push(row.mp);
    }
    govRows.slice(0, Math.min(7, n)).forEach(take);
    otherRows.forEach(take);
    govRows.forEach(take);
    return picked;
  }

  function startNewParliament() {
    postsRemaining = CABINET_POSTS;
    for (let i = 0; i < 140; i++) {
      generateParties(3);
      generateMps();
      if (parliamentLooksCompetitive()) {
        return;
      }
    }
    generateParties(3);
    generateMps();
  }

  function offerJobs(mpList) {
    let offered = 0;
    mpList.forEach(function (mp) {
      if (postsRemaining <= 0) return;
      if (mp && mp.offerJob()) {
        postsRemaining -= 1;
        offered += 1;
      }
    });
    return offered;
  }

  function partySlug(name) {
    if (name === "Workers Party") return "workers";
    if (name === "Liberals") return "liberals";
    return "royalists";
  }

  function governmentSpectrum() {
    const gov = getGovernment();
    const bins = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    gov.mpsInParty.forEach(function (mp) {
      const idx = Math.min(9, Math.floor(mp.visiblePosition / 10));
      bins[idx] += 1;
    });
    return bins;
  }

  global.VocGame = {
    MP_COUNT,
    HOUSE_SIZE,
    MAJORITY,
    CABINET_POSTS,
    startNewParliament,
    getParties: function () {
      return partys;
    },
    getMps: function () {
      return mps;
    },
    getGovernment,
    getOpposition,
    getThirdParty,
    getExpVotesFor,
    getWhipForecast,
    holdDivision,
    addVotes,
    selWhipTargets,
    offerJobs,
    governmentSpectrum,
    getPostsRemaining: function () {
      return postsRemaining;
    },
    partySlug,
  };
})(window);
