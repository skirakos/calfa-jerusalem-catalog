const app=document.querySelector("#app");
let DATA=null;
let state={q:"",volume:"",material:"",script:"",place:""};

const GROUPS=[
["Identification",["no_notice","numero","titre","genre","genre_id"]],
["Dating and origin",["date_debut","date_fin","details_date","lieu_copie"]],
["Physical description",["nb_pages","dimensions","mise_en_page","details_ecriture","types_cahiers","details_matiere","nb_lignes","reliure","relieur","etat_conservation","encre"]],
["People",["copiste","possesseur","enlumineur","traducteur"]],
["Decoration",["page_garde_parchemin","lettrines","initiales","enluminures_marginales","images","table_canons_1","table_canons_2","decorations"]],
["Contents and notes",["colophon","pages_blanches","informations_diverses"]]
];
const LABELS={no_notice:"Notice",numero:"Number",titre:"Title",genre:"Genre",genre_id:"Genre ID",date_debut:"Date from",date_fin:"Date to",details_date:"Dating",lieu_copie:"Place of copying",nb_pages:"Pages / leaves",dimensions:"Dimensions",mise_en_page:"Layout",details_ecriture:"Writing / script",types_cahiers:"Quires",details_matiere:"Material",nb_lignes:"Lines",reliure:"Binding",relieur:"Binder",etat_conservation:"Condition",encre:"Ink",copiste:"Copyist",possesseur:"Owner / recipient",enlumineur:"Illuminator",traducteur:"Translator",page_garde_parchemin:"Parchment guard",lettrines:"Initial letters",initiales:"Initials",enluminures_marginales:"Marginal illumination",images:"Images",table_canons_1:"Canon tables I",table_canons_2:"Canon tables II",decorations:"Decoration",colophon:"Colophon",pages_blanches:"Blank pages",informations_diverses:"Additional information"};

const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const norm=v=>String(v??"").normalize("NFKC").toLocaleLowerCase().replace(/\s+/g," ").trim();
const show=v=>v==null?"":typeof v==="string"?v:JSON.stringify(v,null,2);
const label=f=>LABELS[f]||f.replaceAll("_"," ");

function route(){
  const h=location.hash||"#/";
  if(h==="#/about")return{type:"about"};
  const m=h.match(/^#\/record\/(.+)$/);
  return m?{type:"record",id:decodeURIComponent(m[1])}:{type:"search"};
}

function matches(r){
  if(state.volume&&r.volume!==state.volume)return false;
  if(state.material&&!norm(r.fields.details_matiere).includes(norm(state.material)))return false;
  if(state.script&&!norm(r.fields.details_ecriture).includes(norm(state.script)))return false;
  if(state.place&&!norm(r.fields.lieu_copie).includes(norm(state.place)))return false;
  const terms=norm(state.q).split(" ").filter(Boolean);
  return terms.every(t=>norm(r.searchableText).includes(t));
}

function score(r){
  let s=0;
  for(const t of norm(state.q).split(" ").filter(Boolean)){
    if(norm(r.id).includes(t))s+=12;
    if(norm(r.title).includes(t))s+=8;
    if(norm(r.number).includes(t))s+=6;
    if(norm(r.fields.copiste).includes(t))s+=5;
    if(norm(r.fields.lieu_copie).includes(t))s+=4;
    s+=1;
  }
  return s;
}

function results(){
  return DATA.records
    .filter(matches)
    .map(r=>({r,s:score(r)}))
    .sort((a,b)=>b.s-a.s||a.r.id.localeCompare(b.r.id,undefined,{numeric:true}))
    .map(x=>x.r);
}

function renderSearch(){
  const rs=results();
  const volumes=[...new Set(DATA.records.map(r=>r.volume))].sort();

  app.innerHTML=`
  <section class="hero">
    <div class="kicker">CALFA · Jerusalem collection</div>
    <h1>Jerusalem Manuscript Catalogue</h1>
    <p>Search the catalogue by manuscript ID, number, title, date, copyist, place, material, script, or contents.</p>
  </section>

  <div class="wrap">
    <section class="searchbox">
      <div class="searchrow">
        <input id="q" value="${esc(state.q)}" placeholder="Search J3171, title, copyist, place, contents…">
        <button id="clear" class="btn">Clear</button>
      </div>

      <details class="advanced">
        <summary>Advanced search</summary>
        <div class="filters">
          <label>Volume
            <select id="volume">
              <option value="">All volumes</option>
              ${volumes.map(v=>`<option ${v===state.volume?"selected":""}>${esc(v)}</option>`).join("")}
            </select>
          </label>
          <label>Material<input id="material" value="${esc(state.material)}" placeholder="e.g. մագաղաթ"></label>
          <label>Script<input id="script" value="${esc(state.script)}" placeholder="e.g. բոլորգիր"></label>
          <label>Place<input id="place" value="${esc(state.place)}" placeholder="Place of copying"></label>
        </div>
      </details>

      <div class="count">${rs.length.toLocaleString()} matching record${rs.length===1?"":"s"} · ${DATA.records.length.toLocaleString()} published</div>
    </section>

    <section class="compact-results">
      <div class="result-head">
        <div>ID</div>
        <div>Source</div>
        <div>Number</div>
        <div>Title</div>
        <div>Date</div>
        <div></div>
      </div>

      ${rs.slice(0,300).map(r=>`
        <article class="result-row" data-id="${esc(r.id)}">
          <div class="rid">${esc(r.id)}</div>
          <div class="source-cell">${esc(r.source||"Jerusalem")}</div>
          <div class="number-cell">${esc(r.number||r.notice)}</div>
          <div class="title-cell">${esc(r.title||"—")}</div>
          <div class="date-cell">${esc(r.date||"—")}</div>
          <div class="view-cell"><button class="link">View full →</button></div>
        </article>
      `).join("") || `<div class="empty"><h2>No matching records</h2></div>`}
    </section>
  </div>`;

  const rerender=()=>renderSearch();
  document.querySelector("#q").oninput=e=>{state.q=e.target.value;rerender()};
  document.querySelector("#clear").onclick=()=>{state={q:"",volume:"",material:"",script:"",place:""};rerender()};
  for(const id of ["volume","material","script","place"]){
    const el=document.querySelector("#"+id);
    el.onchange=el.oninput=e=>{state[id]=e.target.value;rerender()};
  }
  document.querySelectorAll("[data-id]").forEach(el=>el.onclick=()=>location.hash="#/record/"+encodeURIComponent(el.dataset.id));
}

function renderRecord(r){
  const grouped=new Set(GROUPS.flatMap(x=>x[1]));
  const other=Object.keys(r.fields).filter(k=>!k.startsWith("_")&&!grouped.has(k)&&show(r.fields[k]));

  app.innerHTML=`
  <div class="record">
    <div class="toolbar"><button id="back" class="btn">← Back to results</button></div>
    <header class="recordhead">
      <div class="manuscript-id">${esc(r.id)}</div>
      <div class="kicker">Jerusalem · ${esc(r.volume)} · Catalogue number ${esc(r.number||r.notice)}</div>
      <h1>${esc(r.title||"Untitled notice")}</h1>
      ${r.date?`<div class="record-date">${esc(r.date)}</div>`:""}
    </header>

    <div class="grid">
      <main>
        ${GROUPS.map(([g,fs])=>{
          const xs=fs.map(f=>[f,show(r.fields[f])]).filter(([,v])=>v);
          return xs.length?`
          <section class="section">
            <h2>${esc(g)}</h2>
            <dl>${xs.map(([f,v])=>`<div class="row"><dt>${esc(label(f))}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
          </section>`:"";
        }).join("")}

        ${other.length?`
        <section class="section">
          <h2>Other information</h2>
          <dl>${other.map(f=>`<div class="row"><dt>${esc(label(f))}</dt><dd>${esc(show(r.fields[f]))}</dd></div>`).join("")}</dl>
        </section>`:""}
      </main>

      <aside class="source">
        <h2>Source images</h2>
        ${r.images?.length
          ? `<div class="imgs">${r.images.map((src,i)=>`<a href="${esc(src)}" target="_blank"><img loading="lazy" src="${esc(src)}" alt="Source page ${i+1}"></a>`).join("")}</div>`
          : `<div class="empty">Source image URLs are not configured yet.</div>`
        }
      </aside>
    </div>
  </div>`;
  document.querySelector("#back").onclick=()=>location.hash="#/";
}

function renderAbout(){
  app.innerHTML=`<section class="about"><h1>About</h1><p>This is the public searchable interface for the CALFA Jerusalem manuscript catalogue. Jerusalem manuscript IDs use the prefix <strong>J</strong>, for example <strong>J3171</strong>.</p></section>`;
}

function render(){
  const r=route();
  if(r.type==="about")return renderAbout();
  if(r.type==="record"){
    const x=DATA.records.find(v=>v.id===r.id);
    if(x)return renderRecord(x);
  }
  renderSearch();
}

async function init(){
  const res=await fetch("./data/catalog.json");
  DATA=await res.json();
  addEventListener("hashchange",render);
  render();
}
init().catch(e=>app.innerHTML=`<div class="about"><h1>Could not load catalogue</h1><pre>${esc(e)}</pre></div>`);
