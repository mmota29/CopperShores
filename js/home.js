// js/home.js
document.addEventListener("DOMContentLoaded", () => {
  const backend = window.copperShoresBackend;
  if (!backend) {
    console.error("Copper Shores backend not found.");
    return;
  }

  // --- Grab DOM elements ---
  const titleEl = document.getElementById("campaign-title");
  const dmEl = document.getElementById("dm-name");
  const partyList = document.getElementById("party-list");
  const rosterList = document.getElementById("roster-list");
  const navContainer = document.getElementById("nav-buttons");

  const homeView = document.getElementById("home-view");
  const rosterView = document.getElementById("roster-view");

  // --- Render title ---
  if (titleEl) {
    titleEl.textContent = backend.getCampaignName();
  }

  // --- Render DM ---
  const dm = backend.getDungeonMaster();
  if (dmEl) {
    dmEl.textContent = dm.name || "Unknown";
  }

  // --- Party / roster rendering helper ---
  const party = backend.getPartyMembers();

  function fillList(listEl) {
    if (!listEl) return;
    listEl.innerHTML = "";
    party.forEach(member => {
      const li = document.createElement("li");
      li.className = "list-item";
      li.innerHTML = `
        <span class="char-name">${member.character}</span>
        <span class="player-name">– ${member.player}</span>
      `;
      listEl.appendChild(li);
    });
  }

  fillList(partyList);
  fillList(rosterList);

  // --- View switching ---
  function setActiveView(route) {
    // Show/hide views
    if (homeView && rosterView) {
      if (route === "roster") {
        homeView.classList.add("hidden");
        rosterView.classList.remove("hidden");
      } else {
        rosterView.classList.add("hidden");
        homeView.classList.remove("hidden");
      }
    }

    // Highlight active nav button
    if (navContainer) {
      const allNavBtns = navContainer.querySelectorAll(".nav-btn");
      allNavBtns.forEach(btn => {
        const btnRoute = btn.getAttribute("data-route");
        btn.classList.toggle("active", btnRoute === route);
      });
    }
  }

  // --- Navigation buttons ---
  const navButtonsData = backend.getNavigationButtons();

  if (navContainer) {
    navContainer.innerHTML = "";
    navButtonsData.forEach(btnData => {
      const b = document.createElement("button");
      b.className = "nav-btn";
      b.type = "button";
      b.textContent = btnData.label;
      b.setAttribute("data-route", btnData.route);

      b.addEventListener("click", () => {
        if (btnData.route === "roster") {
          // Switch to roster view
          setActiveView("roster");
        } else {
          // For now, anything else switches back to home
          setActiveView("home");
        }
      });

      navContainer.appendChild(b);
    });
  }

  // Default view: Home
  setActiveView("home");
});
