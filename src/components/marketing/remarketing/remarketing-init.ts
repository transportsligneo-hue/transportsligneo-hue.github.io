// @ts-nocheck
/* eslint-disable */
function film():()=>void{
const vf=document.getElementById('vf'),stg=document.getElementById('vfs'),scs=[...vf.querySelectorAll('.sc')],cap=document.getElementById('vfcap');
const S=[0,4.2,8,11.8,18.3,24.3,29.3,33.1,42.1],T=45.6;
const TX=[["01","Un véhicule à remettre en route","Fin de leasing, nouveau collaborateur, revente : on prend le relais."],["02","On vient le chercher","Chauffeur contrôlé, photos datées, trajet suivi en direct."],["03","Bilan et devis à valider","Vous acceptez le devis avant toute intervention."],["04","Réparé chez nos prestataires","Tous les trajets aller-retour entre nos prestataires sont à notre charge."],["05","Contrôle et préparation","Inspection, lavage, nettoyage intérieur et contrôle final."],["06","Garé en parc partenaire","Parc clôturé : accès contrôlé, caméras 24h/24, statut visible chez vous."],["07","Livré au conducteur suivant","Sur demande, remis contre un code avec constat signé."],["08","Une remise en état à moindre coût","Nos prestataires, en amont, et des économies chiffrées avec vous avant de valider."],null];
let t=0,st='idle',cur=-1,last=0,dead=false,raf=0;const tm={};
const pm=e=>{vf.querySelectorAll('.vr').forEach(av=>{const r=av.getBoundingClientRect();if(!r.width)return;const dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height*.4),d=Math.hypot(dx,dy)||1,k=Math.min(1,d/260),s=r.width/940;av.querySelectorAll('.ir').forEach(i=>i.style.transform='translate('+(dx/d*k*9*s)+'px,'+(dy/d*k*10*s)+'px)')})};document.addEventListener('pointermove',pm);
function fit(){stg.style.transform='scale('+(vf.clientWidth/1280)+')'}
const ro=new ResizeObserver(fit);ro.observe(vf);fit();
function show(i,force){
 if(i===cur&&!force)return;
 scs.forEach((s,k)=>{if(k===i)return;if(s.classList.contains('on')&&!s.classList.contains('out')){s.classList.add('out');clearTimeout(tm[k]);tm[k]=setTimeout(()=>{s.classList.remove('on','out')},450)}});
 const n=scs[i];clearTimeout(tm[i]);n.classList.remove('on','out');void n.offsetWidth;n.classList.add('on');cur=i;
 const x=TX[i];cap.classList.toggle('h',!x);if(x){document.getElementById('vfn').textContent=x[0]+' / 08';document.getElementById('vft').textContent=x[1];document.getElementById('vfsb').textContent=x[2]}
}
function idx(){let k=0;for(let j=0;j<S.length;j++)if(t>=S[j])k=j;return k}
function ui(){document.getElementById('vfpg').style.width=(t/T*100)+'%';const s=Math.floor(t);document.getElementById('vftm').textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function tick(ts){const dt=Math.min(.1,(ts-last)/1000||0);last=ts;
 if(st==='play'){t+=dt;if(t>=T){t=T;st='end';vf.classList.remove('run');vf.classList.remove('pz');const b=document.getElementById('vfbig');b.classList.add('rp');b.setAttribute('aria-label','Revoir')}show(idx());ui()}
 if(!dead)raf=requestAnimationFrame(tick)}
function start(){t=0;st='play';vf.classList.add('run');vf.classList.remove('pz');document.getElementById('vfbig').classList.remove('rp');show(0,true);ui()}
document.getElementById('vfbig').onclick=start;
document.getElementById('vfp').onclick=()=>{if(st==='play'){st='pause';vf.classList.add('pz')}else if(st==='pause'){st='play';vf.classList.remove('pz')}};
document.getElementById('vftr').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();t=Math.max(0,Math.min(T-.01,(e.clientX-r.left)/r.width*T));show(idx(),true);ui()};
show(0,true);raf=requestAnimationFrame(tick);
(window as any).vfApi={start,seek:(s:number)=>{t=s;st='pause';vf.classList.add('run','pz');show(idx(),true);ui()}};
return()=>{dead=true;cancelAnimationFrame(raf);ro.disconnect();document.removeEventListener('pointermove',pm);Object.values(tm).forEach(x=>clearTimeout(x))};
}

function steps():()=>void{
const sts=[...document.querySelectorAll('.rmk .st')],ol=document.getElementById('ol'),fill=document.getElementById('fill');
if(!ol||!fill)return()=>{};
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('in')}),{rootMargin:'0px 0px -22% 0px',threshold:.2});sts.forEach(s=>io.observe(s));
function upd(){const r=ol.getBoundingClientRect(),h=innerHeight*.62;fill.style.height=Math.max(0,Math.min(r.height,h-r.top))+'px'}
addEventListener('scroll',upd,{passive:true});addEventListener('resize',upd);upd();
return()=>{io.disconnect();removeEventListener('scroll',upd);removeEventListener('resize',upd)};
}
export function initRemarketing():()=>void{const a=film(),b=steps();return()=>{a();b()}}
