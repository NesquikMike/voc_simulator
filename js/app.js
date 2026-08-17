(function () {
  const $ = (id) => document.getElementById(id);

  const screens = {
    start: $("screen-start"),
    info: $("screen-info"),
    proposal: $("screen-proposal"),
    jobs: $("screen-jobs"),
    result: $("screen-result"),
  };

  let loop = 0;
  let currentProp = 50;
  let fenceMps = [];

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].hidden = key !== name;
    });
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

  function postsLabel() {
    const left = VocGame.getPostsRemaining();
    return (
      left +
      " ministerial post" +
      (left === 1 ? "" : "s") +
      " left"
    );
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
          '<span class="posts-chip">' +
          postsLabel() +
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
            " MPs, and " +
            party.possessive +
            " a median policy:</p>" +
            '<div class="gauge-wrap"><div class="gauge-label"><span>Left</span><span>Right</span></div>' +
            numberLine(party.getMedianMpPos()) +
            "</div></article>"
          );
        })
        .join("") +
      "</div>" +
      (opts && opts.showChamber === false ? "" : renderChamber());

    mountIds.forEach(function (id) {
      $(id).innerHTML = html;
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
        ayes: party === gov ? forecast.government : party === opp ? forecast.opposition : forecast.third,
      };
    });

    $("proposal-lean").innerHTML = slugs
      .map(function (row) {
        const total = row.party === gov ? row.party.numMps + 1 : row.party.numMps;
        const pct = warmth(row.ayes, total);
        return (
          '<article class="lean-card"><h3>' +
          row.party.name +
          "</h3><div class=\"lean-track\"><div class=\"lean-fill " +
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
      '<article class="lean-card" style="grid-column:1/-1"><h3>Your backbenches</h3>' +
        '<div class="spectrum">' +
        bins
          .map(function (n) {
            return '<span style="height:' + Math.max(8, (n / maxBin) * 42) + 'px"></span>';
          })
          .join("") +
        "</div><p>Left of your party sits on the left of this chart. A policy far from the bulge costs you rebels.</p></article>"
    );
  }

  function renderPolicyPins() {
    const gov = VocGame.getGovernment();
    const opp = VocGame.getOpposition();
    const third = VocGame.getThirdParty();
    $("policy-pins").innerHTML = [gov, third, opp]
      .map(function (party) {
        const median = party.getMedianMpPos();
        return (
          '<span class="policy-pin ' +
          VocGame.partySlug(party.name) +
          '" style="left:' +
          median +
          '%">' +
          (party === gov ? "Yours" : party.name) +
          "</span>"
        );
      })
      .join("");
  }

  function startGame() {
    VocGame.startNewParliament();
    loop = 0;
    currentProp = VocGame.getGovernment().getMedianMpPos();
    renderDashboard(["info-dashboard"], { showTurns: false });
    showScreen("info");
  }

  function openProposal() {
    renderDashboard(["proposal-dashboard"], { showTurns: true, showChamber: false });
    $("policy-slider").value = String(currentProp);
    $("policy-value").textContent = String(currentProp);
    $("proposal-button").textContent =
      loop === 2
        ? "Submit your final policy proposal for the House to vote on"
        : "Submit an initial policy proposal";
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
      return "We have not got the numbers. This motion will fall unless you move.";
    }
    if (forecast.shortfall > 0) {
      return (
        "Short by " +
        forecast.shortfall +
        ". Patronage or a shift toward the third party might still save you."
      );
    }
    if (forecast.shortfall > -8) {
      return "Knife-edge. Expected rebels could still do for us in the lobbies.";
    }
    return "Comfortable on paper — but a well-organised rebellion could yet spoil it.";
  }

  function openJobs() {
    currentProp = Number($("policy-slider").value);
    renderDashboard(["jobs-dashboard"], { showTurns: true, showChamber: false });
    const forecast = VocGame.getWhipForecast(currentProp, 1);
    const majorityPct = Math.min(100, (forecast.total / VocGame.HOUSE_SIZE) * 100);
    $("whip-expected").textContent = String(forecast.total);
    $("whip-expected").parentElement.className = "whip-number " + whipTone(forecast.total);
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
      "</span><span>" +
      postsLabel() +
      "</span>";

    fenceMps = VocGame.selWhipTargets(12, currentProp);
    const government = VocGame.getGovernment();
    const list = $("mp-list");
    if (fenceMps.length === 0) {
      list.innerHTML =
        '<p class="empty-fence">No obvious waverers on this wording. Try moving the policy.</p>';
    } else {
      list.innerHTML =
        '<div class="list-head"><span>Name</span><span>Party</span><span>Political position</span><span>Loyalty</span><span>Ambition</span><span>Ministerial post</span></div>' +
        fenceMps
          .map(function (mp, i) {
            const canOffer =
              mp.party === government &&
              !mp.cabinetPost &&
              VocGame.getPostsRemaining() > 0;
            const offerHtml = canOffer
              ? '<label class="offer"><input type="checkbox" name="minister-offer" value="' +
                i +
                '"> Offer a post</label>'
              : '<p class="not-party">' +
                (mp.cabinetPost ? "Already on the payroll" : "Not in your party") +
                "</p>";
            return (
              '<article class="mp-card">' +
              "<div><h3>" +
              mp.name +
              '</h3><p class="mp-meta">' +
              mp.seat +
              "</p></div>" +
              "<div>" +
              mp.party.name +
              "</div>" +
              '<div class="stat-col"><div class="gauge-label"><span>Left</span><span>Right</span></div>' +
              numberLine(mp.visiblePosition) +
              "</div>" +
              '<div class="stat-col"><div class="gauge-label"><span>Disloyal</span><span>Loyal</span></div>' +
              numberLine(mp.visibleLoyalty) +
              "</div>" +
              '<div class="stat-col"><div class="gauge-label"><span>Unambitious</span><span>Ambitious</span></div>' +
              numberLine(mp.visibleAmbition) +
              "</div>" +
              offerHtml +
              "</article>"
            );
          })
          .join("");
      list.querySelectorAll('input[name="minister-offer"]').forEach(function (box) {
        box.addEventListener("change", syncPostCheckboxes);
      });
      syncPostCheckboxes();
    }

    $("next-prop").hidden = loop >= 2;
    showScreen("jobs");
  }

  function syncPostCheckboxes() {
    const boxes = Array.prototype.slice.call(
      document.querySelectorAll('input[name="minister-offer"]')
    );
    const checked = boxes.filter(function (box) {
      return box.checked;
    }).length;
    const left = VocGame.getPostsRemaining();
    boxes.forEach(function (box) {
      if (!box.checked) {
        box.disabled = checked >= left;
      }
    });
  }

  function applySelectedJobs() {
    const selected = Array.prototype.slice.call(
      document.querySelectorAll('input[name="minister-offer"]:checked')
    );
    const mps = selected.map(function (box) {
      return fenceMps[Number(box.value)];
    });
    VocGame.offerJobs(mps);
  }

  function goToVote() {
    applySelectedJobs();
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
      " votes to the right. " +
      result.nos +
      " votes to the left." +
      (result.total >= VocGame.MAJORITY
        ? " Majority of " + (result.total - result.nos) + "."
        : " Defeated by " + (VocGame.MAJORITY - result.total) + ".");
    const gov = VocGame.getGovernment();
    const opp = VocGame.getOpposition();
    const third = VocGame.getThirdParty();
    $("result-breakdown").innerHTML =
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
    showScreen("result");
  }

  $("btn-start").addEventListener("click", startGame);
  $("btn-propose").addEventListener("click", openProposal);
  $("policy-slider").addEventListener("input", function (event) {
    const value = Number(event.target.value);
    $("policy-value").textContent = String(value);
    renderProposalAids(value);
  });
  $("proposal-button").addEventListener("click", openJobs);
  $("next-prop").addEventListener("click", function () {
    applySelectedJobs();
    loop += 1;
    openProposal();
  });
  $("go-vote").addEventListener("click", goToVote);
  $("btn-reset").addEventListener("click", function () {
    showScreen("start");
  });
})();
