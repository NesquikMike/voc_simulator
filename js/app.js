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
  let cabinetOpen = false;
  let backbenchersOpen = false;
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
    return "Third party";
  }

  function majorityNeed() {
    return Math.max(0, VocGame.MAJORITY - (VocGame.getGovernment().numMps + 1));
  }

  function popularityChip() {
    return (
      '<span class="posts-chip">PM standing ' +
      VocGame.getPmPopularity() +
      "</span>"
    );
  }

  function offerChip() {
    return VocGame.hasOfferedThisTurn()
      ? '<span class="posts-chip">Reshuffle used this turn</span>'
      : '<span class="posts-chip">Reshuffle available</span>';
  }

  function renderCabinetTable() {
    const rows = VocGame.getCabinet()
      .map(function (row) {
        const mp = row.mp;
        const post = row.post;
        if (!mp) {
          return (
            "<tr><th>" +
            post.title +
            '</th><td colspan="6">Vacant</td></tr>'
          );
        }
        return (
          "<tr>" +
          "<th>" +
          post.title +
          "</th>" +
          "<td>" +
          mp.name +
          "</td>" +
          "<td>" +
          VocGame.loyaltyLabel(mp.visibleLoyalty) +
          "</td>" +
          "<td>" +
          VocGame.ambitionLabel(mp.visibleAmbition) +
          "</td>" +
          "<td>" +
          VocGame.grievanceLabel(mp.visibleGrievance) +
          "</td>" +
          "<td>" +
          VocGame.seniorityBand(mp.visibleSeniority) +
          "</td>" +
          "<td>" +
          mp.factionName +
          " <small>(" +
          mp.factionSize +
          ")</small></td>" +
          "</tr>"
        );
      })
      .join("");
    return (
      '<div class="cabinet-wrap">' +
      '<div class="cabinet-head">' +
      "<h3>Your cabinet</h3>" +
      '<button type="button" class="reveal-btn cabinet-toggle">' +
      (cabinetOpen ? "Hide cabinet" : "Show cabinet") +
      "</button></div>" +
      '<div class="cabinet-body"' +
      (cabinetOpen ? "" : " hidden") +
      ">" +
      '<table class="cabinet-table"><thead><tr>' +
      "<th>Post</th><th>Incumbent</th><th>Loyalty</th><th>Ambition</th><th>Grievance</th><th>Seniority</th><th>Faction</th>" +
      "</tr></thead><tbody>" +
      rows +
      "</tbody></table></div></div>"
    );
  }

  function bindCabinetToggle(root) {
    if (!root) return;
    const btn = root.querySelector(".cabinet-toggle");
    const body = root.querySelector(".cabinet-body");
    if (!btn || !body) return;
    btn.addEventListener("click", function () {
      cabinetOpen = !cabinetOpen;
      body.hidden = !cabinetOpen;
      btn.textContent = cabinetOpen ? "Hide cabinet" : "Show cabinet";
    });
  }

  function syncBackbencherToggle() {
    const btn = $("toggle-backbenchers");
    const body = $("backbencher-body");
    if (!btn || !body) return;
    body.hidden = !backbenchersOpen;
    btn.textContent = backbenchersOpen
      ? "Hide backbenchers of interest"
      : "Show backbenchers of interest";
  }

  function renderDashboard(mountIds, opts) {
    const parties = [
      VocGame.getGovernment(),
      VocGame.getOpposition(),
      VocGame.getThirdParty(),
    ];
    const government = VocGame.getGovernment();
    const need = majorityNeed();
    const govLine =
      need === 0
        ? "You have a bare majority on paper — rebels can still bring you down."
        : "You lead a minority government and need " +
          need +
          " votes from outside your party.";

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
      '<p class="leader-banner">You are the Party Leader of the ' +
      government.name +
      ". " +
      govLine +
      "</p>" +
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
            '<div class="role-tag">' +
            roleFor(party) +
            "</div>" +
            "<p>The " +
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
            '<div class="gauge-wrap"><div class="gauge-label"><span>Expansion</span><span>Cuts</span></div>' +
            numberLine(median) +
            "</div></article>"
          );
        })
        .join("") +
      "</div>" +
      (opts && opts.showCabinet ? renderCabinetTable() : "") +
      (opts && opts.showChamber === false ? "" : renderChamber());

    mountIds.forEach(function (id) {
      const el = $(id);
      el.innerHTML = html;
      bindCabinetToggle(el);
    });
  }

  function renderChamber() {
    const gov = VocGame.getGovernment();
    const opp = VocGame.getOpposition();
    const third = VocGame.getThirdParty();
    const rows = 6;

    function benches(members) {
      const rowHtml = [];
      for (let r = 0; r < rows; r++) rowHtml.push([]);
      members.forEach(function (mp, i) {
        const slug = VocGame.partySlug(mp.party.name);
        rowHtml[i % rows].push('<span class="mp-dot ' + slug + '"></span>');
      });
      return (
        '<div class="bench-side">' +
        rowHtml
          .map(function (row) {
            return '<div class="bench-row">' + row.join("") + "</div>";
          })
          .join("") +
        "</div>"
      );
    }

    const oppositionBench = opp.mpsInParty.concat(third.mpsInParty);
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
    const opp = VocGame.getOpposition();
    const third = VocGame.getThirdParty();
    const forecast = VocGame.getWhipForecast(policy, 1);
    const slugs = [gov, third, opp].map(function (party) {
      return {
        party: party,
        slug: VocGame.partySlug(party.name),
        ayes:
          party === gov
            ? forecast.government
            : party === opp
              ? forecast.opposition
              : forecast.third,
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
    const opp = VocGame.getOpposition();
    const third = VocGame.getThirdParty();
    $("policy-pins").innerHTML = [gov, third, opp]
      .map(function (party) {
        const median = party.getMedianMpPos();
        const label = party === gov ? "Yours" : party.name;
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
    cabinetOpen = false;
    backbenchersOpen = false;
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
        ". A reshuffle or a shift toward the third party might still save you."
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
    if (!selectedMp || !selectedPostId) {
      box.innerHTML =
        "<p>Pick a government backbencher above, then choose a cabinet post.</p>";
      btn.disabled = true;
      return;
    }
    const post = VocGame.CABINET_POSTS.find(function (p) {
      return p.id === selectedPostId;
    });
    const incumbent = VocGame.getCabinet().find(function (row) {
      return row.post.id === selectedPostId;
    }).mp;
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
      "</span><span>" +
      VocGame.getThirdParty().name +
      " " +
      forecast.third +
      "</span><span>Opposition " +
      forecast.opposition +
      "</span>" +
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
    renderDashboard(["jobs-dashboard"], { showTurns: true, showChamber: false });
    refreshWhipBox();
    $("cabinet-mount").innerHTML = renderCabinetTable();
    bindCabinetToggle($("cabinet-mount"));

    fenceMps = VocGame.selWhipTargets(16, currentProp);
    showingAllMps = false;
    syncBackbencherToggle();
    renderMpList();

    const postSelect = $("post-select");
    postSelect.innerHTML =
      '<option value="">Choose a cabinet post…</option>' +
      VocGame.CABINET_POSTS.map(function (post) {
        const holder = VocGame.getCabinet().find(function (row) {
          return row.post.id === post.id;
        }).mp;
        return (
          '<option value="' +
          post.id +
          '">' +
          post.title +
          " — currently " +
          (holder ? holder.name : "vacant") +
          " (" +
          VocGame.prestigeLabel(post.prestige) +
          ")</option>"
        );
      }).join("");
    postSelect.value = selectedPostId || "";
    postSelect.disabled = VocGame.hasOfferedThisTurn();
    renderOfferPreview();
    syncPatronageLock();

    $("next-prop").hidden = loop >= 2;
    showScreen("jobs");
  }

  function syncPatronageLock() {
    const spent = VocGame.hasOfferedThisTurn();
    const banner = $("patronage-spent");
    const offer = document.querySelector("#screen-jobs .offer-panel");
    if (banner) banner.hidden = !spent;
    if (offer) offer.hidden = spent;
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
    list.innerHTML =
      '<div class="list-head"><span>Name</span><span>Party / faction</span><span>On the cuts</span><span>Loyalty</span><span>Ambition / presence</span><span>Offer</span></div>' +
      visible
        .map(function (mp, i) {
          const canOffer = mp.party === government && !mp.cabinetPost;
          const outsider = VocGame.getUnrepresentedFactions().some(function (f) {
            return f.id === mp.factionId;
          });
          const chance = VocGame.voteLabel(mp.getProbSup(currentProp));
          const offerHtml = VocGame.hasOfferedThisTurn()
            ? '<p class="not-party">Patronage spent this turn</p>'
            : canOffer
            ? '<label class="offer"><input type="radio" name="backbencher" value="' +
              i +
              '"' +
              (selectedMp === mp ? " checked" : "") +
              "> Offer a post</label>"
            : '<p class="not-party">' +
              (mp.cabinetPost ? "Already on the payroll" : "Not in your party") +
              "</p>";
          return (
            '<article class="mp-card' +
            (outsider ? " outsider" : "") +
            '">' +
            "<div><h3>" +
            mp.name +
            '</h3><p class="mp-meta">' +
            mp.seat +
            " · " +
            VocGame.seniorityBand(mp.visibleSeniority) +
            " · " +
            chance +
            (outsider ? " · No ministers in this grouping" : "") +
            "</p></div>" +
            "<div>" +
            mp.party.name +
            " · " +
            mp.factionName +
            " (" +
            mp.factionSize +
            ")</div>" +
            "<div>" +
            VocGame.cutsStance(mp.visiblePosition) +
            " · " +
            VocGame.formatBudget(mp.visiblePosition) +
            "</div>" +
            "<div>" +
            VocGame.loyaltyLabel(mp.visibleLoyalty) +
            "</div>" +
            "<div>" +
            VocGame.ambitionLabel(mp.visibleAmbition) +
            " · " +
            VocGame.charismaLabel(mp.visibleCharisma) +
            "</div>" +
            offerHtml +
            "</article>"
          );
        })
        .join("");
    list.querySelectorAll('input[name="backbencher"]').forEach(function (radio) {
      radio.addEventListener("change", function (event) {
        const shown = showingAllMps
          ? fenceMps
          : fenceMps.slice(0, WHIP_LIST_SHORT);
        selectedMp = shown[Number(event.target.value)];
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
    cabinetOpen = false;
    backbenchersOpen = false;
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
    const opp = VocGame.getOpposition();
    const third = VocGame.getThirdParty();
    let breakdown =
      "<div>" +
      gov.name +
      " ayes<strong>" +
      result.byParty[gov.name] +
      "</strong>" +
      result.rebels +
      " rebels</div><div>" +
      third.name +
      " ayes<strong>" +
      result.byParty[third.name] +
      "</strong></div><div>" +
      opp.name +
      " ayes<strong>" +
      result.byParty[opp.name] +
      "</strong></div>";
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
  $("post-select").addEventListener("change", function (event) {
    selectedPostId = event.target.value || null;
    renderOfferPreview();
  });
  $("toggle-backbenchers").addEventListener("click", function () {
    backbenchersOpen = !backbenchersOpen;
    syncBackbencherToggle();
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
