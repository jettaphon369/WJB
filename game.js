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

  drawBox(x,y,z,sx,sy,sz,color){
    const model=this.modelMatrix(x,y,z,sx,sy,sz);
    const mvp=this.multiply(this.proj,this.multiply(this.view,model));
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.cube.vb);
    this.gl.enableVertexAttribArray(this.locations.pos);
    this.gl.vertexAttribPointer(this.locations.pos,3,this.gl.FLOAT,false,0,0);
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,this.cube.ib);
    this.gl.uniformMatrix4fv(this.locations.mvp,false,mvp);
    this.gl.uniform4fv(this.locations.color,color);
    this.gl.drawElements(this.gl.TRIANGLES,this.cube.count,this.gl.UNSIGNED_SHORT,0);
  }

  modelMatrix(x,y,z,sx,sy,sz){
    return new Float32Array([sx,0,0,0, 0,sy,0,0, 0,0,sz,0, x,y,z,1]);
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
    this.player={pos:new OD.Vec3(0,0,0),facing:0};
    this.enemies=[];
    this.projectiles=[];
    this.drops=[];
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
      hp:boss?450:(kind==="beetle"?140:75),
      maxHp:boss?450:(kind==="beetle"?140:75),
      speed:boss?1.05:(kind==="beetle"?1.1:1.7),
      damage:boss?25:(kind==="beetle"?14:8),
      cooldown:0,
      dead:false
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

function showError(msg){
  const el=document.getElementById("errorBox");
  el.style.display="block";
  el.textContent="เกิดข้อผิดพลาด: "+msg;
}
window.addEventListener("error",e=>showError(e.message||"Unknown error"));

try{
  const renderer=new OD.Renderer(document.getElementById("game"));
  const world=new OD.World();
  const input=new OD.Input();

  const save=JSON.parse(localStorage.getItem("orchardiaSaveV1")||'{"level":1,"xp":0,"coins":0,"items":0,"kills":0}');
  const state={
    hp:100,maxHp:100,mp:100,maxMp:100,
    level:save.level,xp:save.xp,coins:save.coins,items:save.items,kills:save.kills,
    attackCd:0,skillCd:0,rollCd:0,target:null
  };

  function persist(){
    localStorage.setItem("orchardiaSaveV1",JSON.stringify({
      level:state.level,xp:state.xp,coins:state.coins,items:state.items,kills:state.kills
    }));
  }

  function flash(text){
    const m=document.getElementById("message");
    m.textContent=text;m.classList.add("show");
    clearTimeout(flash.t);
    flash.t=setTimeout(()=>m.classList.remove("show"),1200);
  }

  function shoot(damage,speed){
    const target=state.target&&!state.target.dead?state.target:OD.findNearestEnemy(world);
    if(!target)return flash("ไม่มีเป้าหมาย");
    state.target=target;
    world.projectiles.push({
      pos:world.player.pos.clone().add(new OD.Vec3(0,.8,0)),
      target,damage,speed,dead:false
    });
  }

  document.getElementById("attackBtn").onclick=()=>{
    if(state.attackCd>0)return;
    state.attackCd=.55;shoot(22,8);
  };

  document.getElementById("skillBtn").onclick=()=>{
    if(state.skillCd>0||state.mp<25)return;
    state.skillCd=5;state.mp-=25;shoot(60,11);flash("Seed Burst!");
  };

  document.getElementById("rollBtn").onclick=()=>{
    if(state.rollCd>0)return;
    state.rollCd=2;
    const a=world.player.facing;
    world.player.pos.x+=Math.sin(a)*2.2;
    world.player.pos.z+=Math.cos(a)*2.2;
  };

  function killEnemy(enemy){
    enemy.dead=true;
    state.kills++;
    state.coins+=enemy.boss?50:5;
    state.xp+=enemy.boss?100:20;
    if(Math.random()<.45)state.items++;
    if(state.xp>=state.level*100){
      state.xp-=state.level*100;state.level++;state.maxHp+=15;state.hp=state.maxHp;flash("เลเวลอัป!");
    }
    if(state.kills===5){
      flash("เควสต์สำเร็จ! บอสปรากฏ");
      world.spawnEnemy("hopper",true,10,0);
    }
    persist();
  }

  function update(dt){
    state.attackCd=Math.max(0,state.attackCd-dt);
    state.skillCd=Math.max(0,state.skillCd-dt);
    state.rollCd=Math.max(0,state.rollCd-dt);
    state.mp=Math.min(state.maxMp,state.mp+10*dt);

    const axis=input.axis();
    const len=Math.hypot(axis.x,axis.y);
    if(len>.05){
      const nx=axis.x/(len>1?len:1),nz=axis.y/(len>1?len:1);
      world.player.pos.x+=nx*4*dt;
      world.player.pos.z+=nz*4*dt;
      world.player.facing=Math.atan2(nx,nz);
    }
    world.player.pos.x=OD.clamp(world.player.pos.x,-14,14);
    world.player.pos.z=OD.clamp(world.player.pos.z,-14,14);

    state.target=OD.findNearestEnemy(world);

    for(const e of world.enemies){
      if(e.dead)continue;
      const dx=world.player.pos.x-e.pos.x,dz=world.player.pos.z-e.pos.z;
      const d=Math.hypot(dx,dz);
      if(d>1.1){
        e.pos.x+=dx/d*e.speed*dt;
        e.pos.z+=dz/d*e.speed*dt;
      }else{
        e.cooldown-=dt;
        if(e.cooldown<=0){e.cooldown=1.1;state.hp-=e.damage;flash("-"+e.damage+" HP");}
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
    document.getElementById("items").textContent=state.items;
    document.getElementById("questCount").textContent=Math.min(5,state.kills);
    document.getElementById("target").textContent="เป้าหมาย: "+(state.target?(state.target.boss?"บอสตั๊กแตนยักษ์":state.target.kind):"ไม่มี");
  }

  function render(){
    renderer.camera.targetX=world.player.pos.x;
    renderer.camera.targetY=.5;
    renderer.camera.targetZ=world.player.pos.z;
    renderer.camera.x=world.player.pos.x;
    renderer.camera.y=7.5;
    renderer.camera.z=world.player.pos.z+10;

    renderer.begin();

    renderer.drawBox(0,-.8,0,16,.7,16,[.34,.57,.26,1]);
    renderer.drawBox(0,-2.6,0,12,1.2,12,[.42,.31,.24,1]);

    for(let i=0;i<18;i++){
      const a=i*Math.PI*2/18,r=12.8+(i%3)*.5;
      renderer.drawBox(Math.cos(a)*r,.55,Math.sin(a)*r,.22,.7,.22,[.42,.26,.14,1]);
      renderer.drawBox(Math.cos(a)*r,1.6,Math.sin(a)*r,.75,1.0,.75,[.12,.48,.21,1]);
    }

    const p=world.player.pos;
    renderer.drawBox(p.x,.7,p.z,.38,.72,.38,[.22,.62,.32,1]);
    renderer.drawBox(p.x,1.55,p.z,.28,.28,.28,[.92,.72,.58,1]);

    for(const e of world.enemies){
      if(e.dead)continue;
      const s=e.boss?1.55:1;
      const color=e.kind==="beetle"?[.28,.16,.12,1]:[.36,.62,.22,1];
      renderer.drawBox(e.pos.x,.45*s,e.pos.z,.55*s,.35*s,.42*s,color);
      renderer.drawBox(e.pos.x-.55*s,.52*s,e.pos.z,.26*s,.24*s,.28*s,color);
    }

    for(const pr of world.projectiles){
      renderer.drawBox(pr.pos.x,.75,pr.pos.z,.10,.10,.10,[1,.72,.18,1]);
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


