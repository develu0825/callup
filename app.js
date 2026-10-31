/* CallUp — front-end logic (static). Calls /api/tts for real-time ElevenLabs voice. */
'use strict';

const VOICES = {
  friendly: ["OvTkybmc1V7PSr5ZtPyB","riyVjLD9uHmhgqhdR3Ca","KL33rJTFm08a5AEllU2E"],
  pushy:    ["qToCG7bgF8G0zajnlOmw","2vf24balTe1yDpUUeIUK","xFizPEpp9YbGGa2b3Q6E"],
};
const pickVoice = d => { const a = VOICES[d]; return a[Math.floor(Math.random()*a.length)]; };

const SCN = {
  A: { title:"면접 일정 콜백", name:"OO기업 인사팀", role:"채용담당자 · 면접 일정 콜백",
    friendly:{ beats:[
      "안녕하세요, OO기업 인사팀입니다. 지원자님 되실까요?",
      "네 반갑습니다! 서류 합격하셔서 면접 일정 잡으려고 연락드렸어요. 지금 통화 괜찮으세요?",
      "다음 주 화요일 오후 2시랑 수요일 오전 10시 중에 편한 시간 있으실까요?",
      "좋아요, 그럼 그 시간으로 잡아둘게요.",
      "그럼 그때 뵙겠습니다. 좋은 하루 보내세요!"
    ], method:"아, 면접은 대면으로 진행되고 30분 정도 예상하시면 돼요." },
    pushy:{ beats:[
      "네 OO기업 인사팀인데요, 지원자님 맞으시죠? 제가 지금 좀 바빠서 빨리 여쭤볼게요.",
      "서류 합격하셨고요, 면접 일정만 빨리 정하면 돼요. 이번 주 목요일 오후 4시 가능하세요?",
      "안 되시면 금요일 오전 11시요. 둘 중 언제가 되세요?",
      "네 그걸로 할게요. 더 질문 없으시죠?",
      "그럼 그때 봬요. 끊겠습니다."
    ], method:"대면이에요, 본사로 오시면 됩니다. 30분 정도요." } },
  B: { title:"면접 일정 변경", name:"OO기업 인사팀", role:"채용담당자 · 면접 일정 변경",
    friendly:{ beats:[
      "네, OO기업 인사팀입니다. 면접 관련해서 문의 주셨어요?",
      "아 일정 변경이요? 네, 어떤 사정이신지 말씀해 주시겠어요?",
      "그러시군요. 그럼 언제로 바꾸고 싶으세요?",
      "네, 그 시간으로 조정해 드릴게요.",
      "그럼 변경된 일정으로 뵐게요. 연락 주셔서 감사해요!"
    ], method:"면접 방식은 기존과 동일하게 대면으로 진행돼요." },
    pushy:{ beats:[
      "일정 변경이요? 음... 지금 면접 슬롯이 거의 찼는데요. 어떤 사정이신가요?",
      "흠, 그럼 언제로 바꾸시려고요? 가능한 날이 많진 않아요.",
      "...알겠습니다. 그 시간 비는지 확인되면 그걸로 할게요.",
      "네, 변경해 둘게요. 다음부턴 미리 좀 알려주세요.",
      "그럼 그때 뵙겠습니다. 끊을게요."
    ], method:"방식은 그대로 대면이에요. 장소도 동일합니다." } },
};
const GENTLE = "여보세요? 천천히 말씀하셔도 괜찮아요.";
const METHOD_RE = /(대면|화상|비대면|온라인|오프라인|어디|장소|방식|어떻게 진행)/;

/* ---- state ---- */
let sel = { sc:"A", diff:{A:"friendly",B:"friendly"} };
let call = null;

/* ---- helpers ---- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
function show(id){ $$('.view').forEach(v=>v.classList.toggle('on', v.id===id)); const sc=$('#'+id); if(sc) sc.scrollTop=0; }
const store = {
  get(){ try{ return JSON.parse(localStorage.getItem('callup_sessions')||'[]'); }catch(_){ return []; } },
  add(s){ const a=this.get(); a.push(s); localStorage.setItem('callup_sessions', JSON.stringify(a)); }
};

/* ---- home interactions ---- */
$$('.scard').forEach(c=>c.addEventListener('click', e=>{
  if(e.target.closest('.seg')) return;
  sel.sc = c.dataset.sc;
  $$('.scard').forEach(x=>x.classList.toggle('sel', x===c));
}));
$$('.seg[data-diff-for] button').forEach(b=>b.addEventListener('click', e=>{
  const seg=b.closest('.seg'); const sc=seg.dataset.diffFor;
  seg.querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===b));
  sel.diff[sc]=b.dataset.diff;
}));
$$('.tab').forEach(t=>t.addEventListener('click',()=>{ show(t.dataset.tab); if(t.dataset.tab==='v-growth') renderGrowth(); }));

$('#go-precall').addEventListener('click',()=>{
  const d = sel.diff[sel.sc];
  $('#pc-scn').textContent = `${SCN[sel.sc].title} · ${d==='friendly'?'친절':'재촉'}`;
  $('#pc-slider').value=5; $('#pc-num').textContent='5';
  show('v-precall');
});
$('#pc-back').addEventListener('click',()=>show('v-home'));
$('#pc-slider').addEventListener('input',e=>$('#pc-num').textContent=e.target.value);
$('#start-call').addEventListener('click',()=>startCall(parseInt($('#pc-slider').value,10)));

/* ---- call engine ---- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

function startCall(burdenBefore){
  const sc=sel.sc, diff=sel.diff[sc], data=SCN[sc][diff];
  call = { sc, diff, data, voiceId:pickVoice(diff), idx:-1, methodGiven:false,
    transcript:[], burdenBefore, t0:Date.now(), muted:false, rec:null, silence:null, gentleBeat:-1, ended:false, audio:null };
  $('#call-name').textContent = SCN[sc].name;
  $('#call-role').textContent = SCN[sc].role;
  $('#call-diff').textContent = (diff==='friendly'?'친절':'재촉')+' 모드';
  $('#cap-text').textContent = '연결 중…';
  $('#youline').textContent=''; $('#tin-input').value='';
  $('#textfallback').style.display = SR ? 'none':'flex';
  show('v-call');
  startTimer();
  setupRecognition();
  setTimeout(()=>advance(), 700); // recruiter opens
}

function startTimer(){
  const el=$('#call-timer');
  clearInterval(call._tm);
  call._tm=setInterval(()=>{
    if(!call||call.ended) return;
    const s=Math.floor((Date.now()-call.t0)/1000);
    el.textContent = String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
  },500);
}

async function speak(text){
  if(!call||call.ended) return;
  $('#cap-text').textContent = text;
  call.transcript.push({role:'recruiter', text});
  $('#callbox').classList.add('speaking');
  pauseListening();
  try{
    const res = await fetch('/api/tts',{ method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ text, voiceId: call.voiceId }) });
    if(!res.ok) throw new Error('tts '+res.status);
    const url = URL.createObjectURL(await res.blob());
    const a = new Audio(url); call.audio=a;
    if(call.muted) a.muted=true;
    await a.play().catch(()=>{});
    await new Promise(r=>{ a.onended=r; a.onerror=r; });
  }catch(_){
    // fallback: browser TTS
    try{ await new Promise(r=>{ const u=new SpeechSynthesisUtterance(text); u.lang='ko-KR'; u.onend=r; u.onerror=r; speechSynthesis.cancel(); if(!call.muted) speechSynthesis.speak(u); else r(); }); }catch(__){}
  }
  $('#callbox').classList.remove('speaking');
  if(call && !call.ended){ resumeListening(); armSilence(); }
}

function advance(){
  if(!call||call.ended) return;
  call.idx++;
  const beats=call.data.beats;
  if(call.idx >= beats.length){ return; }
  const isLast = call.idx === beats.length-1;
  speak(beats[call.idx]).then(()=>{ if(isLast && call && !call.ended) setTimeout(endCall, 1800); });
}

function handleUser(text){
  if(!call||call.ended||!text) return;
  text=text.trim(); if(!text) return;
  clearSilence();
  call.transcript.push({role:'user', text});
  $('#youline').innerHTML='<span>나</span> · '+escapeHtml(text);
  if(!call.methodGiven && METHOD_RE.test(text) && call.data.method && call.idx < call.data.beats.length-1){
    call.methodGiven=true;
    speak(call.data.method);
    return;
  }
  advance();
}

/* ---- speech recognition ---- */
function setupRecognition(){
  if(!SR){ return; }
  const rec=new SR(); rec.lang='ko-KR'; rec.continuous=true; rec.interimResults=true;
  let finalBuf='';
  rec.onresult=e=>{
    let interim='';
    for(let i=e.resultIndex;i<e.results.length;i++){
      const r=e.results[i];
      if(r.isFinal){ finalBuf=r[0].transcript; }
      else interim+=r[0].transcript;
    }
    if(interim && !call.ended){ $('#youline').innerHTML='<span>나</span> · '+escapeHtml(interim); clearSilence(); }
    if(finalBuf){ const t=finalBuf; finalBuf=''; handleUser(t); }
  };
  rec.onerror=()=>{};
  rec.onend=()=>{ if(call && !call.ended && call._listening){ try{ rec.start(); }catch(_){} } };
  call.rec=rec;
  resumeListening();
}
function resumeListening(){ if(!call||!call.rec||call.muted) return; call._listening=true; try{ call.rec.start(); }catch(_){} }
function pauseListening(){ if(!call||!call.rec) return; call._listening=false; try{ call.rec.stop(); }catch(_){} }
function armSilence(){
  clearSilence();
  call.silence=setTimeout(()=>{
    if(call && !call.ended && call.gentleBeat!==call.idx){ call.gentleBeat=call.idx; speak(GENTLE); }
  }, 6500);
}
function clearSilence(){ if(call&&call.silence){ clearTimeout(call.silence); call.silence=null; } }

/* ---- controls ---- */
$('#btn-mic').addEventListener('click',()=>{
  if(!call) return;
  if(call._listening){ pauseListening(); $('#btn-mic').classList.remove('listening'); }
  else { resumeListening(); $('#btn-mic').classList.add('listening'); }
});
$('#btn-mute').addEventListener('click',()=>{
  if(!call) return; call.muted=!call.muted;
  $('#btn-mute').classList.toggle('active', call.muted);
  if(call.audio) call.audio.muted=call.muted;
});
$('#btn-end').addEventListener('click', endCall);
$('#call-back').addEventListener('click', ()=>{ abortCall(); show('v-home'); });
$('#tin-send').addEventListener('click',()=>{ const v=$('#tin-input').value; $('#tin-input').value=''; handleUser(v); });
$('#tin-input').addEventListener('keydown',e=>{ if(e.key==='Enter'){ const v=e.target.value; e.target.value=''; handleUser(v); } });

function abortCall(){ if(!call) return; call.ended=true; clearInterval(call._tm); clearSilence(); pauseListening(); if(call.audio){try{call.audio.pause();}catch(_){}} try{speechSynthesis.cancel();}catch(_){}
  $('#btn-mic').classList.remove('listening'); call=null; }

/* ---- end & scoring ---- */
function endCall(){
  if(!call||call.ended) return;
  call.ended=true; clearInterval(call._tm); clearSilence(); pauseListening();
  if(call.audio){try{call.audio.pause();}catch(_){}} try{speechSynthesis.cancel();}catch(_){}
  $('#btn-mic').classList.remove('listening');
  const result = score(call);
  store.add({ when:Date.now(), sc:call.sc, diff:call.diff, score:result.overall,
    burdenBefore:call.burdenBefore, burdenAfter:Math.max(0,call.burdenBefore-3) });
  renderReport(result, call.burdenBefore);
  call=null;
  show('v-report');
}

function score(c){
  const u = c.transcript.filter(t=>t.role==='user').map(t=>t.text);
  const all = u.join(' ');
  const last = u[u.length-1]||'';
  const has = re => re.test(all);
  const tasks = [
    { key:'opening', label:'첫마디 · 본인확인',
      status: u.length? (/(네|예|맞|접니다|안녕|여보세요)/.test(u[0]||'')?'done':'part') : 'missing',
      ev: u.length? '통화 시작에 응답함' : '첫마디 응답이 없었어요' },
    { key:'datetime', label:'면접 일시 확정',
      status: has(/(\d+\s*시|오전|오후|요일|월요일|화요일|수요일|목요일|금요일|내일|모레|다음\s*주|이번\s*주|날짜|시간)/)?'done':'missing',
      ev: has(/(\d+\s*시|오전|오후|요일)/)?'일시를 언급해 조율함':'일시를 확정하지 못했어요' },
    { key:'method', label:'면접 방식(대면/화상) 확인',
      status: has(METHOD_RE)?'done':'chk',
      ev: has(METHOD_RE)?'진행 방식을 확인함':'대면/화상 여부를 못 물어봤어요' },
    { key:'closing', label:'마무리 재확인',
      status: /(감사|고맙|안녕|들어가|확인|알겠|맞[죠나요])/.test(last)?'done':'part',
      ev: /(감사|고맙)/.test(last)?'감사 인사로 마무리함':'마무리 인사·재확인이 약했어요' },
  ];
  const politeMatches = (all.match(/(감사|죄송|부탁|주시|주세요|세요|습니다|괜찮|실례)/g)||[]).length;
  const avgLen = u.length? u.reduce((s,t)=>s+t.split(/\s+/).length,0)/u.length : 0;
  const clamp=(n,a=30,b=97)=>Math.max(a,Math.min(b,Math.round(n)));
  const doneCount = tasks.filter(t=>t.status==='done').length;
  const scores = {
    clarity: clamp(45 + u.length*6 + doneCount*8),
    politeness: clamp(58 + politeMatches*6),
    pace: clamp(avgLen>=4 && avgLen<=16 ? 82 : 66),
    recovery: clamp(c.gentleBeat>=0 ? 62 : 85),
  };
  const overall = Math.round((scores.clarity+scores.politeness+scores.pace+scores.recovery)/4);
  const tips=[];
  if(tasks[2].status!=='done') tips.push('일시를 정한 뒤 "대면인가요, 화상인가요?"를 꼭 물어보세요.');
  if(tasks[1].status!=='done') tips.push('"화요일 2시로 할게요"처럼 날짜·시간을 분명히 말해 확정하세요.');
  if(tasks[3].status!=='done') tips.push('끝맺기 전 "그럼 화요일 2시 맞죠?"로 한 번 더 확인하면 완벽해요.');
  if(tips.length<2) tips.push('좋아요! 다음엔 조금 더 또박또박, 천천히 말해보면 완벽해요.');
  const title = overall>=80? '첫마디부터 끝까지 잘 이어갔어요!' : overall>=60? '점점 좋아지고 있어요, 거의 다 왔어요!' : '괜찮아요, 한 번 더 하면 분명 늘어요!';
  return { tasks, scores, overall, tips:tips.slice(0,3), title };
}

/* ---- report render ---- */
const CHECK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4 10-10"/></svg>';
const DASH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12h14"/></svg>';
const BANG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 7v6M12 16v.5"/></svg>';
const STMAP={ done:['done','완료',CHECK], part:['part','보완',DASH], chk:['chk','확인 필요',BANG], missing:['missing','놓침',BANG] };
function renderReport(r, before){
  $('#rep-title').textContent=r.title;
  $('#rep-tasks').innerHTML = r.tasks.map(t=>{
    const [cls,label,icon]=STMAP[t.status];
    return `<div class="task"><span class="tmark ${cls}">${icon}</span><div><div class="tt">${t.label}</div><div class="ev">${t.ev}</div></div><span class="pill ${cls}">${label}</span></div>`;
  }).join('');
  const M=[['핵심 전달','clarity',''],['공손함','politeness','mint'],['말 속도','pace',''],['막힘 극복','recovery','']];
  $('#rep-meters').innerHTML = M.map(([lab,k,mint])=>`<div class="meter"><div class="ml"><span>${lab}</span><b>${r.scores[k]}</b></div><div class="bar ${mint}"><i style="width:${r.scores[k]}%"></i></div></div>`).join('');
  const after=Math.max(0,before-3);
  $('#bn-before').textContent='연습 전 '+before;
  $('#after-slider').value=after;
  updateAfter(after);
  $('#rep-tips').innerHTML = r.tips.map(t=>`<div class="tip"><span class="d"></span>${t}</div>`).join('');
}
function face(n){ return n<=2?'😌':n<=5?'🙂':n<=7?'😟':'😣'; }
function updateAfter(n){ $('#bf-after').textContent=face(n); $('#bn-after').textContent='연습 후 '+n; $('#bf-before').textContent=face(parseInt($('#bn-before').textContent.replace(/\D/g,''),10)||5); }
$('#after-slider').addEventListener('input',e=>updateAfter(parseInt(e.target.value,10)));
$('#rep-again').addEventListener('click',()=>{ $('#pc-slider').value=5;$('#pc-num').textContent='5'; show('v-precall'); });
$('#rep-home').addEventListener('click',()=>show('v-home'));

/* ---- growth ---- */
function renderGrowth(){
  const a=store.get();
  $('#g-total').textContent=a.length;
  $('#g-streak').textContent = a.length? '3':'0';
  $('#g-avg').textContent = a.length? Math.round(a.reduce((s,x)=>s+x.score,0)/a.length):'—';
  const week=a.filter(x=>Date.now()-x.when<7*864e5).length;
  $('#weekcount').textContent='이번 주 '+week+'통';
  // chart of burdenAfter
  const vals = a.slice(-8).map(x=>x.burdenAfter);
  const chart=$('#g-chart'); chart.innerHTML='';
  if(vals.length<2){ chart.innerHTML='<text x="140" y="52" text-anchor="middle" fill="#B7B4D0" font-size="12">연습을 2회 이상 하면 그래프가 그려져요</text>'; $('#g-drop').textContent='—'; }
  else{
    const W=280,H=96,pad=10, max=10;
    const xs=i=>pad+i*(W-2*pad)/(vals.length-1);
    const ys=v=>pad+(v/max)*(H-2*pad);
    const pts=vals.map((v,i)=>[xs(i),ys(v)]);
    const line=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
    const area=line+` L${xs(vals.length-1)},${H} L${pad},${H} Z`;
    chart.innerHTML=`<defs><linearGradient id="af" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(110,108,240,.28)"/><stop offset="100%" stop-color="rgba(110,108,240,0)"/></linearGradient></defs>
      <line x1="0" y1="33" x2="280" y2="33" stroke="#EDECF8"/><line x1="0" y1="66" x2="280" y2="66" stroke="#EDECF8"/>
      <path d="${area}" fill="url(#af)"/><path d="${line}" fill="none" stroke="#6E6CF0" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${pts[pts.length-1][0].toFixed(1)}" cy="${pts[pts.length-1][1].toFixed(1)}" r="4.6" fill="#44CDB9"/>`;
    const drop=vals[0]-vals[vals.length-1];
    $('#g-drop').textContent = drop>0? `▼ ${drop}점 낮아짐` : '유지 중';
  }
  const names={A:'면접 일정 콜백',B:'면접 일정 변경'};
  const PH='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.6 10.8a12 12 0 0 0 6.6 6.6l2-2a1.3 1.3 0 0 1 1.4-.3 9 9 0 0 0 3 .5A1.3 1.3 0 0 1 21 17v3a1.3 1.3 0 0 1-1.3 1.3A16.7 16.7 0 0 1 3 4.3 1.3 1.3 0 0 1 4.3 3h3A1.3 1.3 0 0 1 9 4.3a9 9 0 0 0 .5 3 1.3 1.3 0 0 1-.3 1.4l-2 2Z"/></svg>';
  const list=$('#g-list');
  if(!a.length){ list.innerHTML='<div class="empty">아직 연습 기록이 없어요.<br>첫 통화를 연습해볼까요?</div>'; return; }
  list.innerHTML=a.slice().reverse().slice(0,6).map(x=>{
    const col = x.score>=80?'var(--mint)':x.score>=65?'var(--amber)':'var(--muted)';
    const ago = daysAgo(x.when);
    return `<div class="rec"><div class="ri">${PH}</div><div><div class="rn">${names[x.sc]} · ${x.diff==='friendly'?'친절':'재촉'}</div><div class="rd">${ago} · 부담감 ${x.burdenAfter}</div></div><span class="rs" style="color:${col}">${x.score}</span></div>`;
  }).join('');
}
function daysAgo(t){ const d=Math.floor((Date.now()-t)/864e5); return d<=0?'오늘':d===1?'어제':d+'일 전'; }
function escapeHtml(s){ return s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* init */
renderGrowth();
