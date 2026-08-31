(function(){'use strict';
const S=window.storage;
let pratiche=[],candidature=[],templates=[];
let openPracticeId=null,managerPracticeId='',managerChecklistId='',editingTemplateId='';
const $=id=>document.getElementById(id);
const tbodyP=$('tbody-pratiche'),tbodyPA=$('tbody-pratiche-archiviate'),tbodyC=$('tbody-candidature'),tbodyCA=$('tbody-candidature-archiviate'),statusP=$('status-pratiche'),statusPA=$('status-pratiche-archiviate'),statusC=$('status-candidature'),statusCA=$('status-candidature-archiviate');
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function esc(s){if(s===undefined||s===null)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function daysUntil(dateStr){if(!dateStr)return null;const today=new Date();today.setHours(0,0,0,0);const d=new Date(dateStr+'T00:00:00');return Math.round((d-today)/86400000)}
function addYears(dateStr,years){if(!dateStr||!years)return'';const a=dateStr.split('-').map(Number);if(a.length!==3||a.some(isNaN))return'';const[y,m,d]=a,ty=y+Number(years),last=new Date(ty,m,0).getDate();return`${ty}-${String(m).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`}
function formatDate(s){if(!s)return'—';const p=s.split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:s}
function todayISO(){const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return`${y}-${m}-${day}`}
async function save(key,data,statusEl){try{const ok=await S.set(key,JSON.stringify(data));if(statusEl)statusEl.textContent=ok?'salvato · '+new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}):'errore salvataggio';return ok}catch(e){if(statusEl)statusEl.textContent='errore salvataggio';console.error(e);return false}}
async function load(key){try{const r=await S.get(key);return r&&r.value?JSON.parse(r.value):[]}catch(e){return[]}}
function normalizeItem(i){return{id:i?.id||uid(),text:i?.text||'',done:!!i?.done}}
function normalizeChecklistGroup(c){return{id:c?.id||uid(),name:c?.name||'Checklist',templateId:c?.templateId||'',items:Array.isArray(c?.items)?c.items.map(normalizeItem):[],sent:!!c?.sent,sentAt:c?.sentAt||'',workDate:c?.workDate||c?.sentAt||todayISO(),protocol:c?.protocol||'',protocolDate:c?.protocolDate||'',sendNote:c?.sendNote||''}}
function normalizeHistory(h){return{id:h?.id||uid(),type:h?.type||'note',checklistId:h?.checklistId||'',title:h?.title||'',date:h?.date||'',protocol:h?.protocol||'',protocolDate:h?.protocolDate||'',note:h?.note||''}}
function normalizeDeadline(d){return{id:d?.id||uid(),date:d?.date||'',reason:d?.reason||''}}
function migrateLegacyChecklist(p){if(Array.isArray(p.checklists))return p.checklists.map(normalizeChecklistGroup);if(Array.isArray(p.checklist)&&p.checklist.length){return[normalizeChecklistGroup({name:'Checklist pratica',items:p.checklist.map(i=>({id:i.id,text:i.text,done:i.done}))})]}return[]}
function migrateDeadlines(p){if(Array.isArray(p.deadlines)&&p.deadlines.length)return p.deadlines.map(normalizeDeadline);if(p.scadenza)return[normalizeDeadline({date:p.scadenza,reason:'Scadenza principale'})];return[]}
function nearestDeadline(p){const list=(p.deadlines||[]).filter(d=>d.date).slice().sort((a,b)=>a.date.localeCompare(b.date));return list[0]||null}
function syncLegacyScadenza(p){const n=nearestDeadline(p);p.scadenza=n?.date||''}
function normalizePratica(p){let stato=p.statoPagamento;if(!stato)stato=p.pagato?'Pagato':'Da saldare';if(!['Da saldare','Acconto','Pagato'].includes(stato))stato='Da saldare';const out={id:p.id||uid(),cliente:p.cliente||'',comune:p.comune||'',via:p.via!==undefined?p.via:(p.sito||''),pratica:p.pratica||'',priorita:p.priorita||'Media',presentata:p.presentata||'',durataScadenza:p.durataScadenza||'',scadenza:p.scadenza||'',deadlines:migrateDeadlines(p),anticipo:p.anticipo||'',accontoCliente:p.accontoCliente||'',parcellaGeometra:p.parcellaGeometra||'',statoPagamento:stato,note:p.note||'',infoCatastali:p.infoCatastali||'',fatta:!!p.fatta,checklists:migrateLegacyChecklist(p),history:Array.isArray(p.history)?p.history.map(normalizeHistory):[]};syncLegacyScadenza(out);return out}
function normalizeTemplate(t){return{id:t?.id||uid(),name:t?.name||'Checklist',items:Array.isArray(t?.items)?t.items.map(i=>({id:i?.id||uid(),text:i?.text||''})):[]}}
function normalizeCandidatura(c){return{id:c.id||uid(),lavoro:c.lavoro||'',data:c.data||'',posto:c.posto||'',proposta:c.proposta||'',note:c.note||'',archiviata:!!c.archiviata}}
function colorizePriority(sel){const map={Alta:'var(--red)',Media:'var(--amber)',Bassa:'var(--green)'};sel.style.color=map[sel.value]||''}
function payClass(s){return s==='Pagato'?'paid':s==='Acconto'?'deposit':'unpaid'}
function goTo(view){document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.nav===view));document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.dataset.view===view));window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>goTo(b.dataset.nav)));

function renderPracticeDeadlinesEditor(p){return`<div class="detail-box deadlines-editor-box"><div class="details-title">Presentata / Scadenze</div><div class="date-row presented-row"><span class="field-label">Presentata</span><input type="date" data-f="presentata" value="${esc(p.presentata)}"></div><div class="duration-row"><span class="field-label">Scadenza principale</span><select data-f="durataScadenza"><option value="" ${!p.durataScadenza?'selected':''}>Manuale</option><option value="1" ${String(p.durataScadenza)==='1'?'selected':''}>1 anno</option><option value="2" ${String(p.durataScadenza)==='2'?'selected':''}>2 anni</option><option value="3" ${String(p.durataScadenza)==='3'?'selected':''}>3 anni</option></select></div><div class="deadline-editor-list">${(p.deadlines||[]).map(d=>`<div class="deadline-editor-row" data-deadline-id="${d.id}"><input type="date" data-deadline-f="date" value="${esc(d.date)}"><input type="text" data-deadline-f="reason" value="${esc(d.reason)}" placeholder="Motivo della scadenza"><button class="del-btn" type="button" data-action="deleteDeadline">✕</button></div>`).join('')||'<div class="deadline-editor-empty">Nessuna scadenza inserita.</div>'}</div><button class="btn add-deadline-btn" type="button" data-action="addDeadline">+ Aggiungi scadenza</button></div>`}
function rowPratica(p,index){const frag=document.createDocumentFragment(),tr=document.createElement('tr');tr.dataset.id=p.id;tr.className='practice-main-row';const nd=nearestDeadline(p),scad=daysUntil(nd?.date||'');let side='';if(!p.fatta&&scad!==null){if(scad<0)side='overdue';else if(scad<=7)side='soon'}const groupLen=practiceGroup(p).length;tr.innerHTML=`<td class="num-col"><div class="rownum-wrap"><input class="position-input" type="number" min="1" max="${groupLen}" value="${index+1}" data-action="moveToPosition" title="Sposta alla posizione"><div class="reorder-controls"><button class="move-btn" type="button" tabindex="-1" data-action="moveUp">↑</button><button class="move-btn" type="button" tabindex="-1" data-action="moveDown">↓</button></div></div></td><td class="side ${side}"><div class="client-wrap" data-action="openDetails"><input class="archive-check" type="checkbox" tabindex="-1" data-action="toggleArchive" ${p.fatta?'checked':''}><textarea data-f="cliente" placeholder="Nome cliente">${esc(p.cliente)}</textarea></div></td><td data-action="openDetails"><input type="text" data-f="comune" value="${esc(p.comune)}" placeholder="Comune"></td><td data-action="openDetails"><textarea data-f="via" placeholder="Via / indirizzo">${esc(p.via)}</textarea></td><td><div class="practice-open" data-action="openDetails"><textarea data-f="pratica" placeholder="Tipo pratica">${esc(p.pratica)}</textarea><button class="practice-chevron" type="button" tabindex="-1" data-action="toggleDetails">${openPracticeId===p.id?'▴':'▾'}</button></div></td><td><select data-f="priorita" class="priority-select"><option value="Bassa" ${p.priorita==='Bassa'?'selected':''}>Bassa</option><option value="Media" ${p.priorita==='Media'?'selected':''}>Media</option><option value="Alta" ${p.priorita==='Alta'?'selected':''}>Alta</option></select></td><td><button class="del-btn" tabindex="-1" data-action="del">✕</button></td>`;colorizePriority(tr.querySelector('.priority-select'));
const details=document.createElement('tr');details.dataset.id=p.id;details.className='notes-detail'+(openPracticeId===p.id?' open':'');details.innerHTML=`<td colspan="7"><div class="details-panel"><button class="detail-close-btn" type="button" data-action="closeDetails"><span class="detail-close-arrow">◀</span><span class="detail-close-label">Rimpicciolisci</span></button><div class="details-layout"><div class="details-notes"><div class="details-title">Note</div><textarea data-f="note" placeholder="Note della pratica...">${esc(p.note)}</textarea></div><div class="details-right">${renderPracticeDeadlinesEditor(p)}<div class="detail-box"><div class="details-title">Pagamento</div><select data-f="statoPagamento" class="pay-select ${payClass(p.statoPagamento)}"><option value="Da saldare" ${p.statoPagamento==='Da saldare'?'selected':''}>Da saldare</option><option value="Acconto" ${p.statoPagamento==='Acconto'?'selected':''}>Acconto</option><option value="Pagato" ${p.statoPagamento==='Pagato'?'selected':''}>Pagato</option></select></div></div></div></div></td>`;frag.append(tr,details);return frag}
function renderPratiche(){
  if(tbodyP)tbodyP.innerHTML='';
  if(tbodyPA)tbodyPA.innerHTML='';
  const att=pratiche.filter(p=>!p.fatta),arc=pratiche.filter(p=>p.fatta);
  if(tbodyP){
    if(!att.length)tbodyP.innerHTML='<tr class="empty-row"><td colspan="7">Nessuna pratica attiva.</td></tr>';
    else att.forEach((p,i)=>tbodyP.appendChild(rowPratica(p,i)));
  }
  if(tbodyPA){
    if(!arc.length)tbodyPA.innerHTML='<tr class="empty-row"><td colspan="7">Nessuna pratica archiviata.</td></tr>';
    else arc.forEach((p,i)=>tbodyPA.appendChild(rowPratica(p,i)));
  }
}
function updateDeadlineVisual(tr,item){const main=tr?.classList?.contains('practice-main-row')?tr:tr?.previousElementSibling;const cell=main?.children?.[1];if(!cell)return;cell.classList.remove('overdue','soon');if(item.fatta)return;const d=daysUntil(nearestDeadline(item)?.date||'');if(d!==null){if(d<0)cell.classList.add('overdue');else if(d<=7)cell.classList.add('soon')}}
function ensurePrimaryDeadline(item){let d=item.deadlines.find(x=>x.reason==='Scadenza principale');if(!d){d={id:uid(),date:'',reason:'Scadenza principale'};item.deadlines.unshift(d)}return d}
function handlePInput(e){const tr=e.target.closest('tr');if(!tr||!tr.dataset.id)return;const item=pratiche.find(x=>x.id===tr.dataset.id);if(!item)return;const deadlineRow=e.target.closest('[data-deadline-id]');if(deadlineRow&&e.target.dataset.deadlineF){const d=item.deadlines.find(x=>x.id===deadlineRow.dataset.deadlineId);if(d){d[e.target.dataset.deadlineF]=e.target.value;syncLegacyScadenza(item);updateDeadlineVisual(tr,item)}return}const f=e.target.dataset.f;if(!f)return;item[f]=e.target.value;if(f==='priorita')colorizePriority(e.target);if(f==='statoPagamento')e.target.className='pay-select '+payClass(item.statoPagamento);if((f==='presentata'||f==='durataScadenza')&&item.durataScadenza&&item.presentata){const d=ensurePrimaryDeadline(item);d.date=addYears(item.presentata,item.durataScadenza);syncLegacyScadenza(item);const row=tr.querySelector(`[data-deadline-id="${d.id}"] input[data-deadline-f="date"]`);if(row)row.value=d.date;updateDeadlineVisual(tr,item)}}
function handlePChange(e){const tr=e.target.closest('tr');if(!tr||!tr.dataset.id)return;const item=pratiche.find(x=>x.id===tr.dataset.id);if(!item)return;if(e.target.dataset.action==='moveToPosition'){movePracticeToPosition(item.id,parseInt(e.target.value,10));renderPratiche();renderDerived();save('pratiche-data',pratiche,item.fatta?(statusPA||null):(statusP||null));return}if(e.target.dataset.action==='toggleArchive'){if(openPracticeId===item.id)openPracticeId=null;item.fatta=e.target.checked;if(item.fatta&&managerPracticeId===item.id){managerPracticeId='';managerChecklistId=''}renderPratiche()}if(e.target.dataset.f==='statoPagamento'){item.statoPagamento=e.target.value;e.target.className='pay-select '+payClass(item.statoPagamento)}if(e.target.dataset.deadlineF){syncLegacyScadenza(item)}save('pratiche-data',pratiche,item.fatta?(statusPA||null):(statusP||null));renderDerived()}
function practiceGroup(item){return pratiche.filter(p=>p.fatta===item.fatta)}
function applyGroupOrder(item,ordered){let i=0;pratiche=pratiche.map(p=>p.fatta===item.fatta?ordered[i++]:p)}
function movePractice(id,action){const item=pratiche.find(p=>p.id===id);if(!item)return;const group=practiceGroup(item),gi=group.findIndex(p=>p.id===id);let to=gi;if(action==='moveUp'&&gi>0)to=gi-1;if(action==='moveDown'&&gi<group.length-1)to=gi+1;if(to===gi)return;group.splice(gi,1);group.splice(to,0,item);applyGroupOrder(item,group)}
function movePracticeToPosition(id,pos){const item=pratiche.find(p=>p.id===id);if(!item)return;const group=practiceGroup(item),from=group.findIndex(p=>p.id===id);if(from<0)return;let to=Number.isFinite(pos)?pos-1:from;to=Math.max(0,Math.min(group.length-1,to));group.splice(from,1);group.splice(to,0,item);applyGroupOrder(item,group)}
function setOpenPractice(id){openPracticeId=id||null;[tbodyP,tbodyPA].filter(Boolean).forEach(tb=>tb.querySelectorAll('.practice-main-row').forEach(main=>{const detail=main.nextElementSibling,isOpen=main.dataset.id===openPracticeId;if(detail&&detail.classList.contains('notes-detail'))detail.classList.toggle('open',isOpen);const b=main.querySelector('.practice-chevron');if(b)b.textContent=isOpen?'▴':'▾'}))}
function handlePClick(e){const tr=e.target.closest('tr');if(!tr||!tr.dataset.id)return;const item=pratiche.find(x=>x.id===tr.dataset.id);if(!item)return;const a=(e.target.closest('[data-action]')||{}).dataset?.action||'';if(a==='del'){pratiche=pratiche.filter(x=>x.id!==item.id);if(managerPracticeId===item.id){managerPracticeId='';managerChecklistId=''}renderPratiche();renderDerived();save('pratiche-data',pratiche,item.fatta?(statusPA||null):(statusP||null))}else if(['moveUp','moveDown'].includes(a)){movePractice(item.id,a);renderPratiche();renderDerived();save('pratiche-data',pratiche,item.fatta?(statusPA||null):(statusP||null))}else if(a==='addDeadline'){item.deadlines.push({id:uid(),date:'',reason:''});renderPratiche();setOpenPractice(item.id);save('pratiche-data',pratiche,item.fatta?(statusPA||null):(statusP||null))}else if(a==='deleteDeadline'){const row=e.target.closest('[data-deadline-id]');if(row){item.deadlines=item.deadlines.filter(d=>d.id!==row.dataset.deadlineId);syncLegacyScadenza(item);renderPratiche();setOpenPractice(item.id);renderDerived();save('pratiche-data',pratiche,item.fatta?(statusPA||null):(statusP||null))}}else if(a==='closeDetails')setOpenPractice(null);else if(a==='toggleDetails')setOpenPractice(openPracticeId===item.id?null:item.id);else if(a==='openDetails'&&openPracticeId!==item.id)setOpenPractice(item.id)}
[tbodyP,tbodyPA].filter(Boolean).forEach(tb=>{tb.addEventListener('input',handlePInput);tb.addEventListener('change',handlePChange);tb.addEventListener('click',handlePClick)});

function rowCandidatura(c,index){const tr=document.createElement('tr');tr.dataset.id=c.id;tr.innerHTML=`<td class="num-col"><div class="rownum">${index+1}</div></td><td><div class="client-wrap"><input class="archive-check" type="checkbox" data-action="toggleArchive" ${c.archiviata?'checked':''}><textarea data-f="lavoro" placeholder="Nome lavoro / ente">${esc(c.lavoro)}</textarea></div></td><td><input type="date" data-f="data" value="${esc(c.data)}"></td><td><textarea data-f="posto" placeholder="Città / luogo">${esc(c.posto)}</textarea></td><td><textarea data-f="note" placeholder="Note...">${esc(c.note)}</textarea></td><td><div class="money-wrap"><input type="number" data-f="proposta" value="${esc(c.proposta)}" step="0.01"><span class="money-suffix">€</span></div></td><td><button class="del-btn" data-action="del">✕</button></td>`;return tr}
function renderCandidature(){tbodyC.innerHTML='';tbodyCA.innerHTML='';const att=candidature.filter(c=>!c.archiviata),arc=candidature.filter(c=>c.archiviata);if(!att.length)tbodyC.innerHTML='<tr class="empty-row"><td colspan="7">Nessuna candidatura attiva.</td></tr>';else att.forEach((c,i)=>tbodyC.appendChild(rowCandidatura(c,i)));if(!arc.length)tbodyCA.innerHTML='<tr class="empty-row"><td colspan="7">Nessuna candidatura archiviata.</td></tr>';else arc.forEach((c,i)=>tbodyCA.appendChild(rowCandidatura(c,i)))}
function handleCInput(e){const tr=e.target.closest('tr');if(!tr||!tr.dataset.id)return;const item=candidature.find(x=>x.id===tr.dataset.id);if(item&&e.target.dataset.f)item[e.target.dataset.f]=e.target.value}
function handleCChange(e){const tr=e.target.closest('tr');if(!tr||!tr.dataset.id)return;const item=candidature.find(x=>x.id===tr.dataset.id);if(!item)return;if(e.target.dataset.action==='toggleArchive'){item.archiviata=e.target.checked;renderCandidature()}save('candidature-data',candidature,item.archiviata?statusCA:statusC)}
function handleCClick(e){const tr=e.target.closest('tr');if(!tr||!tr.dataset.id)return;if(e.target.dataset.action==='del'){const item=candidature.find(x=>x.id===tr.dataset.id);candidature=candidature.filter(x=>x.id!==tr.dataset.id);renderCandidature();save('candidature-data',candidature,item&&item.archiviata?statusCA:statusC)}}
[tbodyC,tbodyCA].forEach(tb=>{tb.addEventListener('input',handleCInput);tb.addEventListener('change',handleCChange);tb.addEventListener('click',handleCClick)});
$('add-candidatura').addEventListener('click',()=>{candidature.unshift({id:uid(),lavoro:'',data:'',posto:'',proposta:'',note:'',archiviata:false});renderCandidature();save('candidature-data',candidature,statusC);const f=tbodyC.querySelector('textarea[data-f="lavoro"]');if(f)f.focus()});

function deadlineStatusDate(date){const d=daysUntil(date);if(d===null)return{label:'—',cls:'normal'};if(d<0)return{label:`Scaduta ${Math.abs(d)} gg`,cls:'overdue'};if(d===0)return{label:'Oggi',cls:'soon'};if(d<=7)return{label:`${d} gg`,cls:'soon'};return{label:`${d} gg`,cls:'normal'}}
function sortedDeadlines(){const out=[];pratiche.filter(p=>!p.fatta).forEach(p=>(p.deadlines||[]).filter(d=>d.date).forEach(d=>out.push({practice:p,deadline:d,date:d.date,reason:d.reason||'Scadenza'})));return out.sort((a,b)=>a.date.localeCompare(b.date))}
function openManager(id){managerPracticeId=id;const p=pratiche.find(x=>x.id===id&&!x.fatta);managerChecklistId=p?.checklists?.find(c=>!c.sent)?.id||p?.checklists?.[0]?.id||'';renderManager();goTo('gestione')}
function openPracticeContext(id){const p=pratiche.find(x=>x.id===id);if(!p)return;if(p.fatta){goTo('archivio');setOpenPractice(id)}else openManager(id)}
function renderDashboardPractices(){const host=$('dashboard-practices'),active=pratiche.filter(p=>!p.fatta);$('dashboard-practice-count').textContent=active.length===1?'1 pratica attiva':`${active.length} pratiche attive`;if(!active.length){host.innerHTML='<div class="manager-empty">Nessuna pratica attiva.</div>';return}const groups=[{key:'Alta',label:'Priorità alta',cls:'high'},{key:'Media',label:'Priorità media',cls:'medium'},{key:'Bassa',label:'Priorità bassa',cls:'low'}];host.innerHTML=groups.map(g=>{const items=active.filter(p=>p.priorita===g.key);if(!items.length)return'';return`<div class="priority-group"><div class="priority-group-title"><span class="priority-name ${g.cls}">${g.label}</span><span>${items.length}</span></div>${items.map(p=>`<div class="dashboard-practice-row"><div class="dash-client">${esc(p.cliente||'Senza cliente')}</div><div class="dash-practice">${esc(p.pratica||'Pratica senza titolo')}</div><div class="dash-address">${esc([p.comune,p.via].filter(Boolean).join(' · ')||'—')}</div><div class="dash-payment"><span class="status-chip ${payClass(p.statoPagamento)}">${esc(p.statoPagamento)}</span></div><div class="dash-open"><button class="btn" type="button" data-dashboard-open="${p.id}">Apri</button></div></div>`).join('')}</div>`}).join('');host.querySelectorAll('[data-dashboard-open]').forEach(b=>b.addEventListener('click',()=>openManager(b.dataset.dashboardOpen)))}
function renderDashboardDeadlines(){
  const host=$('dashboard-deadlines'),list=sortedDeadlines().slice(0,10);
  $('dashboard-count').textContent=list.length?`${list.length} visualizzate`:'Nessuna scadenza';
  if(!list.length){host.innerHTML='<div class="manager-empty">Nessuna scadenza inserita.</div>';return}
  host.innerHTML=list.map(x=>{
    const p=x.practice,s=deadlineStatusDate(x.date);
    return `<div class="deadline-card-v8">
      <div class="deadline-card-top"><span class="deadline-date">${formatDate(x.date)}</span><span class="deadline-status ${s.cls}">${s.label}</span></div>
      <div class="deadline-reason">${esc(x.reason)}</div>
      <div class="deadline-client">${esc(p.cliente||'Senza cliente')}</div>
      <div class="deadline-practice">${esc(p.pratica||'Pratica senza titolo')}</div>
      <button class="btn deadline-open-btn" type="button" data-deadline-open="${p.id}">Apri</button>
    </div>`;
  }).join('');
  host.querySelectorAll('[data-deadline-open]').forEach(b=>b.addEventListener('click',()=>openManager(b.dataset.deadlineOpen)));
}

function dashboardNewPracticeForm(){
  return `<div class="dashboard-create-card">
    <div class="dashboard-create-grid">
      <label><span class="field-label">Nome cliente</span><input id="newp-cliente" type="text" placeholder="Nome cliente"></label>
      <label><span class="field-label">Oggetto / pratica</span><input id="newp-pratica" type="text" placeholder="Oggetto della pratica"></label>
      <label><span class="field-label">Comune</span><input id="newp-comune" type="text" placeholder="Comune"></label>
      <label><span class="field-label">Via</span><input id="newp-via" type="text" placeholder="Via / indirizzo"></label>
      <label><span class="field-label">Priorità</span><select id="newp-priorita"><option value="Alta">Alta</option><option value="Media" selected>Media</option><option value="Bassa">Bassa</option></select></label>
      <label><span class="field-label">Pagamento</span><select id="newp-pagamento"><option value="Da saldare" selected>Da saldare</option><option value="Acconto">Acconto</option><option value="Pagato">Pagato</option></select></label>
    </div>
    <div class="dashboard-create-actions">
      <button class="btn" type="button" id="cancel-dashboard-practice">Annulla</button>
      <button class="btn gold" type="button" id="save-dashboard-practice">Crea e apri</button>
    </div>
  </div>`;
}
function openDashboardPracticeCreator(){
  const box=$('dashboard-new-practice');
  box.hidden=false;
  box.innerHTML=dashboardNewPracticeForm();
  $('cancel-dashboard-practice').addEventListener('click',()=>{box.hidden=true;box.innerHTML=''});
  $('save-dashboard-practice').addEventListener('click',()=>{
    const p={
      id:uid(),
      cliente:$('newp-cliente').value.trim(),
      comune:$('newp-comune').value.trim(),
      via:$('newp-via').value.trim(),
      pratica:$('newp-pratica').value.trim(),
      priorita:$('newp-priorita').value,
      presentata:'',
      durataScadenza:'',
      scadenza:'',
      deadlines:[],
      anticipo:'',accontoCliente:'',parcellaGeometra:'',
      statoPagamento:$('newp-pagamento').value,
      note:'',
      infoCatastali:'',
      fatta:false,
      checklists:[],
      history:[]
    };
    pratiche.push(p);
    save('pratiche-data',pratiche,statusP||null);
    renderPratiche();renderDerived();
    box.hidden=true;box.innerHTML='';
    openManager(p.id);
  });
  const first=$('newp-cliente');if(first)first.focus();
}

function renderDashboard(){renderDashboardPractices();renderDashboardDeadlines()}
$('dashboard-add-practice').addEventListener('click',openDashboardPracticeCreator);
function renderScadenze(){const tb=$('tbody-scadenze'),list=sortedDeadlines();if(!list.length){tb.innerHTML='<tr class="empty-row"><td colspan="6">Nessuna scadenza inserita.</td></tr>';return}tb.innerHTML=list.map(x=>{const p=x.practice,s=deadlineStatusDate(x.date);return`<tr class="link-row" data-open-practice="${p.id}"><td class="mono">${formatDate(x.date)}</td><td>${esc(x.reason)}</td><td><strong>${esc(p.cliente||'—')}</strong></td><td>${esc(p.pratica||'—')}</td><td class="muted">${esc([p.comune,p.via].filter(Boolean).join(' · ')||'—')}</td><td><span class="deadline-status ${s.cls}">${s.label}</span></td></tr>`}).join('');tb.querySelectorAll('[data-open-practice]').forEach(el=>el.addEventListener('click',()=>openPracticeContext(el.dataset.openPractice)))}
function getClientList(){const map=new Map();pratiche.forEach(p=>{const name=(p.cliente||'').trim();if(!name)return;const key=name.toLocaleLowerCase('it');if(!map.has(key))map.set(key,{name,active:0,arch:0,last:null});const c=map.get(key);p.fatta?c.arch++:c.active++;c.last=p});return[...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'it'))}
function renderClienti(){const q=($('client-search').value||'').trim().toLocaleLowerCase('it'),filter=$('client-filter').value;let list=getClientList();if(q)list=list.filter(c=>c.name.toLocaleLowerCase('it').includes(q));if(filter==='active')list=list.filter(c=>c.active>0);if(filter==='archived')list=list.filter(c=>c.active===0&&c.arch>0);$('clienti-count').textContent=list.length===1?'1 cliente':`${list.length} clienti`;const tb=$('tbody-clienti');if(!list.length){tb.innerHTML='<tr class="empty-row"><td colspan="5">Nessun cliente corrisponde alla ricerca.</td></tr>';return}tb.innerHTML=list.map(c=>`<tr><td><strong>${esc(c.name)}</strong></td><td class="mono">${c.active}</td><td class="mono">${c.arch}</td><td class="muted">${esc([c.last?.comune,c.last?.via].filter(Boolean).join(' · ')||'—')}</td><td><button class="btn" data-client-open="${esc(c.name)}">Apri</button></td></tr>`).join('');tb.querySelectorAll('[data-client-open]').forEach(b=>b.addEventListener('click',()=>{const p=pratiche.find(x=>x.cliente===b.dataset.clientOpen&&!x.fatta)||pratiche.find(x=>x.cliente===b.dataset.clientOpen);if(p)openPracticeContext(p.id)}))}
$('client-search').addEventListener('input',renderClienti);$('client-filter').addEventListener('change',renderClienti);

function renderTemplateSelects(){const legacy=$('template-to-practice');if(legacy){legacy.innerHTML='<option value="">Seleziona modello...</option>'+templates.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}}
function resetTemplateEditor(){editingTemplateId='';$('template-name').value='';$('template-items').innerHTML='';$('template-status').textContent='';addTemplateEditorItem('')}
function addTemplateEditorItem(text){const row=document.createElement('div');row.className='template-item';row.innerHTML=`<input type="text" value="${esc(text)}" placeholder="Documento / attività richiesta"><button class="del-btn" type="button" data-template-item-del="1">✕</button>`;$('template-items').appendChild(row)}
function renderTemplates(){renderTemplateSelects();$('template-count').textContent=templates.length===1?'1 checklist':`${templates.length} checklist`;const host=$('template-list');if(!templates.length){host.innerHTML='<div class="template-empty">Non hai ancora creato modelli di checklist.</div>';return}host.innerHTML=templates.map(t=>`<div class="template-card"><div class="template-card-head"><div><div class="template-card-name">${esc(t.name)}</div><div class="template-card-count">${t.items.length} voci</div></div><div class="template-card-actions"><button class="btn" data-template-edit="${t.id}">Modifica</button><button class="btn danger" data-template-del="${t.id}">Elimina</button></div></div><div class="template-preview">${t.items.slice(0,5).map(i=>esc(i.text)).join(' · ')}${t.items.length>5?' · …':''}</div></div>`).join('');host.querySelectorAll('[data-template-edit]').forEach(b=>b.addEventListener('click',()=>editTemplate(b.dataset.templateEdit)));host.querySelectorAll('[data-template-del]').forEach(b=>b.addEventListener('click',()=>deleteTemplate(b.dataset.templateDel)))}
function editTemplate(id){const t=templates.find(x=>x.id===id);if(!t)return;editingTemplateId=id;$('template-name').value=t.name;$('template-items').innerHTML='';t.items.forEach(i=>addTemplateEditorItem(i.text));if(!t.items.length)addTemplateEditorItem('');$('template-status').textContent='Modifica modello';goTo('crea-checklist')}
function deleteTemplate(id){const t=templates.find(x=>x.id===id);if(!t)return;if(!confirm(`Eliminare il modello “${t.name}”? Le checklist già inserite nelle pratiche restano.`))return;templates=templates.filter(x=>x.id!==id);if(editingTemplateId===id)resetTemplateEditor();save('checklist-templates-data',templates,$('template-status'));renderTemplates()}
$('new-template').addEventListener('click',resetTemplateEditor);$('add-template-item').addEventListener('click',()=>addTemplateEditorItem(''));
$('template-items').addEventListener('click',e=>{if(!e.target.dataset.templateItemDel)return;const rows=$('template-items').querySelectorAll('.template-item');if(rows.length===1){rows[0].querySelector('input').value='';return}e.target.closest('.template-item').remove()});
$('save-template').addEventListener('click',async()=>{const name=$('template-name').value.trim(),items=[...$('template-items').querySelectorAll('input')].map(i=>i.value.trim()).filter(Boolean);if(!name){$('template-status').textContent='Inserisci il nome';$('template-name').focus();return}if(!items.length){$('template-status').textContent='Inserisci almeno una voce';return}if(editingTemplateId){const t=templates.find(x=>x.id===editingTemplateId);if(t){t.name=name;t.items=items.map((text,i)=>({id:t.items[i]?.id||uid(),text}))}}else{const t={id:uid(),name,items:items.map(text=>({id:uid(),text}))};templates.push(t);editingTemplateId=t.id}await save('checklist-templates-data',templates,$('template-status'));$('template-status').textContent='Checklist salvata';renderTemplates()});

function currentPractice(){return pratiche.find(p=>p.id===managerPracticeId&&!p.fatta)}
function currentChecklist(){const p=currentPractice();return p?.checklists?.find(c=>c.id===managerChecklistId)||null}
function ensureManagerChecklist(){const p=currentPractice();if(!p){managerChecklistId='';return}if(!p.checklists.some(c=>c.id===managerChecklistId))managerChecklistId=p.checklists.find(c=>!c.sent)?.id||p.checklists[0]?.id||''}
function renderManagerPracticeSelect(){const sel=$('practice-manager-select'),att=pratiche.filter(p=>!p.fatta);sel.innerHTML='<option value="">Seleziona una pratica...</option>'+att.map(p=>`<option value="${p.id}">${esc((p.cliente||'Senza cliente')+' — '+(p.pratica||'Pratica'))}</option>`).join('');if(att.some(p=>p.id===managerPracticeId))sel.value=managerPracticeId;else{managerPracticeId='';managerChecklistId='';sel.value=''}}
function uniqueChecklistName(p,name){let base=name||'Checklist',n=base,i=2;const names=new Set(p.checklists.map(c=>c.name.toLocaleLowerCase('it')));while(names.has(n.toLocaleLowerCase('it'))){n=`${base} (${i++})`}return n}
function createPracticeChecklistFromTemplate(p,t){const c={id:uid(),name:uniqueChecklistName(p,t.name),templateId:t.id,items:t.items.map(i=>({id:uid(),text:i.text,done:false})),sent:false,sentAt:'',workDate:todayISO(),protocol:'',protocolDate:'',sendNote:''};p.checklists.push(c);managerChecklistId=c.id;return c}
function addEmptyChecklistToPractice(p){const raw=prompt('Nome della nuova checklist:','');if(raw===null)return null;const name=raw.trim();if(!name)return null;const c={id:uid(),name:uniqueChecklistName(p,name),templateId:'',items:[],sent:false,sentAt:'',workDate:todayISO(),protocol:'',protocolDate:'',sendNote:''};p.checklists.push(c);managerChecklistId=c.id;return c}

function syncHistoryForChecklist(p,c){let h=p.history.find(x=>x.type==='checklist-send'&&x.checklistId===c.id);if(!c.sent){p.history=p.history.filter(x=>!(x.type==='checklist-send'&&x.checklistId===c.id));return}if(!h){h={id:uid(),type:'checklist-send',checklistId:c.id,title:'',date:'',protocol:'',protocolDate:'',note:''};p.history.push(h)}h.title=`Checklist ${c.name} inviata`;h.date=c.sentAt;h.protocol=c.protocol;h.protocolDate=c.protocolDate;h.note=c.sendNote}
function renderHistory(p){const events=p.history.slice();if(p.presentata)events.push({id:'presentata',type:'presentata',title:'Pratica presentata',date:p.presentata,protocol:'',protocolDate:'',note:''});events.sort((a,b)=>(b.date||'').localeCompare(a.date||''));if(!events.length)return'<div class="timeline-empty">Nessun evento registrato.</div>';return events.map(h=>`<div class="timeline-item-v6">${h.type==='checklist-send'?`<div class="timeline-top"><div class="timeline-title">${esc(h.title||'Checklist')}</div><input class="history-date-input" type="date" data-history-checklist="${h.checklistId}" value="${esc(h.date)}"></div>`:`<div class="timeline-top"><div class="timeline-title">${esc(h.title||'Evento')}</div><div class="timeline-date">${formatDate(h.date)}</div></div>`}${h.protocol?`<div class="timeline-protocol">Protocollo: ${esc(h.protocol)}${h.protocolDate?' · '+formatDate(h.protocolDate):''}</div>`:''}${h.note?`<div class="timeline-sub">${esc(h.note)}</div>`:''}</div>`).join('')}

function renderProtocolBox(c){if(!c.sent)return'';return`<div class="send-box sent"><div class="send-box-head"><div><div class="send-box-title">Dati invio / protocollo</div><div class="send-box-note">Puoi completare o correggere protocollo e date.</div></div></div><div class="send-grid"><label><span class="field-label">Data invio</span><input id="send-date" type="date" value="${esc(c.sentAt)}"></label><label><span class="field-label">Protocollo</span><input id="send-protocol" type="text" value="${esc(c.protocol)}" placeholder="Es. PG 12345/2026"></label><label><span class="field-label">Data protocollo</span><input id="send-protocol-date" type="date" value="${esc(c.protocolDate)}"></label></div><label class="send-note-field"><span class="field-label">Nota invio</span><textarea id="send-note" placeholder="Nota facoltativa...">${esc(c.sendNote)}</textarea></label><div class="send-actions"><button class="btn" id="reopen-checklist" type="button">Riapri checklist</button><button class="btn gold" id="save-send-data" type="button">Salva dati</button></div></div>`}

function renderWorkingChecklists(p){const list=p.checklists.filter(c=>!c.sent);if(!list.length)return'<div class="working-empty">Nessuna checklist in lavorazione.</div>';return list.map(c=>{const done=c.items.filter(i=>i.done).length,total=c.items.length;return`<div class="working-check-row" data-working-id="${c.id}"><input class="working-complete-check" type="checkbox" data-working-complete="${c.id}" title="Sposta in storia pratica"><div class="working-check-info"><button type="button" class="working-check-name" data-working-open="${c.id}">${esc(c.name)}</button><div class="working-check-progress">${done}/${total} completate</div></div><input class="working-date" type="date" data-working-date="${c.id}" value="${esc(c.workDate||todayISO())}"></div>`}).join('')}

function renderManagerDeadlinesEditor(p){const list=(p.deadlines||[]);return `<div class="manager-deadline-editor-list">${list.length?list.map(d=>`<div class="manager-deadline-edit-row" data-manager-deadline="${d.id}"><input type="date" data-md-f="date" value="${esc(d.date)}"><input type="text" data-md-f="reason" value="${esc(d.reason)}" placeholder="Motivo della scadenza"><button class="del-btn" type="button" data-md-delete="${d.id}">✕</button></div>`).join(''):'<div class="manager-deadlines-empty">Nessuna scadenza inserita.</div>'}</div>`}

function renderChecklistPanel(c){
  const done=c.items.filter(i=>i.done).length,total=c.items.length,missing=total-done;
  return `<div class="simple-checklist-v11">
    <div class="simple-checklist-title-v11">
      <div>
        <input id="current-checklist-name" class="simple-checklist-name-v11" type="text" value="${esc(c.name)}" placeholder="Nome checklist">
        <div class="simple-checklist-summary-v11">${total?`${done} completati · ${missing} mancanti`:'Nessun documento inserito'}${c.sent?' · chiusa il '+formatDate(c.sentAt):''}</div>
      </div>
      ${!c.sent?'<button class="btn" id="add-check-item" type="button">+ Documento</button>':''}
    </div>

    <div class="simple-progress-v11"><span style="width:${total?Math.round(done/total*100):0}%"></span></div>

    <div class="simple-document-list-v11" id="check-list">
      ${total?c.items.map(i=>`
        <div class="simple-document-row-v11 ${i.done?'done':''}" data-check-id="${i.id}">
          <input type="checkbox" data-check-f="done" ${i.done?'checked':''} ${c.sent?'disabled':''}>
          <input type="text" data-check-f="text" value="${esc(i.text)}" placeholder="Documento richiesto" ${c.sent?'readonly':''}>
          ${!c.sent?'<button class="simple-delete-doc-v11" type="button" data-check-del="1" title="Elimina documento">✕</button>':''}
        </div>`).join(''):'<div class="simple-empty-v11">Questa checklist è vuota. Aggiungi i documenti che ti servono.</div>'}
    </div>

    ${!c.sent?`
      <div class="simple-checklist-close-v11">
        <label>
          <span class="field-label">Data chiusura / invio</span>
          <input id="current-checklist-work-date" type="date" value="${esc(c.workDate||todayISO())}">
        </label>
        <label class="simple-close-check-v11">
          <input id="complete-current-checklist" class="working-complete-check" type="checkbox">
          <span>Sposta in storia</span>
        </label>
      </div>`:renderProtocolBox(c)}

    <div class="simple-checklist-danger-v11">
      <button class="btn danger" id="delete-practice-checklist" type="button">Elimina checklist</button>
    </div>
  </div>`;
}

function renderChecklistHeaderSelect(p){
  return `<div class="simple-checklist-selector-v11">
    <div class="simple-selector-label-v11">Checklist</div>
    <select id="manager-checklist-select">
      <option value="">Seleziona una checklist...</option>
      ${p.checklists.map(c=>`<option value="${c.id}" ${c.id===managerChecklistId?'selected':''}>${esc(c.name)}${c.sent?' · in storia':''}</option>`).join('')}
    </select>
  </div>`;
}

function renderChecklistFooter(p){
  return `<div class="simple-add-checklist-v11">
    <div class="simple-add-title-v11">Aggiungi checklist preimpostata</div>
    <div class="simple-add-row-v11">
      <select id="manager-template-select">
        <option value="">Scegli una checklist creata prima...</option>
        ${templates.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}
      </select>
      <button class="btn gold" id="add-template-to-practice" type="button">Aggiungi</button>
    </div>
    <button class="simple-empty-checklist-link-v11" id="add-empty-checklist" type="button">oppure crea una checklist vuota</button>
  </div>`;
}

function renderPracticeHero(p){return`<div class="practice-hero-v9">
  <div class="practice-hero-main">
    <label class="hero-client-label"><span class="field-label">Società / Cliente</span><input id="manager-client" class="hero-client-input" type="text" value="${esc(p.cliente)}" placeholder="Società o cliente"></label>
    <label class="hero-object-label"><span class="field-label">Oggetto pratica</span><input id="manager-object" class="hero-object-input" type="text" value="${esc(p.pratica)}" placeholder="Oggetto della pratica"></label>
    <div class="hero-location-grid">
      <label><span class="field-label">Comune</span><input id="manager-comune" type="text" value="${esc(p.comune)}" placeholder="Comune"></label>
      <label><span class="field-label">Via</span><input id="manager-via" type="text" value="${esc(p.via)}" placeholder="Via / indirizzo"></label>
    </div>
  </div>
  <div class="practice-hero-side">
    <label><span class="field-label">Informazioni catastali</span><textarea id="manager-catasto" class="catasto-note-v9" placeholder="Es. Foglio 12, particella 345, sub 7...">${esc(p.infoCatastali||'')}</textarea></label>
    <div class="hero-status-grid">
      <label><span class="field-label">Priorità</span><select id="manager-priority" class="priority-select"><option value="Alta" ${p.priorita==='Alta'?'selected':''}>Alta</option><option value="Media" ${p.priorita==='Media'?'selected':''}>Media</option><option value="Bassa" ${p.priorita==='Bassa'?'selected':''}>Bassa</option></select></label>
      <label><span class="field-label">Pagamento</span><select id="manager-payment" class="pay-select ${payClass(p.statoPagamento)}"><option value="Da saldare" ${p.statoPagamento==='Da saldare'?'selected':''}>Da saldare</option><option value="Acconto" ${p.statoPagamento==='Acconto'?'selected':''}>Acconto</option><option value="Pagato" ${p.statoPagamento==='Pagato'?'selected':''}>Pagato</option></select></label>
    </div>
  </div>
</div>`}

function renderManager(){
  renderManagerPracticeSelect();
  const body=$('manager-body'),p=currentPractice();
  if(!p){body.innerHTML='<div class="manager-empty">Seleziona una pratica attiva per aprirla.</div>';return}
  ensureManagerChecklist();
  const c=currentChecklist();

  body.innerHTML=`
    ${renderPracticeHero(p)}

    <div class="manager-deadlines-block">
      <div class="manager-section-head">
        <div class="manager-section-title">Scadenze pratica</div>
        <button class="btn" id="manager-add-deadline" type="button">+ Scadenza</button>
      </div>
      ${renderManagerDeadlinesEditor(p)}
    </div>

    <div class="manager-top-halves-v10 manager-top-halves-v11">
      <section class="manager-half-v10 checklist-half-v10 checklist-half-v11">
        <div class="manager-third-head simple-checklist-head-v11">
          ${renderChecklistHeaderSelect(p)}
        </div>
        <div class="manager-half-body-v10 simple-checklist-body-v11">
          ${c?renderChecklistPanel(c):`
            <div class="simple-no-checklist-v11">
              <div class="simple-no-checklist-icon-v11">✓</div>
              <div class="simple-no-checklist-title-v11">Nessuna checklist selezionata</div>
              <div class="simple-no-checklist-text-v11">Scegli una checklist già aggiunta dal menu sopra, oppure aggiungine una preimpostata qui sotto.</div>
            </div>`}
        </div>
        <div class="manager-half-footer-v10 simple-checklist-footer-v11">
          ${renderChecklistFooter(p)}
        </div>
      </section>

      <section class="manager-half-v10 notes-half-v10">
        <div class="manager-third-head"><h3>Note pratica</h3></div>
        <div class="manager-half-body-v10">
          <textarea class="manager-notes manager-notes-v10" id="manager-notes" placeholder="Note della pratica...">${esc(p.note)}</textarea>
        </div>
      </section>
    </div>

    <section class="manager-history-full-v10">
      <div class="manager-third-head"><h3>Storia pratica</h3></div>
      <div class="history-full-body-v10">
        <div class="timeline timeline-v10">${renderHistory(p)}</div>
      </div>
    </section>`;

  bindManager(p,c);
}

function completeWorkingChecklist(p,c){const allDone=c.items.length===0||c.items.every(i=>i.done);if(!allDone&&!confirm(`La checklist “${c.name}” ha ancora voci non completate. Vuoi comunque spostarla nella storia pratica?`))return;c.sent=true;c.sentAt=c.workDate||todayISO();syncHistoryForChecklist(p,c);save('pratiche-data',pratiche,statusP||null);renderManager()}

function bindManager(p,c){
  const bindText=(id,key,after)=>{const el=$(id);if(!el)return;el.addEventListener('input',()=>{p[key]=el.value;if(after)after()});el.addEventListener('change',()=>save('pratiche-data',pratiche,statusP||null))};
  bindText('manager-client','cliente',()=>{renderDashboard()});
  bindText('manager-object','pratica',()=>{renderDashboard()});
  bindText('manager-comune','comune',()=>{renderDashboard()});
  bindText('manager-via','via',()=>{renderDashboard()});
  bindText('manager-catasto','infoCatastali');

  const pri=$('manager-priority');if(pri){colorizePriority(pri);pri.addEventListener('change',()=>{p.priorita=pri.value;colorizePriority(pri);save('pratiche-data',pratiche,statusP||null);renderDashboard()})}
  const pay=$('manager-payment');if(pay){pay.addEventListener('change',()=>{p.statoPagamento=pay.value;pay.className='pay-select '+payClass(p.statoPagamento);save('pratiche-data',pratiche,statusP||null);renderDashboard()})}

  const notes=$('manager-notes');if(notes){notes.addEventListener('input',()=>p.note=notes.value);notes.addEventListener('change',()=>save('pratiche-data',pratiche,statusP||null))}

  const csel=$('manager-checklist-select');if(csel)csel.addEventListener('change',()=>{managerChecklistId=csel.value;renderManager()});
  const cname=$('current-checklist-name');if(cname&&c){
    cname.addEventListener('input',()=>{c.name=cname.value});
    cname.addEventListener('change',()=>{
      c.name=cname.value.trim()||'Checklist';
      if(c.sent)syncHistoryForChecklist(p,c);
      save('pratiche-data',pratiche,statusP||null);
      renderManager();
    });
  }

  const addTemplate=$('add-template-to-practice');if(addTemplate)addTemplate.addEventListener('click',()=>{
    const tid=$('manager-template-select')?.value;
    const t=templates.find(x=>x.id===tid);
    if(!t){alert('Seleziona prima un modello di checklist.');return}
    createPracticeChecklistFromTemplate(p,t);
    save('pratiche-data',pratiche,statusP||null);
    renderManager();
  });

  const addEmpty=$('add-empty-checklist');if(addEmpty)addEmpty.addEventListener('click',()=>{
    const created=addEmptyChecklistToPractice(p);
    if(!created)return;
    save('pratiche-data',pratiche,statusP||null);
    renderManager();
  });

  const addDeadline=$('manager-add-deadline');if(addDeadline)addDeadline.addEventListener('click',()=>{
    p.deadlines.push({id:uid(),date:'',reason:''});
    save('pratiche-data',pratiche,statusP||null);
    renderManager();renderDashboard();renderScadenze();
  });
  document.querySelectorAll('[data-manager-deadline]').forEach(row=>{
    row.querySelectorAll('[data-md-f]').forEach(inp=>inp.addEventListener('change',()=>{
      const d=p.deadlines.find(x=>x.id===row.dataset.managerDeadline);if(!d)return;
      d[inp.dataset.mdF]=inp.value;syncLegacyScadenza(p);
      save('pratiche-data',pratiche,statusP||null);renderDashboard();renderScadenze();
    }));
  });
  document.querySelectorAll('[data-md-delete]').forEach(btn=>btn.addEventListener('click',()=>{
    p.deadlines=p.deadlines.filter(d=>d.id!==btn.dataset.mdDelete);syncLegacyScadenza(p);
    save('pratiche-data',pratiche,statusP||null);renderManager();renderDashboard();renderScadenze();
  }));

  document.querySelectorAll('[data-working-open]').forEach(b=>b.addEventListener('click',()=>{managerChecklistId=b.dataset.workingOpen;renderManager()}));
  document.querySelectorAll('[data-working-date]').forEach(inp=>inp.addEventListener('change',()=>{const wc=p.checklists.find(x=>x.id===inp.dataset.workingDate);if(wc){wc.workDate=inp.value||todayISO();save('pratiche-data',pratiche,statusP||null)}}));
  document.querySelectorAll('[data-working-complete]').forEach(ch=>ch.addEventListener('change',()=>{if(!ch.checked)return;const wc=p.checklists.find(x=>x.id===ch.dataset.workingComplete);if(wc)completeWorkingChecklist(p,wc)}));
  document.querySelectorAll('[data-history-checklist]').forEach(inp=>inp.addEventListener('change',()=>{const hc=p.checklists.find(x=>x.id===inp.dataset.historyChecklist);if(!hc)return;hc.sentAt=inp.value||todayISO();hc.workDate=hc.sentAt;syncHistoryForChecklist(p,hc);save('pratiche-data',pratiche,statusP||null);renderManager()}));

  const currentWorkDate=$('current-checklist-work-date');if(currentWorkDate&&c){
    currentWorkDate.addEventListener('change',()=>{c.workDate=currentWorkDate.value||todayISO();save('pratiche-data',pratiche,statusP||null)});
  }
  const completeCurrent=$('complete-current-checklist');if(completeCurrent&&c){
    completeCurrent.addEventListener('change',()=>{if(!completeCurrent.checked)return;c.workDate=$('current-checklist-work-date')?.value||c.workDate||todayISO();completeWorkingChecklist(p,c)});
  }

  if(!c)return;
  const list=$('check-list');if(list){
    list.addEventListener('input',e=>{const row=e.target.closest('[data-check-id]'),item=c.items.find(i=>i.id===row?.dataset.checkId);if(item&&e.target.dataset.checkF==='text')item.text=e.target.value});
    list.addEventListener('change',e=>{const row=e.target.closest('[data-check-id]'),item=c.items.find(i=>i.id===row?.dataset.checkId);if(!item)return;if(e.target.dataset.checkF==='done')item.done=e.target.checked;save('pratiche-data',pratiche,statusP||null);renderManager()});
    list.addEventListener('click',e=>{if(!e.target.dataset.checkDel||c.sent)return;const row=e.target.closest('[data-check-id]');c.items=c.items.filter(i=>i.id!==row.dataset.checkId);save('pratiche-data',pratiche,statusP||null);renderManager()});
  }

  const addItem=$('add-check-item');if(addItem)addItem.addEventListener('click',()=>{
    if(c.sent)return;
    c.items.push({id:uid(),text:'',done:false});
    save('pratiche-data',pratiche,statusP||null);renderManager();
    const inputs=document.querySelectorAll('#check-list input[data-check-f="text"]');if(inputs.length)inputs[inputs.length-1].focus();
  });

  const del=$('delete-practice-checklist');if(del)del.addEventListener('click',()=>{
    if(!confirm(`Eliminare la checklist “${c.name}” da questa pratica?`))return;
    p.checklists=p.checklists.filter(x=>x.id!==c.id);
    p.history=p.history.filter(h=>h.checklistId!==c.id);
    managerChecklistId=p.checklists.find(x=>!x.sent)?.id||p.checklists[0]?.id||'';
    save('pratiche-data',pratiche,statusP||null);renderManager();
  });

  const saveBtn=$('save-send-data');if(saveBtn)saveBtn.addEventListener('click',()=>{
    c.sentAt=$('send-date').value||todayISO();c.workDate=c.sentAt;c.protocol=$('send-protocol').value.trim();c.protocolDate=$('send-protocol-date').value;c.sendNote=$('send-note').value.trim();syncHistoryForChecklist(p,c);save('pratiche-data',pratiche,statusP||null);renderManager()
  });

  const reopen=$('reopen-checklist');if(reopen)reopen.addEventListener('click',()=>{
    if(!confirm('Riaprire questa checklist? Verrà tolta dalla storia pratica e tornerà tra quelle in lavorazione.'))return;
    c.sent=false;c.workDate=c.sentAt||todayISO();c.sentAt='';syncHistoryForChecklist(p,c);save('pratiche-data',pratiche,statusP||null);renderManager()
  });
}

$('practice-manager-select').addEventListener('change',e=>{
  managerPracticeId=e.target.value;
  const p=currentPractice();
  managerChecklistId=p?.checklists?.find(c=>!c.sent)?.id||p?.checklists?.[0]?.id||'';
  renderManager();
});

function renderDerived(){renderDashboard();renderScadenze();renderClienti();renderManager();renderTemplates()}
window.addEventListener('cloud-storage-change',event=>{try{const d=event.detail||{};if(d.key==='pratiche-data'){const parsed=JSON.parse(d.value||'[]');if(Array.isArray(parsed)){const incoming=parsed.map(normalizePratica);if(JSON.stringify(incoming)!==JSON.stringify(pratiche)){pratiche=incoming;renderPratiche();renderDerived()}if(statusP)statusP.textContent='sincronizzato';if(statusPA)statusPA.textContent='sincronizzato'}}else if(d.key==='candidature-data'){const parsed=JSON.parse(d.value||'[]');if(Array.isArray(parsed)){const incoming=parsed.map(normalizeCandidatura);if(JSON.stringify(incoming)!==JSON.stringify(candidature)){candidature=incoming;renderCandidature()}statusC.textContent=statusCA.textContent='sincronizzato'}}else if(d.key==='checklist-templates-data'){const parsed=JSON.parse(d.value||'[]');if(Array.isArray(parsed)){const incoming=parsed.map(normalizeTemplate);if(JSON.stringify(incoming)!==JSON.stringify(templates)){templates=incoming;renderTemplates();renderManager()}}}}catch(e){console.warn('Aggiornamento cloud non applicato',e)}});
$('logoutBtn').addEventListener('click',()=>window.REGISTRO_AUTH&&window.REGISTRO_AUTH.signOut());
(async function init(){if(statusP)statusP.textContent='caricamento…';if(statusPA)statusPA.textContent='caricamento…';statusC.textContent=statusCA.textContent='caricamento…';const [p,c,t]=await Promise.all([load('pratiche-data'),load('candidature-data'),load('checklist-templates-data')]);pratiche=Array.isArray(p)?p.map(normalizePratica):[];candidature=Array.isArray(c)?c.map(normalizeCandidatura):[];templates=Array.isArray(t)?t.map(normalizeTemplate):[];renderPratiche();renderCandidature();resetTemplateEditor();renderDerived();if(statusP)statusP.textContent=pratiche.length?'caricato':'pronto';if(statusPA)statusPA.textContent=pratiche.length?'caricato':'pronto';statusC.textContent=statusCA.textContent=candidature.length?'caricato':'pronto'})();
})();