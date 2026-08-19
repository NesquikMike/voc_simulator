(function () {
  const $ = function (id) {
    return document.getElementById(id);
  };

  const screens = {
    start: $("screen-start"),
    info: $("screen-info"),
    proposal: $("screen-proposal"),
    jobs: $("screen-jobs"),
    reshuffle: $("screen-reshuffle"),
    result: $("screen-result"),
  };

  let loop = 0;
  let currentProp = 50;
  let fenceMps = [];
  let selectedMp = null;
  let selectedPostId = null;
  let showingAllMps = false;
  let infoCabinetOpen = false;
  let jobsCabinetOpen = false;
  let backbenchersOpen = false;
  let reshuffleOpen = false;
  const WHIP_LIST_SHORT = 5;

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].hidden = key !== name;
    });
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }

  function numberLine(value) {
    const x = 16.67 + (Number(value) / 100) * 66.66;
    return (
      '<svg class="number-line" viewBox="0 0 100 20" aria-hidden="true">' +
      '<line x1="16.67" y1="10" x2="83.33" y2="10"></line>' +
      '<line x1="50" y1="7" x2="50" y2="13"></line>' +
      '<circle cx="' +
      x +
      '" cy="10" r="4"></circle></svg>'
    );
  }

  function roleFor(party) {
    if (party === VocGame.getGovernment()) return "Government";
    if (party === VocGame.getOpposition()) return "Official Opposition";
    return "Minor party";
  }

  function majorityNeed() {
    return Math.max(0, VocGame.MAJORITY - (VocGame.getGovernment().numMps + 1));
  }

  function popularityChip() {
    return (
      '<span class="posts-chip">PM standing ' +
      VocGame.getPmStanding() +
      "</span>"
    );
  }

  function offerChip() {
    return VocGame.hasOfferedThisTurn()
      ? '<span class="posts-chip">Reshuffle used this turn</span>'
      : '<span class="posts-chip">Reshuffle available</span>';
  }

  function cardFacts(pairs) {
    return (
      '<dl class="card-facts">' +
      pairs
        .map(function (pair) {
          return "<dt>" + pair[0] + "</dt><dd>" + pair[1] + "</dd>";
        })
        .join("") +
      "</dl>"
    );
  }

  function cabinetCardHtml(row, selectable) {
    const post = row.post;
    const mp = row.mp;
    const selected = selectable && selectedPostId === post.id;
    const spent = VocGame.hasOfferedThisTurn();
    const tag = selectable ? "button" : "article";
    const attrs = selectable
      ? ' type="button" class="pick-card cabinet-card' +
        (selected ? " selected" : "") +
        '" data-post="' +
        post.id +
        '"' +
        (spent ? " disabled" : "")
      : ' class="pick-card cabinet-card"';
    if (!mp) {
      return (
        "<" +
        tag +
        attrs +
        "><h3>" +
        post.title +
        '</h3><p class="mp-meta">Vacant</p></' +
        tag +
        ">"
      );
    }
    return (
      "<" +
      tag +
      attrs +
      "><h3>" +
      post.title +
      '</h3><p class="mp-meta">' +
      mp.name +
      "</p>" +
      cardFacts([
        ["Loyalty", VocGame.loyaltyLabel(mp.visibleLoyalty)],
        ["Ambition", VocGame.ambitionLabel(mp.visibleAmbition)],
        ["Grievance", VocGame.grievanceLabel(mp.visibleGrievance)],
        ["Seniority", VocGame.seniorityBand(mp.visibleSeniority)],
        ["Faction", mp.factionName + " (" + mp.factionSize + ")"],
      ]) +
      "</" +
      tag +
      ">"
    );
  }

  function renderCabinetCards(opts) {
    const selectable = !!(opts && opts.selectable);
    const cards =
      '<div class="cabinet-cards">' +
      VocGame.getCabinet()
        .map(function (row) {
          return cabinetCardHtml(row, selectable);
        })
        .join("") +
      "</div>";
    if (opts && opts.withToggle === false) return cards;
    return (
      '<div class="cabinet-wrap">' +
      '<div class="cabinet-head">' +
      "<h3>Your cabinet</h3>" +
      '<button type="button" class="reveal-btn cabinet-toggle">' +
      (infoCabinetOpen ? "Hide cabinet" : "Show cabinet") +
      "</button></div>" +
      '<div class="cabinet-body"' +
      (infoCabinetOpen ? "" : " hidden") +
      ">" +
      cards +
      "</div></div>"
    );
  }

  function bindCabinetToggle(root) {
    if (!root) return;
    const btn = root.querySelector(".cabinet-toggle");
    const body = root.querySelector(".cabinet-body");
    if (!btn || !body) return;
    btn.addEventListener("click", function () {
      infoCabinetOpen = !infoCabinetOpen;
      body.hidden = !infoCabinetOpen;
      btn.textContent = infoCabinetOpen ? "Hide cabinet" : "Show cabinet";
    });
  }

  function bindCabinetPick() {
    const mount = $("cabinet-mount");
    if (!mount) return;
    mount.querySelectorAll("[data-post]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (VocGame.hasOfferedThisTurn()) return;
        selectedPostId = btn.getAttribute("data-post");
        mount.innerHTML = renderCabinetCards({
          selectable: true,
          withToggle: false,
        });
        bindCabinetPick();
        renderOfferPreview();
      });
    });
  }

  function syncReveal(btnId, bodyId, open, hideLabel, showLabel) {
    const btn = $(btnId);
    const body = $(bodyId);
    if (!btn || !body) return;
    body.hidden = !open;
    btn.textContent = open ? hideLabel : showLabel;
  }

  function syncReshuffleToggles() {
    syncReveal(
      "toggle-reshuffle",
      "reshuffle-body",
      reshuffleOpen,
      "Hide reshuffle",
      "Organise a reshuffle"
    );
    syncReveal(
      "toggle-backbenchers",
      "backbencher-body",
      backbenchersOpen,
      "Hide backbenchers",
      "Show backbenchers"
    );
    syncReveal(
      "toggle-cabinet",
      "cabinet-body",
      jobsCabinetOpen,
      "Hide cabinet ministers",
      "Show cabinet ministers"
    );
  }

  function leaderStandingCopy(party, government) {
    const score = Math.round(
      party.leaderStanding != null ? party.leaderStanding : 50
    );
    const leader = party.leader;
    const who = leader ? leader.name : "the leader";
    if (party === government) {
      if (score >= 72) return "The party is still broadly behind you.";
      if (score >= 55) {
        return "Most of the party will still have you, with a few grumbles.";
      }
      if (score >= 42) {
        return "Your standing with the party is mixed; the centre is unconvinced.";
      }
      if (score >= 28) return "The party is restive. Your standing is poor.";
      return "The party has largely gone off you.";
    }
    if (score >= 72) return "The party is still broadly behind " + who + ".";
    if (score >= 55) {
      return "Most of the party will still have " + who + ", with a few grumbles.";
    }
    if (score >= 42) {
      return "Support for " + who + " is mixed; the centre of the party is unconvinced.";
    }
    if (score >= 28) {
      return "The party is restive. " + who + "'s standing is poor.";
    }
    return "The party has largely gone off " + who + ".";
  }

  function renderPartyCards(parties, government) {
    return (
      '<div class="party-grid">' +
      parties
        .map(function (party) {
          const slug = VocGame.partySlug(party.name);
          const you = party === government ? " you" : "";
          const median = party.getMedianMpPos();
          return (
            '<article class="party-card' +
            you +
            '">' +
            '<p class="party-name"><span class="swatch ' +
            slug +
            '"></span>' +
            party.name +
            "</p>" +
            '<div class="role-tag ' +
            slug +
            '">' +
            roleFor(party) +
            "</div>" +
            '<p class="party-blurb">The ' +
            party.name +
            " " +
            party.possessive +
            " " +
            party.numMps +
            " MPs. Our reports indicate that a policy of " +
            VocGame.formatBudget(median) +
            " is most popular with " +
            party.name +
            " MPs.</p>" +
            '<p class="party-standing">' +
            leaderStandingCopy(party, government) +
            "</p>" +
            '<div class="gauge-wrap"><div class="gauge-label"><span>Expansion</span><span>Cuts</span></div>' +
            numberLine(median) +
            "</div></article>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderDashboard(mountIds, opts) {
    const parties = VocGame.getParties()
      .slice()
      .sort(function (a, b) {
        return b.numMps - a.numMps;
      });
    const government = VocGame.getGovernment();
    const need = majorityNeed();
    const govLine =
      need === 0
        ? "You have a bare majority on paper — rebels can still bring you down."
        : "You lead a minority government and need " +
          need +
          " votes from outside your party.";

    const leaderHtml =
      '<p class="leader-banner">You are the Party Leader of the ' +
      government.name +
      ". " +
      govLine +
      "</p>";

    const partyBlock =
      opts && opts.skipParties
        ? ""
        : renderPartyCards(parties, government);

    const html =
      (opts && opts.showTurns
        ? '<div class="turn-row"><div class="turn-pips">' +
          [0, 1, 2]
            .map(function (i) {
              const cls = i < loop ? "done" : i === loop ? "current" : "";
              return '<span class="pip ' + cls + '"></span>';
            })
            .join("") +
          "</div><span>Turn " +
          (loop + 1) +
          " of 3</span>" +
          '<span class="turn-chips">' +
          popularityChip() +
          offerChip() +
          "</span></div>"
        : "") +
      leaderHtml +
      partyBlock +
      (opts && opts.showCabinet ? renderCabinetCards() : "") +
      (opts && opts.showChamber === false ? "" : renderChamber());

    mountIds.forEach(function (id) {
      const el = $(id);
      el.innerHTML = html;
      bindCabinetToggle(el);
    });
  }

  function renderChamber() {
    const gov = VocGame.getGovernment();
    const others = VocGame.getParties()
      .slice()
      .filter(function (p) {
        return p !== gov;
      })
      .sort(function (a, b) {
        return b.numMps - a.numMps;
      });

    function benches(members) {
      const grouped = [];
      const order = [];
      members.forEach(function (mp) {
        const id = mp.party.partyId;
        if (!grouped[id]) {
          grouped[id] = [];
          order.push(id);
        }
        grouped[id].push(mp);
      });
      order.sort(function (a, b) {
        return grouped[b].length - grouped[a].length;
      });
      const dots = [];
      order.forEach(function (id) {
        grouped[id].forEach(function (mp) {
          dots.push(
            '<span class="mp-dot ' + VocGame.partySlug(mp.party.name) + '"></span>'
          );
        });
      });
      return '<div class="bench-side">' + dots.join("") + "</div>";
    }

    const oppositionBench = others.reduce(function (list, party) {
      return list.concat(party.mpsInParty);
    }, []);
    return (
      '<div class="chamber"><p class="chamber-label">The House</p>' +
      '<div class="benches">' +
      "<div>" +
      benches(oppositionBench) +
      '<p class="side-caption">Opposition</p></div>' +
      '<div class="gangway" title="The floor of the House"></div>' +
      "<div>" +
      benches(gov.mpsInParty) +
      '<p class="side-caption">Government</p></div></div></div>'
    );
  }

  function warmth(count, of) {
    if (of <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((count / of) * 100)));
  }

  function leanPhrase(pct) {
    if (pct >= 70) return "Mostly with you";
    if (pct >= 50) return "Divided, slight advantage";
    if (pct >= 35) return "On the fence";
    if (pct >= 20) return "Mostly against";
    return "Hostile";
  }

  function renderProposalAids(policy) {
    const gov = VocGame.getGovernment();
    const forecast = VocGame.getWhipForecast(policy, 1);
    const slugs = VocGame.getParties()
      .slice()
      .sort(function (a, b) {
        return b.numMps - a.numMps;
      })
      .map(function (party) {
        return {
          party: party,
          slug: VocGame.partySlug(party.name),
          ayes: forecast.byParty[party.name] || 0,
        };
      });

    $("proposal-lean").innerHTML = slugs
      .map(function (row) {
        const total = row.party === gov ? row.party.numMps + 1 : row.party.numMps;
        const pct = warmth(row.ayes, total);
        return (
          '<article class="lean-card"><h3>' +
          row.party.name +
          '</h3><div class="lean-track"><div class="lean-fill ' +
          row.slug +
          '" style="width:' +
          pct +
          '%"></div></div><p>' +
          leanPhrase(pct) +
          "</p></article>"
        );
      })
      .join("");

    const bins = VocGame.governmentSpectrum();
    const maxBin = Math.max.apply(null, bins.concat([1]));
    $("proposal-lean").insertAdjacentHTML(
      "beforeend",
      '<article class="lean-card" style="grid-column:1/-1"><h3>Your backbenches on the cuts</h3>' +
        '<div class="spectrum">' +
        bins
          .map(function (n) {
            return '<span style="height:' + Math.max(8, (n / maxBin) * 42) + 'px"></span>';
          })
          .join("") +
        "</div><p>Expansion sits on the left of this chart, cuts on the right. A settlement far from the bulge costs you rebels.</p></article>"
    );
  }

  function updateBudgetReadout(value) {
    $("policy-value").textContent =
      VocGame.formatBudget(value) + " — " + VocGame.budgetBand(value);
  }

  function renderPolicyPins() {
    const gov = VocGame.getGovernment();
    $("policy-pins").innerHTML = VocGame.getParties()
      .slice()
      .sort(function (a, b) {
        return b.numMps - a.numMps;
      })
      .map(function (party) {
        const median = party.getMedianMpPos();
        const label =
          (party === gov ? "Yours" : party.name) + " (" + party.numMps + ")";
        return (
          '<span class="policy-pin ' +
          VocGame.partySlug(party.name) +
          '" style="--pos:' +
          median +
          '%">' +
          '<span class="policy-pin-name">' +
          label +
          '</span><span class="policy-pin-value">' +
          VocGame.formatBudget(median) +
          '</span><span class="policy-pin-track" aria-hidden="true">' +
          '<span class="policy-pin-mark"></span></span></span>'
        );
      })
      .join("");
  }

  function startGame() {
    VocGame.startNewParliament();
    loop = 0;
    currentProp = VocGame.getGovernment().getMedianMpPos();
    selectedMp = null;
    selectedPostId = null;
    infoCabinetOpen = false;
    jobsCabinetOpen = false;
    backbenchersOpen = false;
    reshuffleOpen = false;
    renderDashboard(["info-dashboard"], { showTurns: false, showCabinet: true });
    showScreen("info");
  }

  function openProposal() {
    VocGame.beginTurn();
    selectedMp = null;
    selectedPostId = null;
    renderDashboard(["proposal-dashboard"], {
      showTurns: true,
      showChamber: false,
      skipParties: true,
    });
    $("policy-slider").value = String(currentProp);
    updateBudgetReadout(currentProp);
    $("proposal-button").textContent =
      loop === 2
        ? "Submit this settlement for the House to divide on"
        : "Submit this settlement to the whips";
    renderPolicyPins();
    renderProposalAids(currentProp);
    showScreen("proposal");
  }

  function whipTone(total) {
    if (total <= VocGame.MAJORITY - 8) return "short";
    if (total < VocGame.MAJORITY + 6) return "close";
    return "ahead";
  }

  function whipHeadline(forecast) {
    if (forecast.shortfall > 15) {
      return "We have not got the numbers. This settlement will fall unless you move.";
    }
    if (forecast.shortfall > 0) {
      return (
        "Short by " +
        forecast.shortfall +
        ". A reshuffle or a shift toward a minor party might still save you."
      );
    }
    if (forecast.shortfall > -8) {
      return "Knife-edge. Expected rebels could still do for us in the lobbies.";
    }
    return "Comfortable on paper — but a well-organised rebellion could yet spoil it.";
  }

  function leakBand(p) {
    if (p >= 0.55) return "high risk of a briefing";
    if (p >= 0.3) return "some risk of a briefing";
    return "unlikely to leak";
  }

  function renderOfferPreview() {
    const box = $("offer-preview");
    const btn = $("offer-btn");
    if (VocGame.hasOfferedThisTurn()) {
      box.innerHTML = "<p>You have already used this turn's reshuffle.</p>";
      btn.disabled = true;
      return;
    }
    if (!selectedMp && !selectedPostId) {
      box.innerHTML =
        "<p>Select a backbencher and a cabinet minister.</p>";
      btn.disabled = true;
      return;
    }
    if (!selectedMp) {
      box.innerHTML =
        "<p>Now select a government backbencher to offer the post to.</p>";
      btn.disabled = true;
      return;
    }
    if (!selectedPostId) {
      box.innerHTML =
        "<p>Now select a cabinet minister whose post you will offer.</p>";
      btn.disabled = true;
      return;
    }
    const post = VocGame.CABINET_POSTS.find(function (p) {
      return p.id === selectedPostId;
    });
    const incumbentRow = VocGame.getCabinet().find(function (row) {
      return row.post.id === selectedPostId;
    });
    const incumbent = incumbentRow && incumbentRow.mp;
    if (!post || !incumbent) {
      box.innerHTML = "<p>That post cannot be offered.</p>";
      btn.disabled = true;
      return;
    }
    const chance = VocGame.acceptanceChance(selectedMp, post);
    const takeJob =
      chance >= 0.7
        ? "is likely to <strong>accept the post</strong>"
        : chance >= 0.4
          ? "is a toss-up to <strong>accept the post</strong>"
          : "is a long shot to <strong>accept the post</strong>";
    box.innerHTML =
      "<p>The Chief Whip thinks <strong>" +
      selectedMp.name +
      "</strong> " +
      takeJob +
      " if offered <strong>" +
      post.title +
      "</strong>.</p>" +
      "<p>It would mean sacking <strong>" +
      incumbent.name +
      "</strong> of " +
      incumbent.factionName +
      ", who is " +
      VocGame.grievanceLabel(incumbent.visibleGrievance).toLowerCase() +
      " and a " +
      leakBand(VocGame.leakChance(incumbent)) +
      ".</p>";
    btn.disabled = false;
  }

  function refreshWhipBox() {
    const forecast = VocGame.getWhipForecast(currentProp, 1);
    const majorityPct = Math.min(100, (forecast.total / VocGame.HOUSE_SIZE) * 100);
    $("whip-expected").textContent = String(forecast.total);
    $("whip-expected").parentElement.className =
      "whip-number " + whipTone(forecast.total);
    $("majority-fill").style.width = majorityPct + "%";
    $("whip-note").textContent = whipHeadline(forecast);
    $("whip-stats").innerHTML =
      "<span>Your party " +
      forecast.government +
      "</span><span>Rebels ~" +
      forecast.rebels +
      "</span>" +
      VocGame.getParties()
        .filter(function (p) {
          return p !== VocGame.getGovernment();
        })
        .sort(function (a, b) {
          return b.numMps - a.numMps;
        })
        .map(function (p) {
          return (
            "<span>" +
            p.name +
            " " +
            Math.floor(forecast.byParty[p.name] || 0) +
            "</span>"
          );
        })
        .join("") +
      popularityChip();

    const outsiders = VocGame.getUnrepresentedFactions();
    const factionEl = $("whip-factions");
    if (outsiders.length) {
      factionEl.innerHTML =
        "No ministers from " +
        outsiders
          .map(function (f) {
            return (
              "<strong>" +
              f.name +
              "</strong> (" +
              f.members.length +
              ", led by " +
              f.leader.name +
              ")"
            );
          })
          .join("; ") +
        ". Offer one of theirs a post and the grouping may come with them.";
    } else {
      factionEl.textContent = "";
    }

    const rebels = VocGame.getRebelliousFactions(currentProp).slice(0, 3);
    const rebelEl = $("whip-rebels");
    if (rebels.length) {
      rebelEl.innerHTML =
        "Most likely to rebel: " +
        rebels
          .map(function (f) {
            return (
              "<strong>" +
              f.name +
              "</strong> (~" +
              f.expectedRebels +
              " of " +
              f.size +
              ", led by " +
              f.leader.name +
              ")"
            );
          })
          .join("; ") +
        ".";
    } else {
      rebelEl.textContent = "No grouping looks especially mutinous on this wording.";
    }
  }

  function openJobs() {
    currentProp = Number($("policy-slider").value);
    renderDashboard(["jobs-dashboard"], {
      showTurns: true,
      showChamber: false,
    });
    refreshWhipBox();
    $("cabinet-mount").innerHTML = renderCabinetCards({
      selectable: true,
      withToggle: false,
    });
    bindCabinetPick();

    fenceMps = VocGame.selWhipTargets(16, currentProp);
    showingAllMps = false;
    syncReshuffleToggles();
    renderMpList();
    renderOfferPreview();
    syncPatronageLock();

    $("next-prop").hidden = loop >= 2;
    showScreen("jobs");
  }

  function syncPatronageLock() {
    const spent = VocGame.hasOfferedThisTurn();
    const banner = $("patronage-spent");
    const wrap = document.querySelector("#screen-jobs .whip-list-wrap");
    if (banner) banner.hidden = !spent;
    if (wrap) wrap.hidden = spent;
    if (spent) {
      reshuffleOpen = false;
      backbenchersOpen = false;
      jobsCabinetOpen = false;
      syncReshuffleToggles();
    }
    $("next-prop").classList.toggle("reveal-btn", spent && loop < 2);
  }

  function renderMpList() {
    const government = VocGame.getGovernment();
    const list = $("mp-list");
    const moreBtn = $("show-more-mps");
    if (fenceMps.length === 0) {
      list.innerHTML =
        '<p class="empty-fence">No obvious waverers on this settlement. Try moving the cuts.</p>';
      moreBtn.hidden = true;
      return;
    }
    const visible = showingAllMps
      ? fenceMps
      : fenceMps.slice(0, WHIP_LIST_SHORT);
    const spent = VocGame.hasOfferedThisTurn();
    list.innerHTML = visible
      .map(function (mp, i) {
        const canOffer = mp.party === government && !mp.cabinetPost && !spent;
        const outsider = VocGame.getUnrepresentedFactions().some(function (f) {
          return f.id === mp.factionId;
        });
        const chance = VocGame.voteLabel(mp.getProbSup(currentProp));
        const selected = selectedMp === mp;
        const tag = canOffer ? "button" : "article";
        const attrs =
          (canOffer ? ' type="button"' : "") +
          ' class="pick-card mp-card' +
          (outsider ? " outsider" : "") +
          (selected ? " selected" : "") +
          '"' +
          (canOffer ? ' data-mp="' + i + '"' : "");
        const lockNote = canOffer
          ? ""
          : '<p class="not-party">' +
            (spent
              ? "Patronage spent this turn"
              : mp.cabinetPost
                ? "Already on the payroll"
                : "Not in your party") +
            "</p>";
        return (
          "<" +
          tag +
          attrs +
          "><h3>" +
          mp.name +
          '</h3><p class="mp-meta">' +
          mp.seat +
          " · " +
          chance +
          (outsider ? " · No ministers in this grouping" : "") +
          "</p>" +
          cardFacts([
            [
              "Party / faction",
              mp.party.name +
                " · " +
                mp.factionName +
                " (" +
                mp.factionSize +
                ")",
            ],
            [
              "On the cuts",
              VocGame.cutsStance(mp.visiblePosition) +
                " · " +
                VocGame.formatBudget(mp.visiblePosition),
            ],
            ["Loyalty", VocGame.loyaltyLabel(mp.visibleLoyalty)],
            ["Ambition", VocGame.ambitionLabel(mp.visibleAmbition)],
            ["Presence", VocGame.charismaLabel(mp.visibleCharisma)],
            ["Seniority", VocGame.seniorityBand(mp.visibleSeniority)],
          ]) +
          lockNote +
          "</" +
          tag +
          ">"
        );
      })
      .join("");
    list.querySelectorAll("[data-mp]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const shown = showingAllMps
          ? fenceMps
          : fenceMps.slice(0, WHIP_LIST_SHORT);
        selectedMp = shown[Number(btn.getAttribute("data-mp"))];
        renderMpList();
        renderOfferPreview();
      });
    });
    moreBtn.hidden = showingAllMps || fenceMps.length <= WHIP_LIST_SHORT;
    moreBtn.textContent =
      "Show " + (fenceMps.length - WHIP_LIST_SHORT) + " more backbenchers";
  }

  function makeOffer() {
    if (!selectedMp || !selectedPostId) return;
    const result = VocGame.offerPost(selectedMp, selectedPostId);
    selectedMp = null;
    selectedPostId = null;
    openReshuffle(result && result.ok ? result : VocGame.getLastOffer());
  }

  function openReshuffle(result) {
    const heading = $("reshuffle-heading");
    const lede = $("reshuffle-lede");
    const paper = $("reshuffle-newspaper");
    if (!result) {
      heading.textContent = "Reshuffle";
      lede.textContent = "Nothing came of it.";
      paper.hidden = true;
    } else if (!result.accepted) {
      heading.textContent = "A snub";
      lede.innerHTML =
        "<strong>" +
        result.mp.name +
        "</strong> has declined to become " +
        result.post.title +
        ". <strong>" +
        result.incumbent.name +
        "</strong> stays in post.";
      paper.hidden = true;
    } else {
      heading.textContent = "Reshuffle";
      lede.innerHTML =
        "<strong>" +
        result.mp.name +
        "</strong> takes " +
        result.post.title +
        ". <strong>" +
        result.incumbent.name +
        "</strong> returns to the backbenches — " +
        result.incumbent.factionName +
        " will not thank you.";
      if (result.scandal) {
        paper.hidden = false;
        paper.className = "newspaper leaked";
        paper.innerHTML =
          "<h3>" +
          result.scandal.paper +
          "</h3><p>" +
          result.scandal.text +
          '</p><p class="scandal-drop">PM standing −' +
          result.scandal.drop +
          "</p>";
      } else {
        paper.hidden = true;
      }
    }
    const forecast = VocGame.getWhipForecast(currentProp, 1);
    $("reshuffle-expected").textContent = String(forecast.total);
    $("reshuffle-whip").textContent = whipHeadline(forecast);
    const rebels = VocGame.getRebelliousFactions(currentProp).slice(0, 3);
    $("reshuffle-factions").innerHTML = rebels.length
      ? "Most likely to rebel now: " +
        rebels
          .map(function (f) {
            return (
              "<strong>" +
              f.name +
              "</strong> (~" +
              f.expectedRebels +
              " of " +
              f.size +
              ")"
            );
          })
          .join("; ") +
        "."
      : "No grouping looks especially mutinous on this wording.";
    showScreen("reshuffle");
  }

  function continueAfterReshuffle() {
    jobsCabinetOpen = false;
    backbenchersOpen = false;
    reshuffleOpen = false;
    selectedMp = null;
    selectedPostId = null;
    openJobs();
  }

  function goToVote() {
    const result = VocGame.holdDivision(currentProp, 1);
    const won = result.total > 249;
    $("screen-result").classList.toggle("lost", !won);
    $("result-heading").textContent = won
      ? "The ayes have it! The ayes have it!"
      : "The nos have it! The nos have it!";
    $("aye-count").textContent = String(result.total);
    $("no-count").textContent = String(result.nos);
    $("result-copy").textContent = won
      ? result.rebels > 15
        ? "You survived — but " +
          result.rebels +
          " of your own MPs voted against you."
        : "Well done. You survived your vote of confidence."
      : "Your government has been ousted...";
    $("result-tally").textContent =
      result.total +
      " ayes for the NHS settlement. " +
      result.nos +
      " noes." +
      (result.total >= VocGame.MAJORITY
        ? " Majority of " + (result.total - result.nos) + "."
        : " Defeated by " + (VocGame.MAJORITY - result.total) + ".");
    const gov = VocGame.getGovernment();
    let breakdown = VocGame.getParties()
      .slice()
      .sort(function (a, b) {
        return b.numMps - a.numMps;
      })
      .map(function (p) {
        return (
          "<div>" +
          p.name +
          " ayes<strong>" +
          Math.round(result.byParty[p.name] || 0) +
          "</strong>" +
          (p === gov ? result.rebels + " rebels" : "") +
          "</div>"
        );
      })
      .join("");
    const events = VocGame.getEvents();
    if (events.length) {
      breakdown +=
        '<div class="sitting-log" style="grid-column:1/-1"><h3>This sitting</h3>' +
        events
          .map(function (ev) {
            if (ev.type === "refuse") {
              return "<p>" + ev.mpName + " refused " + ev.postTitle + ".</p>";
            }
            if (ev.type === "reshuffle") {
              return (
                "<p>" +
                ev.mpName +
                " took " +
                ev.postTitle +
                " from " +
                ev.sackedName +
                " (" +
                ev.factionOut +
                ").</p>"
              );
            }
            return (
              "<p><em>" +
              ev.paper +
              ":</em> " +
              ev.text +
              " Standing −" +
              ev.drop +
              ".</p>"
            );
          })
          .join("") +
        "</div>";
    }
    $("result-breakdown").innerHTML = breakdown;
    showScreen("result");
  }

  $("btn-start").addEventListener("click", startGame);
  $("btn-propose").addEventListener("click", openProposal);
  $("policy-slider").addEventListener("input", function (event) {
    const value = Number(event.target.value);
    updateBudgetReadout(value);
    renderProposalAids(value);
  });
  $("proposal-button").addEventListener("click", openJobs);
  $("toggle-reshuffle").addEventListener("click", function () {
    reshuffleOpen = !reshuffleOpen;
    syncReshuffleToggles();
  });
  $("toggle-backbenchers").addEventListener("click", function () {
    backbenchersOpen = !backbenchersOpen;
    syncReshuffleToggles();
  });
  $("toggle-cabinet").addEventListener("click", function () {
    jobsCabinetOpen = !jobsCabinetOpen;
    syncReshuffleToggles();
  });
  $("show-more-mps").addEventListener("click", function () {
    showingAllMps = true;
    renderMpList();
  });
  $("offer-btn").addEventListener("click", makeOffer);
  $("reshuffle-continue").addEventListener("click", continueAfterReshuffle);
  $("next-prop").addEventListener("click", function () {
    loop += 1;
    openProposal();
  });
  $("go-vote").addEventListener("click", goToVote);
  $("btn-reset").addEventListener("click", function () {
    showScreen("start");
  });
})();
