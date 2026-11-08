(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const W = canvas.width, H = canvas.height;
  const colors = ['#ff805e','#54d9d0','#d3c080','#bec8b9','#65aaff','#b5e9ff','#fff2c0','#bd76e7'];
  const elements = [
    {name:'EMBER',type:'FIRE',glyph:'✦',color:colors[0]}, {name:'TIDE',type:'WATER',glyph:'≈',color:colors[1]},
    {name:'GALE',type:'WIND',glyph:'⌁',color:colors[2]}, {name:'STONE',type:'STONE',glyph:'◆',color:colors[3]},
    {name:'VOLT',type:'LIGHTNING',glyph:'ϟ',color:colors[4]}, {name:'RIME',type:'ICE',glyph:'❄',color:colors[5]},
    {name:'LUX',type:'LIGHT',glyph:'☼',color:colors[6]}, {name:'UMBRA',type:'SHADOW',glyph:'◉',color:colors[7]}
  ];
  const titleUI = document.getElementById('title-ui'), loadingUI = document.getElementById('loading-ui');
  const toastNode = document.getElementById('toast');
  let phase = 'title', last = 0, time = 0, toastTimer = 0, shake = 0;
  let keys = Object.create(null), particles = [], bolts = [], enemies = [], shards = [], terminals = [], obstacles = [], debris = [];
  let terminalDone = false, summitTriggered = false, killedCount = 0;
  const player = {x:240,y:1000,hp:3,maxHp:3,faceX:0,faceY:-1,attack:0,channel:0,invuln:0,walk:0,element:0,shards:0};
  let camera = 850;
  const world = {w:480,h:1120};
  const rand = (n) => {const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function buildWorld(){
    // Rusted ribs and dormant machinery form a mostly open ascent, with a few readable combat arenas.
    obstacles = [
      {x:32,y:870,w:92,h:34,type:'wreck'},{x:352,y:810,w:91,h:42,type:'wreck'},
      {x:45,y:650,w:55,h:46,type:'console'},{x:367,y:616,w:72,h:38,type:'wreck'},
      {x:38,y:430,w:80,h:39,type:'wreck'},{x:366,y:340,w:70,h:50,type:'console'},
      {x:50,y:205,w:72,h:34,type:'wreck'},{x:357,y:158,w:74,h:44,type:'wreck'}
    ];
    terminals = [{x:240,y:600,kind:'relay',done:false},{x:240,y:270,kind:'memory',done:false}];
    shards = [{x:145,y:875},{x:330,y:720},{x:165,y:500},{x:328,y:350},{x:241,y:120}].map(s=>({...s,got:false,phase:rand(s.y)}));
    enemies = [
      makeEnemy(230,855,'sentry'),makeEnemy(302,770,'wisp'),makeEnemy(168,675,'sentry'),
      makeEnemy(245,490,'wisp'),makeEnemy(145,390,'sentry'),makeEnemy(330,195,'sentry'),makeEnemy(236,120,'warden')
    ];
    debris=[];for(let i=0;i<115;i++) debris.push({x:rand(i+40)*W,y:rand(i+500)*world.h,w:2+Math.floor(rand(i+900)*8),h:2+Math.floor(rand(i+1000)*5),c:['#242e2b','#313732','#3a3028','#263b35'][i%4]});
  }
  function makeEnemy(x,y,type){return{x,y,type,hp:type==='warden'?5:2,alive:true,phase:rand(x+y),hit:0,attack:0};}
  function message(text){toastNode.textContent=text;toastNode.classList.add('show');toastTimer=2.2;}
  function updateHud(){
    document.getElementById('hp-text').textContent=`0${player.hp} / 0${player.maxHp}`;
    document.querySelectorAll('.hearts i').forEach((el,i)=>el.classList.toggle('empty',i>=player.hp));
    document.getElementById('shard-text').textContent=`0${player.shards} / 05`;
    document.getElementById('xp-fill').style.width=`${player.shards/5*100}%`;
    const e=elements[player.element];document.getElementById('element-name').textContent=e.name;document.getElementById('element-type').textContent=e.type;
    document.getElementById('element-dot').style.background=e.color;document.getElementById('element-dot').style.boxShadow=`0 0 7px ${e.color}`;
    document.querySelectorAll('.element-chip').forEach((c,i)=>c.classList.toggle('active',i===player.element));
    const objective=document.getElementById('objective');
    objective.textContent=phase==='won'?'SIGNAL RESTORED':(player.shards>=5?'REACH THE SUMMIT':(!terminalDone?'OVERLOAD THE RELAY':'CLIMB THE TOWER'));
  }
  const elementRow=document.getElementById('element-row');
  elements.forEach((e,i)=>{const chip=document.createElement('span');chip.className='element-chip';chip.textContent=e.glyph;chip.title=`${e.name} · ${i+1}`;chip.style.setProperty('--element',e.color);chip.addEventListener('click',()=>{if(phase==='play'){player.element=i;updateHud();}});elementRow.appendChild(chip);});
  function startGame(){if(phase!=='title')return;phase='loading';titleUI.classList.add('hidden');loadingUI.classList.remove('hidden');setTimeout(()=>{loadingUI.classList.add('hidden');phase='play';message('TOWER 07 // ASCENT LOGGED');updateHud();},1550);}
  document.getElementById('start-btn').addEventListener('click',startGame);
  window.addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
    if(phase==='title'&&(k==='enter'||k===' ')){startGame();return;}
    if(phase!=='play')return;
    keys[k]=true;
    if(k==='q'){player.element=(player.element+1)%elements.length;updateHud();}
    if(k>='1'&&k<='8'){player.element=Number(k)-1;updateHud();}
    if(k===' '||k==='j')attack();
    if(k==='e'||k==='k')channel();
  });
  window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
  window.addEventListener('blur',()=>keys=Object.create(null));
  function attack(){if(player.attack>0||phase!=='play')return;player.attack=.25;shake=Math.max(shake,1.8);burstParticles(player.x+player.faceX*12,player.y+player.faceY*12,elements[player.element].color,8);
    let hit=false;for(const en of enemies){if(!en.alive)continue;const dx=en.x-player.x,dy=en.y-player.y;if(Math.hypot(dx,dy)<34&&dx*player.faceX+dy*player.faceY>-7){en.hp--;en.hit=.22;hit=true;burstParticles(en.x,en.y,'#f1d8ae',7);if(en.hp<=0){en.alive=false;killedCount++;burstParticles(en.x,en.y,'#82e9dc',20);}}}if(hit)playTone(110,.05,'square',.025);
  }
  function channel(){if(player.channel>0||phase!=='play')return;player.channel=.5;const element=elements[player.element];burstParticles(player.x,player.y,element.color,17);playTone(200+player.element*45,.12,'sine',.035);
    // The relay is a real elemental puzzle: only a lightning pulse can wake it.
    const relay=terminals[0];if(!relay.done&&Math.hypot(player.x-relay.x,player.y-relay.y)<45){
      if(player.element===4){relay.done=true;terminalDone=true;for(let i=0;i<3;i++)setTimeout(()=>{for(const en of enemies)if(en.alive&&Math.hypot(en.x-relay.x,en.y-relay.y)<170){en.hp-=3;if(en.hp<=0){en.alive=false;killedCount++;}}burstParticles(relay.x,relay.y,'#6fb9ff',28);},i*220);message('RELAY OVERLOADED // DEFENSE GRID DOWN');updateHud();}
      else message(`RELAY NEEDS VOLT — PRESS Q TO CYCLE`);
    } else if(player.element===0){
      for(const en of enemies)if(en.alive&&Math.hypot(en.x-player.x,en.y-player.y)<78){en.hp-=2;if(en.hp<=0){en.alive=false;killedCount++;}}
      burstParticles(player.x,player.y,'#ff815e',22);
    } else if(player.element===1){player.hp=Math.min(player.maxHp,player.hp+1);updateHud();message('TIDE // VITALITY RESTORED');}
    else if(player.element===2){player.x=clamp(player.x+player.faceX*28,22,world.w-22);player.y=clamp(player.y+player.faceY*28,30,world.h-20);message('GALE // QUICKSTEP');}
    else if(player.element===3){for(const en of enemies)if(en.alive&&Math.hypot(en.x-player.x,en.y-player.y)<68){en.hit=.45;}message('STONE // IMPACT WAVE');}
    else if(player.element===5){for(const en of enemies)if(en.alive&&Math.hypot(en.x-player.x,en.y-player.y)<92)en.hit=.8;message('RIME // SYSTEMS FROZEN');}
    else if(player.element===6){burstParticles(player.x,player.y,'#fff2c0',32);for(const en of enemies)if(en.alive&&Math.hypot(en.x-player.x,en.y-player.y)<65)en.hp-- ;message('LUX // THE DARK RECOILS');}
    else if(player.element===7){for(const en of enemies)if(en.alive&&Math.hypot(en.x-player.x,en.y-player.y)<85){en.alive=false;killedCount++;}message('UMBRA // SIGNAL ERASED');}
    if(player.element===4){for(const en of enemies)if(en.alive&&Math.hypot(en.x-player.x,en.y-player.y)<80){en.hp-=2;if(en.hp<=0){en.alive=false;killedCount++;}}bolts.push({x:player.x,y:player.y,life:.2});}
  }
  let audio;
  function playTone(freq,duration,wave='sine',volume=.02){try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.type=wave;o.frequency.value=freq;g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch(_){}}
  function burstParticles(x,y,color,n){for(let i=0;i<n;i++){const a=rand(time*100+i*13)*Math.PI*2,s=12+rand(i+time*73)*75;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.2+rand(i+70)*.45,max:.5,color,size:1+Math.floor(rand(i+22)*3)});}}
  function movePlayer(dt){let dx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),dy=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);if(dx&&dy){dx*=.707;dy*=.707;}if(dx||dy){player.faceX=dx;player.faceY=dy;player.walk+=dt*12;}
    const speed=100;const oldX=player.x,oldY=player.y;player.x=clamp(player.x+dx*speed*dt,18,world.w-18);player.y=clamp(player.y+dy*speed*dt,25,world.h-18);
    for(const o of obstacles){if(player.x+7>o.x&&player.x-7<o.x+o.w&&player.y+6>o.y&&player.y-6<o.y+o.h){if(oldX+7<=o.x||oldX-7>=o.x+o.w)player.x=oldX;else player.y=oldY;}}
    // The energized security curtain spans the shaft; wake the relay before crossing it.
    if(!terminalDone&&player.y-6<572&&player.y+6>559)player.y=oldY;
  }
  function update(dt){time+=dt;if(phase!=='play'){if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)toastNode.classList.remove('show');}return;}
    movePlayer(dt);player.attack=Math.max(0,player.attack-dt);player.channel=Math.max(0,player.channel-dt);player.invuln=Math.max(0,player.invuln-dt);shake=Math.max(0,shake-dt*8);
    camera+=(clamp(player.y-145,0,world.h-H)-camera)*Math.min(1,dt*4);
    for(const en of enemies){if(!en.alive)continue;en.phase+=dt;en.hit=Math.max(0,en.hit-dt);let dx=player.x-en.x,dy=player.y-en.y,d=Math.hypot(dx,dy);if(d<115&&d>20&&en.hit<=0){en.x+=dx/d*dt*(en.type==='warden'?17:12);en.y+=dy/d*dt*(en.type==='warden'?17:12);}else if(d>=115){en.x+=Math.sin(en.phase*1.6)*dt*7;en.y+=Math.cos(en.phase*1.3)*dt*5;}if(d<16&&player.invuln<=0){player.hp--;player.invuln=.9;shake=4;message('HULL BREACH // WATCH YOUR STEP');updateHud();if(player.hp<=0){player.hp=3;player.x=240;player.y=Math.min(1000,camera+200);message('REBOOT // MEMORY PRESERVED');updateHud();}}}
    for(const s of shards){if(!s.got&&Math.hypot(player.x-s.x,player.y-s.y)<15){s.got=true;player.shards++;burstParticles(s.x,s.y,'#d7ffe9',21);playTone(660,.25,'sine',.04);message(`MEMORY FRAGMENT RECOVERED  ·  0${player.shards}/05`);updateHud();}}
    for(const t of terminals){if(t.kind==='memory'&&!t.done&&player.shards>=3&&Math.hypot(player.x-t.x,player.y-t.y)<25){t.done=true;player.maxHp=4;player.hp=4;updateHud();message('MEMORY LINK RESTORED // VITAL +1');}}
    particles=particles.filter(p=>p.life>0);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.96;p.vy*=.96;p.life-=dt;}bolts=bolts.filter(b=>b.life>0);bolts.forEach(b=>b.life-=dt);
    if(player.y<44&&!summitTriggered){summitTriggered=true;phase='won';loadingUI.classList.remove('hidden');loadingUI.querySelector('div:nth-child(2)').textContent='ASCENT COMPLETE';loadingUI.querySelector('small').textContent='SIGNAL SENT INTO THE SKY';setTimeout(()=>{loadingUI.classList.add('hidden');phase='won';message('THE SKY ANSWERS. // THANK YOU FOR PLAYING');updateHud();},1900);}
    if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)toastNode.classList.remove('show');}
  }
  function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  function drawTitle(){
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#1b2527');g.addColorStop(.58,'#101718');g.addColorStop(1,'#080c10');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    // moonlit junk in a forgotten room
    rect(0,218,480,52,'#0b1112');for(let i=0;i<18;i++){let x=i*31;rect(x,224+rand(i)*19,16+rand(i+80)*23,48,'#111a19');rect(x+5,220+rand(i+8)*12,2,18,'#293331');}
    rect(63,196,357,12,'#080b0c');rect(92,195,4,43,'#202826');rect(391,195,4,43,'#202826');
    // CRT cabinet, bezel, phosphor static
    rect(131,48,226,151,'#0a0e10');rect(139,42,213,151,'#4c5650');rect(143,46,205,141,'#242e2d');rect(149,52,193,128,'#090e11');rect(155,58,181,116,'#142124');
    rect(163,65,167,99,'#132321');for(let i=0;i<140;i++){let x=160+rand(i+time*31|0)*180,y=64+rand(i+300+Math.floor(time*7))*101;rect(x,y,1+rand(i)*4,1,['#324b45','#233b3d','#436158'][i%3]);}
    const flick=Math.sin(time*5)*.09+.9;ctx.globalAlpha=flick;ctx.fillStyle='#a5edd2';ctx.font='bold 20px monospace';ctx.textAlign='center';ctx.fillText('NULL / ASCENT',244,111);ctx.fillStyle='#87aaa1';ctx.font='7px monospace';ctx.fillText('A SIGNAL IN THE STATIC',244,130);ctx.globalAlpha=1;
    rect(165,165,163,2,'#41635a');rect(165,171,94,1,'#243b38');
    for(let i=0;i<4;i++){rect(365+i*8,145,4,4,['#57665e','#d27762','#56bbca','#59695d'][i]);}rect(372,160,20,3,'#151c1c');
    // cables
    ctx.strokeStyle='#252e2c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(108,0);ctx.bezierCurveTo(104,40,130,43,123,100);ctx.stroke();ctx.beginPath();ctx.moveTo(399,0);ctx.bezierCurveTo(389,33,420,48,412,88);ctx.stroke();
    rect(0,0,480,1,'#b3f5dd');rect(0,269,480,1,'#28443e');
  }
  function drawWorld(){
    ctx.fillStyle='#121a19';ctx.fillRect(0,0,W,H);
    // tiled organic-metal floor
    for(let y=Math.floor(camera/32)*32;y<camera+H+32;y+=32){for(let x=0;x<W;x+=32){const r=rand((x+1)*3+y*5);rect(x,y-camera,31,31,r>.86?'#1a2420':r<.06?'#18211f':'#151e1c');if(r>.76){rect(x+rand(x+y)*25,y-camera+rand(y+x)*25,5,2,'#26362f');}if((Math.floor(x/32)+Math.floor(y/32))%6===0){rect(x+4,y-camera+7,2,1,'#39423a');rect(x+25,y-camera+23,3,2,'#26332e');}}}
    // outer tower walls, rails, repeating rivets
    rect(0,0,10,H,'#202925');rect(470,0,10,H,'#202925');rect(10,0,3,H,'#394039');rect(467,0,3,H,'#394039');
    for(let y=Math.floor(camera/80)*80;y<camera+H+80;y+=80){const sy=y-camera;rect(12,sy,456,2,'#28332e');rect(17,sy+4,446,1,'#111817');for(let x=22;x<468;x+=30){rect(x,sy+1,2,2,'#4a493b');}}
    // cable runs and hanging roots, procedural and fixed to the architecture
    for(let i=0;i<8;i++){const wy=i*151+42,sy=wy-camera;ctx.strokeStyle=i%2?'#3d3a30':'#283c38';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(38+i%3*17,sy);ctx.bezierCurveTo(55+i*5,sy+32,22+i*3,sy+58,45+i*2,sy+91);ctx.stroke();}
    for(const d of debris){const sy=d.y-camera;if(sy>-8&&sy<H+8)rect(d.x,sy,d.w,d.h,d.c);}
    // level landmarks
    drawArch(240,545-camera,terminalDone);
    for(const o of obstacles){const sy=o.y-camera;if(sy<-55||sy>H+55)continue;drawObstacle(o,sy);}
    for(const t of terminals){let sy=t.y-camera;if(sy<-30||sy>H+30)continue;drawTerminal(t,sy);}
    for(const s of shards){if(s.got)continue;const sy=s.y-camera;if(sy<-20||sy>H+20)continue;drawShard(s,sy);}
    for(const en of enemies){if(!en.alive)continue;const sy=en.y-camera;if(sy<-30||sy>H+30)continue;drawEnemy(en,sy);}
    drawPlayer();drawParticles();drawStorm();
    // compass strip and tiny map
    rect(18,18,73,4,'#293430');rect(18,18,Math.max(3,73*(1-player.y/world.h)) ,4,'#9af0d2');ctx.fillStyle='#91a69b';ctx.font='6px monospace';ctx.textAlign='left';ctx.fillText('ASCENT',18,14);
    rect(440,18,24,49,'#0a1010');rect(442,20,20,45,'#182321');for(const en of enemies){let my=21+(en.y/world.h)*43;rect(451,my,2,2,'#dc7761');}for(const s of shards)if(!s.got)rect(446,21+(s.y/world.h)*43,2,2,'#baf8de');rect(450,21+(player.y/world.h)*43,4,3,'#f5efcc');
    if(phase==='won'){ctx.fillStyle='#e7fff0';ctx.font='10px monospace';ctx.textAlign='center';ctx.fillText('ASCENT COMPLETE',240,110);ctx.font='7px monospace';ctx.fillText('THE SIGNAL HAS FOUND ITS WAY HOME',240,126);}
  }
  function drawArch(y,screenY,open){rect(12,screenY,456,4,open?'#398c80':'#774b3d');rect(17,screenY+4,7,38,'#37362e');rect(456,screenY+4,7,38,'#37362e');for(let x=30;x<458;x+=16){rect(x,screenY+3,4,1,open?'#8ef8da':'#c77d5d');}if(!open){rect(24,screenY+14,432,12,'#3b2425');rect(25,screenY+15,430,2,'#e56a55');for(let x=33;x<456;x+=24)rect(x,screenY+14,2,12,'#713c37');}}
  function drawObstacle(o,sy){const x=o.x;if(o.type==='wreck'){rect(x,sy+o.h-5,o.w,7,'#0a1110');rect(x+3,sy+8,o.w-6,o.h-11,'#3b3930');rect(x+8,sy+3,o.w-15,8,'#5a5140');rect(x+11,sy+9,o.w-22,3,'#252b27');rect(x+5,sy+o.h-9,o.w-10,3,'#736147');for(let i=0;i<3;i++){rect(x+10+i*20,sy+14,7,5,['#23332c','#263b39','#3c3028'][i]);}rect(x+o.w-9,sy+2,3,5,'#887450');}else{rect(x,sy+o.h-5,o.w,7,'#0b1110');rect(x+4,sy+7,o.w-8,o.h-12,'#343c37');rect(x+7,sy+3,o.w-14,6,'#69715e');rect(x+10,sy+11,o.w-20,13,'#172322');rect(x+12,sy+13,o.w-24,2,'#69a794');rect(x+12,sy+18,5,2,'#c7735d');rect(x+o.w-11,sy+12,3,3,'#b5daae');}}
  function drawTerminal(t,sy){const pulse=.5+Math.sin(time*5+t.y)*.5;rect(t.x-12,sy+4,24,17,'#303a34');rect(t.x-9,sy,18,10,'#637065');rect(t.x-7,sy+2,14,6,t.done?'#adf5d6':`rgba(77,${120+Math.floor(pulse*60)},${130+Math.floor(pulse*80)},.9)`);rect(t.x-4,sy+12,8,2,'#a5784d');rect(t.x-8,sy+21,16,2,'#171e1c');if(t.kind==='relay'&&!t.done){ctx.fillStyle='#afd5dc';ctx.font='6px monospace';ctx.textAlign='center';ctx.fillText('VOLT',t.x,sy-5);}if(t.done){ctx.fillStyle='#a8ffe1';ctx.font='6px monospace';ctx.textAlign='center';ctx.fillText('LINKED',t.x,sy-5);}}
  function drawShard(s,sy){const bob=Math.sin(time*4+s.phase)*2,x=s.x,y=sy+bob;ctx.fillStyle='#b9ffdf';ctx.globalAlpha=.2;ctx.fillRect(x-9,y-9,18,18);ctx.globalAlpha=1;rect(x-1,y-7,3,3,'#fffde8');rect(x-4,y-4,9,3,'#c5ffe5');rect(x-2,y-1,5,7,'#8de4d0');rect(x-5,y+5,10,2,'#dffff2');}
  function drawPlayer(){const x=Math.round(player.x),y=Math.round(player.y-camera);if(player.invuln>0&&Math.floor(time*18)%2===0)return;const bob=Math.sin(player.walk)*1.3;ctx.save();if(player.channel>0){ctx.globalAlpha=.55+Math.sin(time*24)*.25;ctx.fillStyle=elements[player.element].color;ctx.fillRect(x-13,y-17,26,34);ctx.globalAlpha=1;}
    // shadow / little boots
    rect(x-8,y+7+bob,16,4,'#090e0d');rect(x-6,y+4+bob,4,4,'#3a3430');rect(x+2,y+4-bob,4,4,'#3a3430');
    // chibi coat, scarf, head and bright face
    rect(x-8,y-7+bob,16,13,'#4d5b50');rect(x-7,y-5+bob,14,9,'#75836b');rect(x-9,y-1+bob,18,4,'#b6644d');rect(x-6,y+5+bob,12,4,'#262d29');
    rect(x-7,y-17+bob,14,12,'#b8a98b');rect(x-8,y-14+bob,16,7,'#d2c8a9');rect(x-7,y-19+bob,14,4,'#313b37');rect(x-6,y-21+bob,12,3,'#758674');
    rect(x-5+player.faceX*2,y-12+player.faceY*2+bob,2,2,'#253937');rect(x+3+player.faceX*2,y-12+player.faceY*2+bob,2,2,'#253937');rect(x-3,y-8+bob,6,1,'#d8f3d9');
    // right hand elemental spark and attack slash
    const e=elements[player.element];rect(x+8,y-3+bob,3,3,e.color);if(player.attack>0){ctx.globalAlpha=.85;ctx.strokeStyle=e.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x+player.faceX*9,y+player.faceY*7+bob,13,-1.7,1.5);ctx.stroke();ctx.globalAlpha=1;}
    ctx.restore();}
  function drawEnemy(en,sy){const x=Math.round(en.x),y=Math.round(sy);const flick=en.hit>0;ctx.save();if(en.type==='warden'){rect(x-14,y-10,28,16,'#302a31');rect(x-11,y-13,22,14,'#55504a');rect(x-8,y-17,16,6,'#798678');rect(x-5,y-9,4,3,'#f36f60');rect(x+3,y-9,4,3,'#f36f60');rect(x-7,y+6,5,5,'#282a27');rect(x+2,y+6,5,5,'#282a27');}else if(en.type==='wisp'){rect(x-7,y-7,14,14,flick?'#f5e5c4':'#475d6b');rect(x-5,y-10,10,5,'#64798a');rect(x-3,y-2,3,3,'#ffb66c');rect(x+2,y-2,3,3,'#ffb66c');rect(x-11,y-1,4,3,'#2b4249');rect(x+7,y-1,4,3,'#2b4249');}else{rect(x-8,y-6,16,13,flick?'#ffe9c2':'#4a5146');rect(x-6,y-11,12,7,'#707863');rect(x-4,y-9,3,2,'#ff765d');rect(x+2,y-9,3,2,'#ff765d');rect(x-6,y+7,4,4,'#2a302b');rect(x+2,y+7,4,4,'#2a302b');rect(x-10,y-2,3,5,'#a1644c');}ctx.restore();}
  function drawParticles(){for(const p of particles){ctx.globalAlpha=clamp(p.life*3,0,1);rect(p.x,p.y-camera,p.size,p.size,p.color);}ctx.globalAlpha=1;for(const b of bolts){ctx.strokeStyle='#8fd5ff';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<7;i++){const x=player.x+(rand(i+time*200)-.5)*75,y=player.y-camera+(rand(i+50+time*200)-.5)*58;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}}
  function drawStorm(){const flash=Math.max(0,Math.sin(time*.7+2)*.03+(rand(Math.floor(time*1.8))*((Math.floor(time*1.8)%13===0)?0.4:0)));if(flash>.14){ctx.fillStyle=`rgba(133,187,218,${flash})`;ctx.fillRect(0,0,W,H);ctx.strokeStyle='#bce7ff';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(350,0);ctx.lineTo(342,16);ctx.lineTo(349,22);ctx.lineTo(337,39);ctx.stroke();}}
  function render(){ctx.save();if(shake>0)ctx.translate((rand(time*900)-.5)*shake,(rand(time*600)-.5)*shake);if(phase==='title'||phase==='loading')drawTitle();else drawWorld();ctx.restore();}
  function loop(now){const dt=Math.min(.04,(now-last)/1000||0);last=now;update(dt);render();requestAnimationFrame(loop);}
  buildWorld();updateHud();requestAnimationFrame(loop);
})();
