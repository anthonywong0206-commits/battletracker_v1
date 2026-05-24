import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Trophy, Shuffle, Swords, CalendarDays, Download, Upload, RotateCcw, Copy, Search, Settings, Brackets, Users, Medal, Home, PlayCircle, Moon, Sun, Crown } from 'lucide-react'
import html2canvas from 'html2canvas'
import './styles.css'

const STORAGE_KEY = 'battlebracket:v1'
const uid = () => Math.random().toString(36).slice(2, 10)
const bye = { id: 'BYE', name: 'BYE', code: '', team: '', seed: 9999, isBye: true }

const emptyTournament = () => ({
  id: uid(), name: '', type: '拳賽', format: 'best1', mode: 'single', customRules: { games: 1, wins: 1 }, date: '', venue: '', participants: [], rounds: [], status: 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
})

function parseParticipants(text) {
  return text.split('\n').map(x => x.trim()).filter(Boolean).map((line, i) => {
    const parts = line.match(/"[^"]+"|\S+/g)?.map(p => p.replace(/^"|"$/g, '')) || []
    return { id: uid(), name: parts[0] || `參加者${i+1}`, code: parts[1] || '', team: parts.slice(2).join(' ') || '', seed: i + 1 }
  })
}
function nextPow2(n) { return Math.pow(2, Math.ceil(Math.log2(Math.max(2, n)))) }
function shuffle(arr) { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a }
function getRule(format, customRules){
  if(format==='best3') return { games:3, wins:2, label:'三盤兩勝' }
  if(format==='best5') return { games:5, wins:3, label:'五局三勝' }
  if(format==='custom') return { games:Number(customRules.games)||1, wins:Number(customRules.wins)||1, label:`自訂：${customRules.games}局${customRules.wins}勝` }
  return { games:1, wins:1, label:'單回合制' }
}
function playerName(p){ return p?.name || '待定' }
function isBye(p){ return !p || p.isBye || p.id === 'BYE' }
function makeMatch(roundIndex, matchIndex, a=null, b=null){ return { id: uid(), roundIndex, matchIndex, playerA:a, playerB:b, scores:[], winner:null, status:'未開始' } }
function buildInitialRounds(tournament, randomized=false){
  const players = randomized ? shuffle(tournament.participants) : [...tournament.participants].sort((a,b)=>(a.seed||999)-(b.seed||999))
  const size = nextPow2(players.length)
  while(players.length < size) players.push({...bye})
  const roundCount = Math.log2(size)
  const rounds = []
  for(let r=0;r<roundCount;r++){
    const matchCount = size / Math.pow(2, r+1)
    rounds.push({ id: uid(), name: r===roundCount-1?'決賽':`第 ${r+1} 輪`, matches: Array.from({length:matchCount},(_,m)=>makeMatch(r,m)) })
  }
  for(let i=0;i<players.length;i+=2){
    rounds[0].matches[i/2] = makeMatch(0, i/2, players[i], players[i+1])
  }
  return autoResolveAndPropagate(rounds, tournament)
}
function countWins(scores){
  let a=0,b=0
  scores.forEach(s=>{ const av=Number(s.a), bv=Number(s.b); if(Number.isFinite(av)&&Number.isFinite(bv)&&s.a!==''&&s.b!==''){ if(av>bv)a++; if(bv>av)b++; } })
  return {a,b}
}
function decideWinner(match, tournament){
  if(isBye(match.playerA) && isBye(match.playerB)) return null
  if(isBye(match.playerA)) return match.playerB
  if(isBye(match.playerB)) return match.playerA
  if(match.manualWinner) return match.manualWinner
  const rule = getRule(tournament.format, tournament.customRules)
  const wins = countWins(match.scores || [])
  if(wins.a >= rule.wins) return match.playerA
  if(wins.b >= rule.wins) return match.playerB
  return null
}
function clearFuture(rounds, fromRound, matchIndex){
  const nextRound = fromRound + 1
  if(!rounds[nextRound]) return
  const nextMatchIndex = Math.floor(matchIndex / 2)
  const slot = matchIndex % 2 === 0 ? 'playerA' : 'playerB'
  rounds[nextRound].matches[nextMatchIndex][slot] = null
  rounds[nextRound].matches[nextMatchIndex].winner = null
  rounds[nextRound].matches[nextMatchIndex].manualWinner = null
  rounds[nextRound].matches[nextMatchIndex].scores = []
  rounds[nextRound].matches[nextMatchIndex].status = '未開始'
  clearFuture(rounds, nextRound, nextMatchIndex)
}
function autoResolveAndPropagate(inputRounds, tournament){
  const rounds = inputRounds.map(r=>({...r, matches:r.matches.map(m=>({...m, playerA:m.playerA?{...m.playerA}:null, playerB:m.playerB?{...m.playerB}:null, winner:m.winner?{...m.winner}:null, manualWinner:m.manualWinner?{...m.manualWinner}:null, scores:[...(m.scores||[])]}))}))
  for(let r=0;r<rounds.length;r++){
    rounds[r].matches.forEach((match, mi)=>{
      const winner = decideWinner(match, tournament)
      match.winner = winner
      if(winner) match.status = '已完成'
      else if((match.scores||[]).some(s=>s.a!==''||s.b!=='')) match.status = '進行中'
      else match.status = '未開始'
      if(winner && rounds[r+1]){
        const target = rounds[r+1].matches[Math.floor(mi/2)]
        if(mi % 2 === 0) target.playerA = winner
        else target.playerB = winner
      }
    })
  }
  return rounds
}
function App(){
  const [tab,setTab]=useState('create')
  const [dark,setDark]=useState(true)
  const [participantText,setParticipantText]=useState('陳大文 A01 青龍隊\n李小明 A02 白虎隊\n王小虎 A03 朱雀隊\n張美玲 A04 玄武隊')
  const [tournament,setTournament]=useState(()=>{ try{return JSON.parse(localStorage.getItem(STORAGE_KEY)) || emptyTournament()}catch{return emptyTournament()} })
  const [search,setSearch]=useState('')
  const bracketRef=useRef(null)
  useEffect(()=>{ localStorage.setItem(STORAGE_KEY, JSON.stringify({...tournament, updatedAt:new Date().toISOString()})) },[tournament])
  const rule = getRule(tournament.format,tournament.customRules)
  const champion = tournament.rounds?.at(-1)?.matches?.[0]?.winner
  const parsed = useMemo(()=>parseParticipants(participantText),[participantText])
  function patch(obj){ setTournament(t=>({...t,...obj, updatedAt:new Date().toISOString()})) }
  function createSchedule(randomized=false){
    const participants = parseParticipants(participantText)
    if(participants.length < 2){ alert('最少需要 2 位參加者'); return }
    const base = {...tournament, participants, status:'scheduled'}
    base.rounds = buildInitialRounds(base, randomized)
    setTournament(base); setTab('schedule')
  }
  function updateMatch(roundIndex, matchIndex, updater){
    setTournament(t=>{
      let rounds=t.rounds.map(r=>({...r, matches:r.matches.map(m=>({...m, scores:[...(m.scores||[])]}))}))
      const oldWinner = rounds[roundIndex].matches[matchIndex].winner?.id
      rounds[roundIndex].matches[matchIndex] = updater(rounds[roundIndex].matches[matchIndex])
      const newWinner = decideWinner(rounds[roundIndex].matches[matchIndex], t)?.id
      if(oldWinner && oldWinner !== newWinner) clearFuture(rounds, roundIndex, matchIndex)
      rounds = autoResolveAndPropagate(rounds, t)
      return {...t, rounds, status:'running'}
    })
  }
  async function exportPng(){
    if(!bracketRef.current) return
    const canvas = await html2canvas(bracketRef.current, { backgroundColor: '#07111f', scale: 2 })
    const a=document.createElement('a'); a.download=`${tournament.name||'BattleBracket'}-晉級圖.png`; a.href=canvas.toDataURL(); a.click()
  }
  function exportJson(){ const blob=new Blob([JSON.stringify(tournament,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`${tournament.name||'battlebracket'}.json`; a.click() }
  function importJson(e){ const f=e.target.files?.[0]; if(!f)return; const reader=new FileReader(); reader.onload=()=>{try{setTournament(JSON.parse(reader.result));setTab('bracket')}catch{alert('JSON 檔案格式不正確')}}; reader.readAsText(f) }
  function summary(){
    const lines=[`🏆 ${tournament.name||'BattleBracket'} 比賽結果`, `賽制：${rule.label}`, champion?`冠軍：${champion.name}`:'冠軍：尚未產生']
    tournament.rounds?.forEach(r=>{ lines.push(`\n${r.name}`); r.matches.forEach(m=>lines.push(`${playerName(m.playerA)} vs ${playerName(m.playerB)}｜勝方：${m.winner?.name||'待定'}`)) })
    navigator.clipboard.writeText(lines.join('\n')); alert('已複製比賽結果摘要')
  }
  const NavButton=({id,icon:Icon,label})=><button onClick={()=>setTab(id)} className={`nav-btn ${tab===id?'active':''}`}><Icon size={20}/><span>{label}</span></button>
  return <div className={dark?'dark app':'app light'}>
    <header className="topbar"><div><p className="eyebrow">競技晉級比賽制管理系統</p><h1>BattleBracket</h1><p className="subtitle">快速建立比賽、編排賽程、記錄賽果。</p></div><button className="iconbtn" onClick={()=>setDark(!dark)}>{dark?<Sun/>:<Moon/>}</button></header>
    {champion && <div className="champion"><Crown className="bounce"/> <div><b>冠軍誕生：{champion.name}</b><span>{champion.team || '恭喜勝出！'}</span></div></div>}
    <main className="content">
      {tab==='create' && <section className="grid two"><div className="card"><h2><Home/> 創建比賽</h2><label>比賽名稱<input value={tournament.name} onChange={e=>patch({name:e.target.value})} placeholder="例如：社區拳王挑戰賽"/></label><div className="row"><label>比賽類型<select value={tournament.type} onChange={e=>patch({type:e.target.value})}><option>拳賽</option><option>棋類</option><option>球類</option><option>電競</option><option>其他</option></select></label><label>比賽模式<select value={tournament.mode} onChange={e=>patch({mode:e.target.value})}><option value="single">單淘汰賽</option><option value="double" disabled>雙淘汰賽（預留）</option><option value="round" disabled>循環賽（預留）</option></select></label></div><div className="row"><label>日期<input type="date" value={tournament.date} onChange={e=>patch({date:e.target.value})}/></label><label>場地<input value={tournament.venue} onChange={e=>patch({venue:e.target.value})} placeholder="例如：主禮堂"/></label></div><label>賽制<select value={tournament.format} onChange={e=>patch({format:e.target.value})}><option value="best1">單回合制</option><option value="best3">三盤兩勝</option><option value="best5">五局三勝</option><option value="custom">自訂</option></select></label>{tournament.format==='custom'&&<div className="row"><label>總局數<input type="number" min="1" value={tournament.customRules.games} onChange={e=>patch({customRules:{...tournament.customRules,games:e.target.value}})}/></label><label>勝出局數<input type="number" min="1" value={tournament.customRules.wins} onChange={e=>patch({customRules:{...tournament.customRules,wins:e.target.value}})}/></label></div>}<div className="actions"><button className="primary" onClick={()=>createSchedule(false)}><Brackets/> 建立賽程</button><button onClick={()=>createSchedule(true)}><Shuffle/> 隨機抽籤</button></div></div><div className="card"><h2><Users/> 批量加入參加者 <small>{parsed.length} 人</small></h2><p className="hint">每行一位：姓名 編號 所屬隊伍。英文姓名可用雙引號。</p><textarea value={participantText} onChange={e=>setParticipantText(e.target.value)} /><div className="preview">{parsed.map(p=><span key={p.id}>{p.seed}. {p.name} {p.code && `｜${p.code}`} {p.team && `｜${p.team}`}</span>)}</div></div></section>}
      {tab==='schedule' && <section className="card"><h2><Shuffle/> 賽程編排</h2><div className="toolbar"><button onClick={()=>createSchedule(true)}><Shuffle/> 重新隨機抽籤</button><button onClick={()=>setTab('manage')} className="primary"><PlayCircle/> 確認賽程</button><input placeholder="搜尋參加者" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="participants">{tournament.participants.filter(p=>p.name.includes(search)||p.code.includes(search)||p.team.includes(search)).map((p,i)=><div className="person" key={p.id}><Medal size={16}/><b>{p.name}</b><span>{p.code} {p.team}</span><input type="number" value={p.seed} onChange={e=>setTournament(t=>({...t,participants:t.participants.map(x=>x.id===p.id?{...x,seed:Number(e.target.value)}:x)}))}/></div>)}</div><h3>第一輪對賽</h3><MatchList rounds={tournament.rounds} roundIndex={0} tournament={tournament} readonly /></section>}
      {tab==='manage' && <section><div className="toolbar card"><h2><Swords/> 比賽管理</h2><button onClick={summary}><Copy/> 複製摘要</button></div>{tournament.rounds?.map((r,ri)=><div className="card" key={r.id}><h3>{r.name}</h3><MatchList rounds={tournament.rounds} roundIndex={ri} tournament={tournament} updateMatch={updateMatch}/></div>)}</section>}
      {tab==='bracket' && <section><div className="toolbar card"><h2><Trophy/> 晉級圖</h2><button onClick={()=>setTab('manage')}>返回管理</button><button onClick={exportPng}><Download/> 匯出圖片</button><button onClick={exportJson}><Download/> 匯出 JSON</button><label className="filebtn"><Upload/> 匯入 JSON<input type="file" accept=".json" onChange={importJson}/></label><button className="danger" onClick={()=>{if(confirm('確定重設整個比賽？')){setTournament(emptyTournament());setParticipantText('');setTab('create')}}}><RotateCcw/> 重設</button></div><div className="bracket-wrap" ref={bracketRef}><div className="bracket-title"><Trophy/><div><h2>{tournament.name||'BattleBracket'}</h2><p>{tournament.date} {tournament.venue}｜{rule.label}</p></div></div><div className="bracket">{tournament.rounds?.map((r,ri)=><div className="round" key={r.id}><h3>{r.name}</h3>{r.matches.map(m=><div className="bmatch" key={m.id}><div className={m.winner?.id===m.playerA?.id?'winner':''}>{playerName(m.playerA)} <small>{scoreText(m,'a')}</small></div><div className={m.winner?.id===m.playerB?.id?'winner':''}>{playerName(m.playerB)} <small>{scoreText(m,'b')}</small></div><em>{m.status}</em></div>)}</div>)}</div>{champion&&<div className="winnerbox"><Trophy/> 冠軍：{champion.name}</div>}</div></section>}
    </main>
    <nav className="bottomnav"><NavButton id="create" icon={Home} label="建立"/><NavButton id="schedule" icon={Shuffle} label="賽程"/><NavButton id="manage" icon={Swords} label="管理"/><NavButton id="bracket" icon={Trophy} label="晉級圖"/></nav>
  </div>
}
function scoreText(m,side){ const wins=countWins(m.scores||[]); return side==='a'?wins.a:wins.b }
function MatchList({rounds,roundIndex,tournament,updateMatch,readonly=false}){
  const rule=getRule(tournament.format,tournament.customRules)
  const matches=rounds?.[roundIndex]?.matches||[]
  return <div className="matchgrid">{matches.map((m,mi)=><div className="matchcard" key={m.id}><div className="matchhead"><b>Match {mi+1}</b><span className={`status ${m.status}`}>{m.status}</span></div><div className="versus"><span className={m.winner?.id===m.playerA?.id?'win':''}>{playerName(m.playerA)}</span><strong>VS</strong><span className={m.winner?.id===m.playerB?.id?'win':''}>{playerName(m.playerB)}</span></div>{!readonly && <><div className="scoregrid">{Array.from({length:rule.games}).map((_,i)=><React.Fragment key={i}><label>第{i+1}局 A<input inputMode="numeric" value={m.scores?.[i]?.a ?? ''} onChange={e=>updateMatch(roundIndex,mi,old=>{const scores=[...(old.scores||[])]; scores[i]={...(scores[i]||{}),a:e.target.value}; return {...old,scores,manualWinner:null}})}/></label><label>第{i+1}局 B<input inputMode="numeric" value={m.scores?.[i]?.b ?? ''} onChange={e=>updateMatch(roundIndex,mi,old=>{const scores=[...(old.scores||[])]; scores[i]={...(scores[i]||{}),b:e.target.value}; return {...old,scores,manualWinner:null}})}/></label></React.Fragment>)}</div><div className="actions compact"><button onClick={()=>updateMatch(roundIndex,mi,old=>({...old,manualWinner:old.playerA}))} disabled={isBye(m.playerA)}>A 勝</button><button onClick={()=>updateMatch(roundIndex,mi,old=>({...old,manualWinner:old.playerB}))} disabled={isBye(m.playerB)}>B 勝</button><button onClick={()=>updateMatch(roundIndex,mi,old=>({...old,scores:[],winner:null,manualWinner:null,status:'未開始'}))}>清除</button></div></>}<p className="result">勝方：{m.winner?.name || '待定'}</p></div>)}</div>
}
createRoot(document.getElementById('root')).render(<App />)
