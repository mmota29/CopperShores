// ---- Simple store in localStorage with one key ----
const KEY = "dnd.table.v1";
const initial = { quests: [], loot: [], roster: [], notes: [], initiative: [] };

const store = {
  load()  { try { return JSON.parse(localStorage.getItem(KEY)) || {...initial}; } catch { return {...initial}; } },
  save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
};
let state = store.load();
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

// ---- Tabs ----
const tabButtons = $$("#tabs button");
const panels = $$(".panel");
function show(id){ 
  panels.forEach(p=>p.classList.toggle("active", p.id===id));
  tabButtons.forEach(b=>b.classList.toggle("active", b.dataset.tab===id)); 
}
tabButtons.forEach(b=>b.onclick = ()=> show(b.dataset.tab));
show("quests");

// ---- Render helpers ----
function tr(cells){ const tr=document.createElement("tr"); cells.forEach(td=>tr.appendChild(td)); return tr; }
function td(text){ const d=document.createElement("td"); d.textContent=text; return d; }
function delBtn(onclick){ const b=document.createElement("button"); b.textContent="✕"; b.onclick=onclick; const d=document.createElement("td"); d.appendChild(b); return d; }

// ---- Quests ----
const qForm = $("#quest-form"), qBody = $("#quest-table tbody");
function renderQuests(){
  qBody.innerHTML = "";
  state.quests.forEach((q,i)=>{
    const assignees = (q.assignees||"").split(",").map(s=>s.trim()).filter(Boolean).join(", ");
    const row = tr([
      td(q.title), 
      td(q.status), 
      td(assignees), 
      td(q.notes||""), 
      delBtn(()=>{state.quests.splice(i,1); saveRender();})
    ]);
    if (q.status === "Completed") 
      row.querySelectorAll("td").forEach(td=>td.classList.add("muted"));
    qBody.appendChild(row);
  });
}
qForm.onsubmit = e=>{
  e.preventDefault();
  const f = new FormData(qForm);
  state.quests.push({ 
    title:f.get("title"), 
    status:f.get("status"), 
    assignees:f.get("assignees"), 
    notes:f.get("notes") 
  });
  qForm.reset(); 
  saveRender();
};

// ---- Loot ----
const lForm = $("#loot-form"), lBody = $("#loot-table tbody"), totalGP = $("#total-gp");
function renderLoot(){
  lBody.innerHTML = "";
  let total = 0;
  state.loot.forEach((L,i)=>{
    const gp = Number(L.gp||0)*(Number(L.qty||1));
    total += gp;
    lBody.appendChild(tr([
      td(L.item), 
      td(L.qty||1), 
      td(gp.toFixed(2)), 
      td(L.owner||""), 
      delBtn(()=>{state.loot.splice(i,1); saveRender();})
    ]));
  });
  totalGP.textContent = total.toFixed(2);
}
lForm.onsubmit = e=>{
  e.preventDefault();
  const f = new FormData(lForm);
  state.loot.push({ 
    item:f.get("item"), 
    qty:Number(f.get("qty")||1), 
    gp:Number(f.get("gp")||0), 
    owner:f.get("owner") 
  });
  lForm.reset(); 
  saveRender();
};

// ---- Roster ----
const rForm = $("#roster-form"), rBody = $("#roster-table tbody");
function renderRoster(){
  rBody.innerHTML = "";
  state.roster.forEach((R,i)=>{
    rBody.appendChild(tr([
      td(R.name), 
      td(R.role||""), 
      td(R.notes||""), 
      delBtn(()=>{state.roster.splice(i,1); saveRender();})
    ]));
  });
}
rForm.onsubmit = e=>{
  e.preventDefault();
  const f = new FormData(rForm);
  state.roster.push({ 
    name:f.get("name"), 
    role:f.get("role"), 
    notes:f.get("notes") 
  });
  rForm.reset(); 
  saveRender();
};

// ---- Notes ----
const nForm = $("#note-form"), nList = $("#note-list");
function renderNotes(){
  nList.innerHTML = "";
  state.notes.slice().reverse().forEach((N)=>{
    const li = document.createElement("li");
    li.innerHTML = `<span class="badge">${new Date(N.ts).toLocaleString()}</span> ${N.text}`;
    const del = document.createElement("button"); 
    del.textContent = "✕"; 
    del.style.marginLeft="8px";
    del.onclick = ()=>{ 
      const i = state.notes.findIndex(x=>x.ts===N.ts); 
      state.notes.splice(i,1); 
      saveRender(); 
    };
    li.appendChild(del);
    nList.appendChild(li);
  });
}
nForm.onsubmit = e=>{
  e.preventDefault();
  const f = new FormData(nForm);
  state.notes.push({ text:f.get("text"), ts: Date.now() });
  nForm.reset(); 
  saveRender();
};

// ---- Initiative ----
const iForm = $("#init-form"), iBody = $("#init-table tbody");
function renderInit(){
  iBody.innerHTML = "";
  state.initiative.forEach((I,i)=>{
    iBody.appendChild(tr([
      td(I.name), 
      td(I.init), 
      td(I.hp ?? ""), 
      delBtn(()=>{state.initiative.splice(i,1); saveRender();})
    ]));
  });
}
iForm.onsubmit = e=>{
  e.preventDefault();
  const f = new FormData(iForm);
  state.initiative.push({ 
    name:f.get("name"), 
    init:Number(f.get("init")), 
    hp: f.get("hp") ? Number(f.get("hp")) : null 
  });
  iForm.reset(); 
  saveRender();
};

$("#sort-init").onclick = ()=>{
  state.initiative.sort((a,b)=>b.init - a.init);
  saveRender();
};
$("#clear-init").onclick = ()=>{
  state.initiative = [];
  saveRender();
};

// ---- Export / Import / Reset ----
$("#export").onclick = ()=>{
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json"});
  const a = document.createElement("a"); 
  a.href = URL.createObjectURL(blob);
  a.download = "dnd-table.json"; 
  a.click();
};

$("#import").onchange = async (e)=>{
  const file = e.target.files[0]; 
  if(!file) return;
  const text = await file.text(); 
  const next = JSON.parse(text);
  state = { ...initial, ...next }; 
  saveRender();
  e.target.value = "";
};

$("#reset").onclick = ()=>{
  if (confirm("Reset all data?")) { 
    state = {...initial}; 
    saveRender(); 
  }
};

// ---- Persist + Render ----
function saveRender(){ 
  store.save(state); 
  render(); 
}

function render(){ 
  renderQuests(); 
  renderLoot(); 
  renderRoster(); 
  renderNotes(); 
  renderInit(); 
}

render();
