/* ===== math.js ===== */
window.OD = window.OD || {};

OD.Vec3 = class {
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
  clone(){return new OD.Vec3(this.x,this.y,this.z);}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
  sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
  scale(s){this.x*=s;this.y*=s;this.z*=s;return this;}
  length(){return Math.hypot(this.x,this.y,this.z);}
  normalize(){const l=this.length()||1;return this.scale(1/l);}
};

OD.clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
OD.lerp=(a,b,t)=>a+(b-a)*t;


/* ===== renderer.js ===== */
window.OD = window.OD || {};

OD.Renderer = class {
  constructor(canvas){
    this.canvas=canvas;
    this.gl=canvas.getContext("webgl",{antialias:true,alpha:false});
    if(!this.gl) throw new Error("อุปกรณ์นี้ไม่รองรับ WebGL");
    this.program=this.createProgram();
    this.locations={
      pos:this.gl.getAttribLocation(this.program,"aPosition"),
      color:this.gl.getUniformLocation(this.program,"uColor"),
      mvp:this.gl.getUniformLocation(this.program,"uMVP")
    };
    this.cube=this.createCube();
    this.view=new Float32Array(16);
    this.proj=new Float32Array(16);
    this.camera={x:0,y:8,z:12,targetX:0,targetY:0,targetZ:0};
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.enable(this.gl.CULL_FACE);
  }

  shader(type,src){
    const s=this.gl.createShader(type);
    this.gl.shaderSource(s,src);this.gl.compileShader(s);
    if(!this.gl.getShaderParameter(s,this.gl.COMPILE_STATUS)) throw new Error(this.gl.getShaderInfoLog(s));
    return s;
  }

  createProgram(){
    const vs=this.shader(this.gl.VERTEX_SHADER,`
      attribute vec3 aPosition;
      uniform mat4 uMVP;
      void main(){gl_Position=uMVP*vec4(aPosition,1.0);}
    `);
    const fs=this.shader(this.gl.FRAGMENT_SHADER,`
      precision mediump float;
      uniform vec4 uColor;
      void main(){gl_FragColor=uColor;}
    `);
    const p=this.gl.createProgram();
    this.gl.attachShader(p,vs);this.gl.attachShader(p,fs);this.gl.linkProgram(p);
    if(!this.gl.getProgramParameter(p,this.gl.LINK_STATUS)) throw new Error(this.gl.getProgramInfoLog(p));
    return p;
  }

  createCube(){
    const v=new Float32Array([
      -1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1,
      -1,-1, 1, 1,-1, 1, 1,1, 1, -1,1, 1
    ]);
    const i=new Uint16Array([
      0,1,2,0,2,3, 4,6,5,4,7,6,
      0,4,5,0,5,1, 3,2,6,3,6,7,
      1,5,6,1,6,2, 0,3,7,0,7,4
    ]);
    const vb=this.gl.createBuffer();this.gl.bindBuffer(this.gl.ARRAY_BUFFER,vb);this.gl.bufferData(this.gl.ARRAY_BUFFER,v,this.gl.STATIC_DRAW);
    const ib=this.gl.createBuffer();this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,ib);this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER,i,this.gl.STATIC_DRAW);
    return {vb,ib,count:i.length};
  }

  resize(){
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const w=Math.floor(this.canvas.clientWidth*dpr),h=Math.floor(this.canvas.clientHeight*dpr);
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
    this.gl.viewport(0,0,w,h);
    this.proj=this.perspective(Math.PI/3,w/h,.1,100);
  }

  begin(){
    this.resize();
    this.gl.clearColor(.53,.80,.94,1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT|this.gl.DEPTH_BUFFER_BIT);
    this.gl.useProgram(this.program);
    this.view=this.lookAt(
      [this.camera.x,this.camera.y,this.camera.z],
      [this.camera.targetX,this.camera.targetY,this.camera.targetZ],
      [0,1,0]
    );
  }

  drawBox(x,y,z,sx,sy,sz,color,rotY=0){
    const model=this.modelMatrix(x,y,z,sx,sy,sz,rotY);
    const mvp=this.multiply(this.proj,this.multiply(this.view,model));
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.cube.vb);
    this.gl.enableVertexAttribArray(this.locations.pos);
    this.gl.vertexAttribPointer(this.locations.pos,3,this.gl.FLOAT,false,0,0);
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,this.cube.ib);
    this.gl.uniformMatrix4fv(this.locations.mvp,false,mvp);
    this.gl.uniform4fv(this.locations.color,color);
    this.gl.drawElements(this.gl.TRIANGLES,this.cube.count,this.gl.UNSIGNED_SHORT,0);
  }

  modelMatrix(x,y,z,sx,sy,sz,rotY=0){
    const c=Math.cos(rotY),s=Math.sin(rotY);
    return new Float32Array([
      sx*c,0,-sx*s,0,
      0,sy,0,0,
      sz*s,0,sz*c,0,
      x,y,z,1
    ]);
  }

  perspective(fov,aspect,near,far){
    const f=1/Math.tan(fov/2),nf=1/(near-far);
    return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
  }

  lookAt(e,c,u){
    let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2];
    let l=Math.hypot(zx,zy,zz)||1;zx/=l;zy/=l;zz/=l;
    let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx;
    l=Math.hypot(xx,xy,xz)||1;xx/=l;xy/=l;xz/=l;
    let yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
    return new Float32Array([
      xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
      -(xx*e[0]+xy*e[1]+xz*e[2]),
      -(yx*e[0]+yy*e[1]+yz*e[2]),
      -(zx*e[0]+zy*e[1]+zz*e[2]),1
    ]);
  }

  multiply(a,b){
    const o=new Float32Array(16);
    for(let r=0;r<4;r++)for(let c=0;c<4;c++)
      o[c*4+r]=a[0*4+r]*b[c*4+0]+a[1*4+r]*b[c*4+1]+a[2*4+r]*b[c*4+2]+a[3*4+r]*b[c*4+3];
    return o;
  }
};


/* ===== world.js ===== */
window.OD = window.OD || {};

OD.World = class {
  constructor(){
    this.player={pos:new OD.Vec3(0,0,0),facing:0,walkTime:0,attackTime:0};
    this.enemies=[];
    this.projectiles=[];
    this.drops=[];
    this.npc={pos:new OD.Vec3(-7.2,0,-5.6),name:"ผู้ดูแลสวน"};
    this.merchant={pos:new OD.Vec3(-8.4,0,-7.0),name:"พ่อค้าเมล็ดพันธุ์"};
    this.chest={pos:new OD.Vec3(7.1,0,5.8),opened:false};
    this.spawnInitial();
  }

  spawnInitial(){
    for(let i=0;i<7;i++){
      const a=i*Math.PI*2/7;
      this.spawnEnemy(i%3===0?"beetle":"hopper",false,Math.cos(a)*8,Math.sin(a)*8);
    }
  }

  spawnEnemy(kind,boss,x,z){
    this.enemies.push({
      kind,boss,
      pos:new OD.Vec3(x,0,z),
      spawn:new OD.Vec3(x,0,z),
      hp:boss?450:(kind==="beetle"?140:75),
      maxHp:boss?450:(kind==="beetle"?140:75),
      speed:boss?1.05:(kind==="beetle"?1.1:1.7),
      damage:boss?25:(kind==="beetle"?14:8),
      cooldown:0,
      wander:Math.random()*Math.PI*2,
      dead:false,
      respawnAt:0
    });
  }
};


/* ===== entities.js ===== */
window.OD = window.OD || {};

OD.findNearestEnemy=function(world,maxDistance=8){
  let best=null,bestD=maxDistance;
  for(const enemy of world.enemies){
    if(enemy.dead) continue;
    const dx=enemy.pos.x-world.player.pos.x,dz=enemy.pos.z-world.player.pos.z;
    const d=Math.hypot(dx,dz);
    if(d<bestD){bestD=d;best=enemy;}
  }
  return best;
};


/* ===== input.js ===== */
window.OD = window.OD || {};

OD.Input = class {
  constructor(){
    this.move={x:0,y:0};this.keys={};
    addEventListener("keydown",e=>this.keys[e.key.toLowerCase()]=true);
    addEventListener("keyup",e=>this.keys[e.key.toLowerCase()]=false);

    const joy=document.getElementById("joystick");
    const stick=document.getElementById("stick");
    let active=false;

    const update=e=>{
      const r=joy.getBoundingClientRect();
      let dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);
      const max=38,len=Math.hypot(dx,dy);
      if(len>max){dx=dx/len*max;dy=dy/len*max;}
      this.move.x=dx/max;this.move.y=dy/max;
      stick.style.transform=`translate(${dx}px,${dy}px)`;
    };

    joy.addEventListener("pointerdown",e=>{active=true;joy.setPointerCapture(e.pointerId);update(e);});
    joy.addEventListener("pointermove",e=>{if(active)update(e);});
    joy.addEventListener("pointerup",()=>{active=false;this.move.x=this.move.y=0;stick.style.transform="translate(0,0)";});
  }

  axis(){
    return {
      x:(this.keys.d?1:0)-(this.keys.a?1:0)+this.move.x,
      y:(this.keys.s?1:0)-(this.keys.w?1:0)+this.move.y
    };
  }
};


/* ===== game.js ===== */
(function(){
"use strict";

// Mobile browser protection:
// - Prevent Safari double-tap zoom while repeatedly attacking.
// - Prevent pinch zoom/gesture zoom inside the game.
// - Prevent page scrolling and text selection during play.
let lastTouchEnd = 0;
document.addEventListener("touchend", event => {
  const now = Date.now();
  if (now - lastTouchEnd <= 320) event.preventDefault();
  lastTouchEnd = now;
}, { passive:false });

document.addEventListener("dblclick", event => event.preventDefault(), { passive:false });
document.addEventListener("gesturestart", event => event.preventDefault(), { passive:false });
document.addEventListener("gesturechange", event => event.preventDefault(), { passive:false });
document.addEventListener("gestureend", event => event.preventDefault(), { passive:false });

document.addEventListener("touchmove", event => {
  if (event.touches && event.touches.length > 1) event.preventDefault();
}, { passive:false });

function bindMobileAction(buttonId, handler){
  const button = document.getElementById(buttonId);
  if (!button) return;

  let activePointer = null;

  const press = event => {
    event.preventDefault();
    event.stopPropagation();
    if (activePointer !== null) return;
    activePointer = event.pointerId ?? "touch";
    button.classList.add("pressed");
    try { button.setPointerCapture?.(event.pointerId); } catch (_) {}
    handler();
    if (navigator.vibrate) navigator.vibrate(12);
  };

  const release = event => {
    event.preventDefault();
    button.classList.remove("pressed");
    activePointer = null;
  };

  button.addEventListener("pointerdown", press, { passive:false });
  button.addEventListener("pointerup", release, { passive:false });
  button.addEventListener("pointercancel", release, { passive:false });
  button.addEventListener("contextmenu", event => event.preventDefault());
}

function showError(msg){
  const el=document.getElementById("errorBox");
  el.style.display="block";
  el.textContent="เกิดข้อผิดพลาด: "+msg;
}
window.addEventListener("error",e=>showError(e.message||"Unknown error"));

try{
  const canvas=document.getElementById("game");
  const renderer=new OD.Renderer(canvas);
  const world=new OD.World();
  const input=new OD.Input();

  let cameraYaw=0;
  let cameraDistance=11.5;
  let cameraDrag=null;
  canvas.addEventListener("pointerdown",event=>{
    if(event.target!==canvas)return;
    cameraDrag={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
    try{canvas.setPointerCapture(event.pointerId);}catch(_){}
  },{passive:false});
  canvas.addEventListener("pointermove",event=>{
    if(!cameraDrag||cameraDrag.id!==event.pointerId)return;
    const dx=event.clientX-cameraDrag.x;
    const dy=event.clientY-cameraDrag.y;
    if(Math.abs(dx)+Math.abs(dy)>3)cameraDrag.moved=true;
    cameraYaw-=dx*.008;
    cameraDistance=OD.clamp(cameraDistance+dy*.01,9.5,14.5);
    cameraDrag.x=event.clientX;
    cameraDrag.y=event.clientY;
    event.preventDefault();
  },{passive:false});
  canvas.addEventListener("pointerup",event=>{
    if(cameraDrag&&cameraDrag.id===event.pointerId)cameraDrag=null;
  },{passive:false});

  const save=JSON.parse(localStorage.getItem("orchardiaSaveV1")||'{"level":1,"xp":0,"coins":0,"items":0,"kills":0,"questDone":false,"potions":1,"rareSeeds":0,"weaponLevel":1}');
  const state={
    hp:100,maxHp:100,mp:100,maxMp:100,
    level:save.level,xp:save.xp,coins:save.coins,items:save.items,kills:save.kills,
    questDone:!!save.questDone,
    potions:Number(save.potions||1),rareSeeds:Number(save.rareSeeds||0),weaponLevel:Number(save.weaponLevel||1),
    attackCd:0,skillCd:0,skill2Cd:0,rollCd:0,target:null,lockedTarget:null,
    nearbyNpc:false,nearbyMerchant:false,nearbyChest:false,uiOpen:false
  };

  function persist(){
    localStorage.setItem("orchardiaSaveV1",JSON.stringify({
      level:state.level,xp:state.xp,coins:state.coins,items:state.items,kills:state.kills,questDone:state.questDone,potions:state.potions,rareSeeds:state.rareSeeds,weaponLevel:state.weaponLevel
    }));
  }

  function flash(text){
    const m=document.getElementById("message");
    m.textContent=text;m.classList.add("show");
    clearTimeout(flash.t);
    flash.t=setTimeout(()=>m.classList.remove("show"),1200);
  }

  function shoot(damage,speed){
    const target=(state.lockedTarget&&!state.lockedTarget.dead?state.lockedTarget:null)||(state.target&&!state.target.dead?state.target:OD.findNearestEnemy(world));
    if(!target)return flash("ไม่มีเป้าหมาย");
    state.target=target;
    world.projectiles.push({
      pos:world.player.pos.clone().add(new OD.Vec3(0,.8,0)),
      target,damage,speed,dead:false
    });
  }


  const inventoryPanel=document.getElementById("inventoryPanel");
  const dialoguePanel=document.getElementById("dialoguePanel");

  function attackDamage(){
    return 22+(state.weaponLevel-1)*7;
  }

  function syncInventory(){
    document.getElementById("attackStat").textContent=attackDamage();
    document.getElementById("maxHpStat").textContent=state.maxHp;
    document.getElementById("potionCount").textContent=state.potions;
    document.getElementById("seedCount").textContent=state.rareSeeds;
    document.getElementById("upgradeWeaponBtn").textContent=
      state.weaponLevel>=5?"ธนูระดับสูงสุด":`อัปเกรดธนู ${80*state.weaponLevel} 🪙`;
  }

  function setUiOpen(open){
    state.uiOpen=open;
    if(open){
      input.move.x=0;input.move.y=0;
      const stick=document.getElementById("stick");
      if(stick)stick.style.transform="translate(0,0)";
    }
  }

  function openInventory(){
    syncInventory();
    inventoryPanel.classList.remove("hidden");
    setUiOpen(true);
  }

  function closeInventory(){
    inventoryPanel.classList.add("hidden");
    setUiOpen(false);
  }

  function openDialogue(name,text,actions=[]){
    document.getElementById("dialogueName").textContent=name;
    document.getElementById("dialogueText").textContent=text;
    const holder=document.getElementById("dialogueActions");
    holder.innerHTML="";
    actions.forEach(action=>{
      const button=document.createElement("button");
      button.textContent=action.label;
      button.onclick=action.onClick;
      holder.appendChild(button);
    });
    dialoguePanel.classList.remove("hidden");
    setUiOpen(true);
  }

  function closeDialogue(){
    dialoguePanel.classList.add("hidden");
    setUiOpen(false);
  }

  document.getElementById("bagBtn").onclick=openInventory;
  document.getElementById("closeInventoryBtn").onclick=closeInventory;
  document.getElementById("closeDialogueBtn").onclick=closeDialogue;

  document.getElementById("usePotionBtn").onclick=()=>{
    if(state.potions<=0)return flash("ไม่มียา HP");
    if(state.hp>=state.maxHp)return flash("HP เต็มแล้ว");
    state.potions--;
    state.hp=Math.min(state.maxHp,state.hp+55);
    flash("+55 HP");
    syncInventory();
    persist();
  };

  document.getElementById("upgradeWeaponBtn").onclick=()=>{
    if(state.weaponLevel>=5)return flash("ธนูถึงระดับสูงสุดแล้ว");
    const cost=80*state.weaponLevel;
    if(state.coins<cost)return flash("เหรียญไม่พอ");
    state.coins-=cost;
    state.weaponLevel++;
    flash("อัปเกรดธนูสำเร็จ!");
    syncInventory();
    persist();
  };

  bindMobileAction("attackBtn",()=>{
    if(state.uiOpen||state.attackCd>0)return;
    state.attackCd=.55;
    world.player.attackTime=.28;
    shoot(attackDamage(),8);
  });

  bindMobileAction("skillBtn",()=>{
    if(state.uiOpen||state.skillCd>0||state.mp<25)return;
    state.skillCd=5;
    state.mp-=25;
    world.player.attackTime=.42;
    shoot(60,11);
    flash("Seed Burst!");
  });

  bindMobileAction("skill2Btn",()=>{
    if(state.uiOpen||state.skill2Cd>0||state.mp<35)return;
    state.skill2Cd=7;
    state.mp-=35;
    world.player.attackTime=.5;
    let hits=0;
    for(const enemy of world.enemies){
      if(enemy.dead)continue;
      const dx=enemy.pos.x-world.player.pos.x;
      const dz=enemy.pos.z-world.player.pos.z;
      if(Math.hypot(dx,dz)<=3.2){
        enemy.hp-=38+(state.weaponLevel-1)*5;
        enemy.pos.x+=dx*.18;
        enemy.pos.z+=dz*.18;
        hits++;
        if(enemy.hp<=0)killEnemy(enemy);
      }
    }
    flash(hits?`Whirl Seed! โดน ${hits} ตัว`:"Whirl Seed!");
  });

  bindMobileAction("lockBtn",()=>{
    if(state.uiOpen)return;
    const nearest=OD.findNearestEnemy(world,10);
    if(!nearest){
      state.lockedTarget=null;
      document.getElementById("lockBtn").classList.remove("locked");
      return flash("ไม่มีเป้าหมายให้ล็อก");
    }
    if(state.lockedTarget===nearest){
      state.lockedTarget=null;
      document.getElementById("lockBtn").classList.remove("locked");
      flash("ยกเลิกล็อกเป้าหมาย");
    }else{
      state.lockedTarget=nearest;
      document.getElementById("lockBtn").classList.add("locked");
      flash("ล็อกเป้าหมายแล้ว");
    }
  });

  bindMobileAction("rollBtn",()=>{
    if(state.uiOpen||state.rollCd>0)return;
    state.rollCd=2;
    const a=world.player.facing;
    world.player.pos.x+=Math.sin(a)*2.2;
    world.player.pos.z+=Math.cos(a)*2.2;
  });

  bindMobileAction("interactBtn",()=>{
    if(state.uiOpen)return;

    if(state.nearbyNpc){
      if(state.kills>=5&&!state.questDone){
        openDialogue(world.npc.name,"เจ้าช่วยสวนของเราไว้ได้ รับรางวัลนี้ไปเถอะ",[
          {label:"รับรางวัล",onClick:()=>{
            state.questDone=true;
            state.coins+=100;
            state.potions+=2;
            state.rareSeeds+=1;
            persist();
            closeDialogue();
            flash("รับ 100 เหรียญ ยา 2 ขวด และเมล็ดหายาก");
          }}
        ]);
      }else if(state.questDone){
        openDialogue(world.npc.name,"ตอนนี้หมู่บ้านปลอดภัยขึ้นมาก ขอบคุณนักผจญภัย",[
          {label:"ลาก่อน",onClick:closeDialogue}
        ]);
      }else{
        openDialogue(world.npc.name,`ตั๊กแตนกำลังทำลายสวน กำจัดให้ครบ 5 ตัว ตอนนี้ ${Math.min(5,state.kills)}/5`,[
          {label:"รับทราบ",onClick:closeDialogue}
        ]);
      }
      return;
    }

    if(state.nearbyMerchant){
      openDialogue(world.merchant.name,"ข้ามีสินค้าสำหรับนักผจญภัย",[
        {label:"ซื้อยา HP 25 🪙",onClick:()=>{
          if(state.coins<25)return flash("เหรียญไม่พอ");
          state.coins-=25;state.potions++;persist();flash("ซื้อยา HP แล้ว");
        }},
        {label:"ซื้อเมล็ดหายาก 60 🪙",onClick:()=>{
          if(state.coins<60)return flash("เหรียญไม่พอ");
          state.coins-=60;state.rareSeeds++;persist();flash("ซื้อเมล็ดหายากแล้ว");
        }}
      ]);
      return;
    }

    if(state.nearbyChest){
      world.chest.opened=true;
      state.coins+=35;
      state.potions+=1;
      flash("เปิดหีบ: +35 เหรียญ และยา HP");
      persist();
      return;
    }

    flash("ไม่มีสิ่งที่โต้ตอบได้");
  });

  function killEnemy(enemy){
    enemy.dead=true;
    enemy.respawnAt=performance.now()+(enemy.boss?18000:8000);
    state.kills++;
    state.coins+=enemy.boss?50:5;
    state.xp+=enemy.boss?100:20;

    world.drops.push({
      pos:enemy.pos.clone(),
      value:enemy.boss?3:1,
      kind:enemy.boss?"rareSeed":(Math.random()<.28?"potion":"coin"),
      life:12,
      spin:Math.random()*6.28
    });

    if(state.xp>=state.level*100){
      state.xp-=state.level*100;
      state.level++;
      state.maxHp+=15;
      state.hp=state.maxHp;
      flash("เลเวลอัป!");
    }

    if(state.kills>=5&&!state.questDone&&!world.enemies.some(e=>e.boss&&!e.dead)){
      flash("บอสตั๊กแตนยักษ์ปรากฏ!");
      world.spawnEnemy("hopper",true,10,0);
    }
    persist();
  }

  function update(dt){
    state.attackCd=Math.max(0,state.attackCd-dt);
    state.skillCd=Math.max(0,state.skillCd-dt);
    state.skill2Cd=Math.max(0,state.skill2Cd-dt);
    state.rollCd=Math.max(0,state.rollCd-dt);
    state.mp=Math.min(state.maxMp,state.mp+10*dt);

    world.player.attackTime=Math.max(0,world.player.attackTime-dt);

    const axis=state.uiOpen?{x:0,y:0}:input.axis();
    const len=Math.hypot(axis.x,axis.y);
    if(len>.05){
      const sx=axis.x/(len>1?len:1);
      const sy=axis.y/(len>1?len:1);
      const nx=sx*Math.cos(cameraYaw)+sy*Math.sin(cameraYaw);
      const nz=-sx*Math.sin(cameraYaw)+sy*Math.cos(cameraYaw);
      world.player.pos.x+=nx*4*dt;
      world.player.pos.z+=nz*4*dt;
      world.player.facing=Math.atan2(nx,nz);
      world.player.walkTime+=dt*9;
    }else{
      world.player.walkTime+=dt*2;
    }
    world.player.pos.x=OD.clamp(world.player.pos.x,-14,14);
    world.player.pos.z=OD.clamp(world.player.pos.z,-14,14);

    if(state.lockedTarget&&state.lockedTarget.dead)state.lockedTarget=null;
    state.target=state.lockedTarget||OD.findNearestEnemy(world);

    for(const e of world.enemies){
      if(e.dead){
        if(performance.now()>=e.respawnAt&&!e.boss){
          e.dead=false;
          e.hp=e.maxHp;
          e.pos.set(e.spawn.x,0,e.spawn.z);
        }
        continue;
      }

      const dx=world.player.pos.x-e.pos.x;
      const dz=world.player.pos.z-e.pos.z;
      const d=Math.hypot(dx,dz);
      const aggro=e.boss?12:6.5;

      if(d<=aggro){
        if(d>1.1){
          e.pos.x+=dx/d*e.speed*dt;
          e.pos.z+=dz/d*e.speed*dt;
        }else{
          e.cooldown-=dt;
          if(e.cooldown<=0){
            e.cooldown=1.1;
            state.hp-=e.damage;
            flash("-"+e.damage+" HP");
          }
        }
      }else{
        e.wander+=dt*.45;
        const tx=e.spawn.x+Math.cos(e.wander)*1.4;
        const tz=e.spawn.z+Math.sin(e.wander)*1.4;
        const wx=tx-e.pos.x,wz=tz-e.pos.z,wd=Math.hypot(wx,wz)||1;
        e.pos.x+=wx/wd*e.speed*.28*dt;
        e.pos.z+=wz/wd*e.speed*.28*dt;
      }
    }

    for(const p of world.projectiles){
      if(!p.target||p.target.dead){p.dead=true;continue;}
      const dx=p.target.pos.x-p.pos.x,dz=p.target.pos.z-p.pos.z;
      const d=Math.hypot(dx,dz),step=p.speed*dt;
      if(d<=step){
        p.target.hp-=p.damage;p.dead=true;
        if(p.target.hp<=0)killEnemy(p.target);
      }else{
        p.pos.x+=dx/d*step;p.pos.z+=dz/d*step;
      }
    }
    world.projectiles=world.projectiles.filter(p=>!p.dead);

    for(let i=world.drops.length-1;i>=0;i--){
      const drop=world.drops[i];
      drop.life-=dt;
      drop.spin+=dt*3;
      const dx=drop.pos.x-world.player.pos.x;
      const dz=drop.pos.z-world.player.pos.z;
      if(Math.hypot(dx,dz)<1.25){
        if(drop.kind==="potion"){
          state.potions+=drop.value;
          flash("เก็บยา HP +" + drop.value);
        }else if(drop.kind==="rareSeed"){
          state.rareSeeds+=drop.value;
          flash("เก็บเมล็ดหายาก +" + drop.value);
        }else{
          state.coins+=drop.value*3;
          flash("เก็บเหรียญ +" + (drop.value*3));
        }
        state.items=state.potions+state.rareSeeds;
        world.drops.splice(i,1);
        persist();
      }else if(drop.life<=0){
        world.drops.splice(i,1);
      }
    }

    const npcDx=world.npc.pos.x-world.player.pos.x;
    const npcDz=world.npc.pos.z-world.player.pos.z;
    state.nearbyNpc=Math.hypot(npcDx,npcDz)<1.8;

    const merchantDx=world.merchant.pos.x-world.player.pos.x;
    const merchantDz=world.merchant.pos.z-world.player.pos.z;
    state.nearbyMerchant=Math.hypot(merchantDx,merchantDz)<1.8;

    const chestDx=world.chest.pos.x-world.player.pos.x;
    const chestDz=world.chest.pos.z-world.player.pos.z;
    state.nearbyChest=!world.chest.opened&&Math.hypot(chestDx,chestDz)<1.5;

    if(state.hp<=0){
      state.hp=state.maxHp;
      world.player.pos.set(0,0,0);
      flash("คุณพ่ายแพ้และฟื้นคืนชีพ");
    }

    document.getElementById("hpFill").style.width=(state.hp/state.maxHp*100)+"%";
    document.getElementById("mpFill").style.width=(state.mp/state.maxMp*100)+"%";
    document.getElementById("xpFill").style.width=(state.xp/(state.level*100)*100)+"%";
    document.getElementById("status").textContent=`Lv.${state.level} Seed Ranger`;
    document.getElementById("coins").textContent=state.coins;
    state.items=state.potions+state.rareSeeds;
    document.getElementById("items").textContent=state.items;
    if(!inventoryPanel.classList.contains("hidden"))syncInventory();
    const questText=document.getElementById("questText");
    if(state.questDone){
      questText.textContent="สำเร็จแล้ว — สำรวจหมู่บ้าน";
    }else if(state.kills>=5){
      questText.textContent="กลับไปหาผู้ดูแลสวน";
    }else{
      questText.innerHTML='กำจัดตั๊กแตน <span id="questCount">'+Math.min(5,state.kills)+'</span>/5';
    }

    const s1=document.getElementById("skillBtn");
    const s2=document.getElementById("skill2Btn");
    s1.textContent=state.skillCd>0?`สกิล 1 ${state.skillCd.toFixed(1)}`:"สกิล 1";
    s2.textContent=state.skill2Cd>0?`สกิล 2 ${state.skill2Cd.toFixed(1)}`:"สกิล 2";
    document.getElementById("target").textContent="เป้าหมาย: "+(state.target?(state.target.boss?"บอสตั๊กแตนยักษ์":state.target.kind):"ไม่มี");
    const hint=document.getElementById("hint");
    const interact=document.getElementById("interactBtn");
    interact.classList.toggle("visible",state.nearbyNpc||state.nearbyMerchant||state.nearbyChest);
    if(state.nearbyNpc){
      hint.textContent=state.kills>=5&&!state.questDone?"กด คุย เพื่อส่งเควสต์":"กด คุย กับผู้ดูแลสวน";
      interact.textContent="คุย";
      hint.classList.remove("hidden");
    }else if(state.nearbyMerchant){
      hint.textContent="กด คุย เพื่อเปิดร้านค้า";
      interact.textContent="ร้านค้า";
      hint.classList.remove("hidden");
    }else if(state.nearbyChest){
      hint.textContent="กด เปิด เพื่อเปิดหีบสมบัติ";
      interact.textContent="เปิด";
      hint.classList.remove("hidden");
    }else{
      hint.textContent="ลากพื้นที่ว่างเพื่อหมุนกล้อง";
      interact.textContent="คุย";
      if(state.kills>0)hint.classList.add("hidden");
    }
  }

  function render(){
    const desiredCamX=world.player.pos.x+Math.sin(cameraYaw)*cameraDistance;
    const desiredCamY=8.4+(cameraDistance-11.5)*.18;
    const desiredCamZ=world.player.pos.z+Math.cos(cameraYaw)*cameraDistance;

    renderer.camera.targetX=OD.lerp(renderer.camera.targetX,world.player.pos.x,.14);
    renderer.camera.targetY=OD.lerp(renderer.camera.targetY,.75,.14);
    renderer.camera.targetZ=OD.lerp(renderer.camera.targetZ,world.player.pos.z,.14);
    renderer.camera.x=OD.lerp(renderer.camera.x,desiredCamX,.12);
    renderer.camera.y=OD.lerp(renderer.camera.y,desiredCamY,.12);
    renderer.camera.z=OD.lerp(renderer.camera.z,desiredCamZ,.12);

    renderer.begin();

    // Floating island body
    renderer.drawBox(0,-.82,0,16,.72,16,[.32,.56,.24,1]);
    renderer.drawBox(0,-2.55,0,12.5,1.25,12.5,[.40,.30,.23,1]);
    renderer.drawBox(0,-4.2,0,8.5,.85,8.5,[.34,.25,.21,1]);

    // Main dirt path
    for(let i=-9;i<=9;i++){
      renderer.drawBox(i*1.3,-.03,0,0.62,.035,1.25,[.63,.46,.29,1],0.02*Math.sin(i));
    }

    // Village area
    renderer.drawBox(-8.6,.65,-7.1,1.7,.8,1.55,[.84,.75,.55,1],.18);
    renderer.drawBox(-8.6,1.75,-7.1,1.95,.32,1.75,[.78,.25,.19,1],.18);
    renderer.drawBox(-7.9,.55,-5.2,1.1,.7,1.0,[.74,.66,.48,1],-.22);
    renderer.drawBox(-7.9,1.5,-5.2,1.28,.28,1.15,[.72,.22,.16,1],-.22);

    // Pond and bridge
    renderer.drawBox(7.6,-.02,6.6,2.4,.04,1.7,[.18,.58,.78,1],-.28);
    for(let i=-2;i<=2;i++){
      renderer.drawBox(7.6+i*.52,.16,6.6,.22,.07,1.92,[.52,.34,.18,1],-.28);
    }

    // Decorative rocks, flowers and trees
    for(let i=0;i<28;i++){
      const a=i*Math.PI*2/28;
      const r=12.4+(i%4)*.55;
      const x=Math.cos(a)*r,z=Math.sin(a)*r;
      renderer.drawBox(x,.5,z,.18,.65,.18,[.39,.24,.13,1]);
      renderer.drawBox(x,1.38,z,.62+(i%2)*.12,.72,.62,[.10,.43+(i%3)*.03,.18,1],a*.3);
      renderer.drawBox(x,2.15,z,.44,.54,.44,[.14,.50,.22,1],-a*.2);
    }

    for(let i=0;i<16;i++){
      const x=((i*7)%21)-10;
      const z=((i*11)%19)-9;
      if(Math.abs(z)<1.7) continue;
      renderer.drawBox(x,.12,z,.18,.12,.16,[.48,.48,.46,1],i*.31);
      renderer.drawBox(x+.17,.16,z-.10,.10,.08,.10,[.60,.58,.54,1],i*.13);
    }

    for(let i=0;i<20;i++){
      const x=((i*5)%23)-11;
      const z=((i*9)%21)-10;
      if(Math.abs(z)<1.5) continue;
      const colors=[[1,.38,.45,1],[1,.78,.25,1],[.72,.43,1,1]];
      renderer.drawBox(x,.12,z,.04,.16,.04,[.18,.48,.16,1]);
      renderer.drawBox(x,.28,z,.11,.06,.11,colors[i%colors.length],i*.4);
    }

    // NPC quest giver
    const npc=world.npc.pos;
    renderer.drawBox(npc.x,.48,npc.z,.30,.42,.25,[.34,.28,.58,1],.35);
    renderer.drawBox(npc.x,.98,npc.z,.34,.34,.28,[.52,.42,.76,1],.35);
    renderer.drawBox(npc.x,1.48,npc.z,.25,.25,.25,[.86,.67,.52,1],.35);
    renderer.drawBox(npc.x,1.92,npc.z,.09,.09,.09,[1,.84,.18,1],0);

    // Merchant NPC
    const merchant=world.merchant.pos;
    renderer.drawBox(merchant.x,.48,merchant.z,.30,.42,.25,[.43,.24,.12,1],-.2);
    renderer.drawBox(merchant.x,.98,merchant.z,.34,.34,.28,[.72,.43,.16,1],-.2);
    renderer.drawBox(merchant.x,1.48,merchant.z,.25,.25,.25,[.84,.64,.48,1],-.2);
    renderer.drawBox(merchant.x,1.76,merchant.z,.34,.10,.34,[.52,.18,.08,1],-.2);

    // Treasure chest
    const chest=world.chest.pos;
    if(!world.chest.opened){
      renderer.drawBox(chest.x,.24,chest.z,.48,.22,.34,[.44,.23,.10,1],-.25);
      renderer.drawBox(chest.x,.55,chest.z,.50,.12,.36,[.68,.38,.14,1],-.25);
      renderer.drawBox(chest.x,.46,chest.z,.08,.08,.38,[1,.72,.18,1],-.25);
    }

    // Player: stylized Seed Ranger with procedural movement
    const p=world.player.pos;
    const f=world.player.facing;
    const moving=Math.abs(input.axis().x)+Math.abs(input.axis().y)>.08;
    const bob=moving?Math.abs(Math.sin(world.player.walkTime))*.08:Math.sin(world.player.walkTime)*.015;
    const attack=Math.sin((1-world.player.attackTime/.42)*Math.PI)*Math.min(1,world.player.attackTime*5);
    renderer.drawBox(p.x,.50+bob,p.z,.30,.42,.24,[.16,.50,.26,1],f);
    renderer.drawBox(p.x,.98+bob,p.z,.33,.34,.28,[.24,.64,.34,1],f);
    renderer.drawBox(p.x,1.48+bob,p.z,.25,.25,.25,[.92,.72,.58,1],f);
    renderer.drawBox(
      p.x+Math.sin(f)*.02,
      1.78,
      p.z+Math.cos(f)*.02,
      .34,.18,.34,[.10,.34,.20,1],f
    );
    renderer.drawBox(
      p.x+Math.cos(f)*(.35+attack*.12),
      1.04+bob,
      p.z-Math.sin(f)*(.35+attack*.12),
      .08,.48,.08,[.48,.28,.12,1],f
    );
    renderer.drawBox(
      p.x-Math.cos(f)*(.35+attack*.12),
      1.04+bob,
      p.z+Math.sin(f)*(.35+attack*.12),
      .08,.48,.08,[.48,.28,.12,1],f
    );

    // Locked / active target indicator
    const activeTarget=state.lockedTarget||state.target;
    if(activeTarget&&!activeTarget.dead){
      renderer.drawBox(activeTarget.pos.x,.03,activeTarget.pos.z,.62,.025,.62,[.78,.12,.88,1],performance.now()*.001);
      renderer.drawBox(activeTarget.pos.x,.035,activeTarget.pos.z,.40,.028,.40,[.95,.45,1,1],-performance.now()*.0013);
    }

    // Enemies
    for(const e of world.enemies){
      if(e.dead)continue;
      const s=e.boss?1.75:1;
      const dx=world.player.pos.x-e.pos.x;
      const dz=world.player.pos.z-e.pos.z;
      const ang=Math.atan2(dx,dz);

      if(e.kind==="beetle"){
        renderer.drawBox(e.pos.x,.43*s,e.pos.z,.58*s,.33*s,.44*s,[.24,.12,.08,1],ang);
        renderer.drawBox(
          e.pos.x+Math.sin(ang)*.48*s,.50*s,
          e.pos.z+Math.cos(ang)*.48*s,
          .28*s,.23*s,.28*s,[.36,.20,.12,1],ang
        );
        renderer.drawBox(e.pos.x,.69*s,e.pos.z,.42*s,.18*s,.34*s,[.44,.18,.10,1],ang);
      }else{
        renderer.drawBox(e.pos.x,.46*s,e.pos.z,.54*s,.30*s,.38*s,[.34,.62,.20,1],ang);
        renderer.drawBox(
          e.pos.x+Math.sin(ang)*.48*s,.53*s,
          e.pos.z+Math.cos(ang)*.48*s,
          .27*s,.22*s,.26*s,[.46,.72,.27,1],ang
        );
        renderer.drawBox(
          e.pos.x-Math.cos(ang)*.42*s,.18*s,
          e.pos.z+Math.sin(ang)*.42*s,
          .08*s,.32*s,.08*s,[.18,.28,.10,1],ang+.55
        );
        renderer.drawBox(
          e.pos.x+Math.cos(ang)*.42*s,.18*s,
          e.pos.z-Math.sin(ang)*.42*s,
          .08*s,.32*s,.08*s,[.18,.28,.10,1],ang-.55
        );
      }

      // Enemy HP indicator
      const hpRatio=Math.max(0,e.hp/e.maxHp);
      renderer.drawBox(e.pos.x,1.28*s,e.pos.z,.52*s,.045*s,.06*s,[.22,.08,.08,1],0);
      renderer.drawBox(e.pos.x-(1-hpRatio)*.52*s,1.29*s,e.pos.z,.52*s*hpRatio,.032*s,.065*s,[.92,.18,.16,1],0);
    }

    // Loot drops
    for(const drop of world.drops){
      const floatY=.28+Math.sin(drop.spin)*.10;
      const primary=drop.kind==="potion"?[.95,.20,.28,1]:(drop.kind==="rareSeed"?[.62,.35,1,1]:[1,.76,.18,1]);
      renderer.drawBox(drop.pos.x,floatY,drop.pos.z,.14,.14,.14,primary,drop.spin);
      renderer.drawBox(drop.pos.x,floatY+.20,drop.pos.z,.07,.07,.07,[.45,.90,1,1],-drop.spin);
    }

    // Projectiles with a short trail
    for(const pr of world.projectiles){
      renderer.drawBox(pr.pos.x,.76,pr.pos.z,.10,.10,.10,[1,.72,.18,1]);
      renderer.drawBox(pr.pos.x-.13,.76,pr.pos.z,.07,.06,.06,[1,.42,.08,.75]);
    }
  }

  let last=performance.now();
  function loop(now){
    requestAnimationFrame(loop);
    const dt=Math.min(.04,(now-last)/1000);last=now;
    update(dt);render();
  }
  requestAnimationFrame(loop);

}catch(err){
  showError(err.message||String(err));
}
})();


