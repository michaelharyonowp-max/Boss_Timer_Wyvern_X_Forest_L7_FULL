
const express=require("express");
const cors=require("cors");
const fs=require("fs");
const path=require("path");

const app=express();
app.use(cors());
app.use(express.json());

const BOSS_DB=path.join(__dirname,"bosses.json");
const HISTORY_DB=path.join(__dirname,"history.json");
const BACKUP_DIR=path.join(__dirname,"..","backups");

function load(file){
 return JSON.parse(fs.readFileSync(file,"utf8"));
}

function save(file,data){
 fs.writeFileSync(file,JSON.stringify(data,null,2));
}

let bosses=load(BOSS_DB);
let history=load(HISTORY_DB);
let undoStack=[];

function nowWIB(){
 return new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Jakarta"}));
}

function fmtTime(){
 return nowWIB().toLocaleTimeString("en-GB");
}

function toTS(hhmm){
 const [h,m]=hhmm.split(":").map(Number);
 const now=nowWIB();
 const d=new Date(now);
 d.setHours(h,m,0,0);
 if(d<now)d.setDate(d.getDate()+1);
 return d.getTime();
}

function backup(){
 const stamp=Date.now();
 fs.writeFileSync(
   path.join(BACKUP_DIR,`backup_${stamp}.json`),
   JSON.stringify(bosses,null,2)
 );
}

setInterval(backup,1000*60*60);

function log(text){
 history.unshift({
   text,
   at:fmtTime()
 });
 if(history.length>500)history.pop();
 save(HISTORY_DB,history);
}

function sync(){
 const now=nowWIB().getTime();

 bosses.forEach(b=>{

   if(typeof b.nextRespawn==="undefined"){
      b.nextRespawn=toTS(b.respawn);
   }

   const interval=b.ai*3600000;

   while(now>=b.nextRespawn){
      b.nextRespawn+=interval;
   }

 });

 save(BOSS_DB,bosses);
}

sync();
setInterval(sync,1000);

app.get("/bosses",(req,res)=>{
 sync();
 res.json(bosses);
});

app.get("/history",(req,res)=>{
 res.json(history);
});

app.post("/boss/:name/:action",(req,res)=>{

 const boss=bosses.find(x=>x.name===req.params.name);

 if(!boss){
   return res.status(404).json({error:"not found"});
 }

 undoStack.push(JSON.parse(JSON.stringify(bosses)));

 const action=req.params.action;

 if(action==="kill"){
   boss.nextRespawn=nowWIB().getTime()+(boss.ai*3600000);
 }

 if(action==="miss"){
   boss.nextRespawn+=(boss.ai*3600000);
 }

 log(`${action.toUpperCase()} • ${boss.name}`);

 save(BOSS_DB,bosses);

 res.json({ok:true});
});

app.post("/boss/:name/reset",(req,res)=>{

 const boss=bosses.find(x=>x.name===req.params.name);

 if(!boss){
   return res.status(404).json({error:"not found"});
 }

 undoStack.push(JSON.parse(JSON.stringify(bosses)));

 const {mode,time}=req.body;

 const ts=toTS(time);

 if(mode==="kill"){
    boss.nextRespawn=ts+(boss.ai*3600000);
 }else{
    boss.nextRespawn=ts;
 }

 log(`RESET • ${boss.name}`);

 save(BOSS_DB,bosses);

 res.json({ok:true});
});

app.post("/undo",(req,res)=>{

 if(undoStack.length===0){
   return res.json({ok:false});
 }

 bosses=undoStack.pop();

 save(BOSS_DB,bosses);

 log("UNDO LAST ACTION");

 res.json({ok:true});
});


app.post("/reset-all",(req,res)=>{

 const {time}=req.body;

 undoStack.push(JSON.parse(JSON.stringify(bosses)));

 bosses.forEach(b=>{

   const ts=toTS(time);

   b.nextRespawn=ts;

 });

 log("RESET ALL BOSSES");

 save(BOSS_DB,bosses);

 res.json({ok:true});
});


app.listen(3000,()=>{
 console.log("Boss Timer Wyvern X Forest L7 running");
});
