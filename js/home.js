// js/home.js
document.addEventListener("DOMContentLoaded", () => {
  const backend = window.copperShoresBackend;
  if (!backend) {
    console.error("Copper Shores backend not found.");
    return;
  }

  // Title
  const titleEl = document.getElementById("campaign-title");
  if (titleEl) {
    titleEl.textContent = backend.getCampaignName();
  }

  // Dungeon Master
  const dm = backend.getDungeonMaster();
  const dmEl = document.getElementById("dm-name");
  if (dmEl) {
    dmEl.textContent = dm.name || "Unknown";
  }

  // Party Members
  const party = backend.getPartyMembers();
  const partyList = document.getElementById("party-list");
  if (partyList) {
    partyList.innerHTML = "";
    party.forEach(member => {
      const li = document.createElement("li");
      li.className = "list-item";
      li.innerHTML = `
        <span class="char-name">${member.character}</span>
        <span class="player-name">– ${member.player}</span>
      `;
      partyList.appendChild(li);
    });
  }

  // Navigation buttons (decorative for now)
  const nav = backend.getNavigationButtons();
  const navContainer = document.getElementById("nav-buttons");
  if (navContainer) {
    navContainer.innerHTML = "";
    nav.forEach(btn => {
      const b = document.createElement("button");
      b.className = "nav-btn";
      b.type = "button";
      b.textContent = btn.label;
      // Later: use btn.route for real navigation
      navContainer.appendChild(b);
    });
  }
});
