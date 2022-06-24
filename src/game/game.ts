import {randomUUID as uuidv4} from 'crypto';
import {Player} from '../player';

export class Dungeon {
  static ALL = new Map<string, Dungeon>();
  timer: NodeJS.Timeout | undefined;
  uuid: string;
  rooms: Room[] = [];
  hunters = new Map<string, Hunter>();
  constructor(uuid: string | undefined) {
    this.uuid = uuid ?? uuidv4();
    Dungeon.ALL.set(this.uuid, this);
  }
  start() {
    this.hunters.forEach((v,k)=>{
      this.actStart(v.player);
    });
    this.timer = setTimeout(()=>{
      this.hunters.forEach((h)=>{h.actDie('ВАМПУС ПРОСНУЛСЯ')});
      this.end();
    },10*60*1000)
  }
  actStart(player: Player) {
    player.ws.send(JSON.stringify({
      act:"START"
    }));
  }
  actWin() {

  }
  end() {
    clearTimeout(this.timer);
    Dungeon.ALL.delete(this.uuid);
  }
  addHunter(player: Player): Hunter {
    const rWR = this.rooms.filter((r)=>r.rars.length!==0);
    const t = [...this.rooms];
    for (const r of rWR) {
      r.doors.forEach((d)=>{
        if (t.includes(d)) t.splice(t.indexOf(d), 1);
      });
      if (t.includes(r)) t.splice(t.indexOf(r), 1);
    }
    if (t.length === 0) throw new Error();
    else return new Hunter(t[Math.trunc(Math.random()*t.length)], player);
  }

  out(): void {
    console.log(this.rooms.length);
    this.rooms.forEach((r) => {
      let out = `${r.num}`.padEnd(2)+' -> ';
      r.doors.forEach((d)=>{out+=`${d.num}`.padEnd(3)});
      r.rars.forEach((rar)=>{out+=rar.type+' '});
      console.log(out);
    });
  }
}
class Room {
  dung: Dungeon;
  num: number = -1;
  doors: Room[] = [];
  rars: Rarity[] = [];
  constructor(dung: Dungeon) {
    this.dung = dung;
  }
  lookup(): any {
    const lookup: any = {};
    lookup.num = this.num;
    lookup.doors = this.doors.map((r)=>r.num);
    lookup.wump = this.lookupDoorsForRars('wumpus');
    lookup.cough = this.lookupDoorsForRars('hunter');
    lookup.hunters = this.getHuntersHere().map((h)=> h.name);
    lookup.breeze = this.lookupDoorsForRars('pit');
    lookup.flop = this.lookupDoorsForRars('bat');
    return lookup;
  }
  lookupDoorsForRars(rarType: string): boolean {
    return this.doors.some((r)=>r.lookupRars(rarType));
  }
  lookupRars(rarType: string): boolean {
    return this.rars.some((r)=>r.type===rarType);
  }
  getHuntersHere(): Hunter[] {
    return (this.rars.filter((r)=>r.type==='hunter') as Hunter[]);
  }
  tryKillAnyone(killer: Hunter): boolean {
    if (this.lookupRars('wumpus')) {
      const wumpus = this.rars.find((rar)=>rar.type==='wumpus') as Wumpus;
      wumpus.Die();
      return true;
    }
    if (this.lookupRars('hunter')) {
      const hunters = this.rars.filter((rar)=>rar.type==='hunter') as Hunter[];
      hunters[Math.trunc(Math.random()*hunters.length)].actDie('ВАС ПРОНЗИЛА СТРЕЛА');
      return true;
    }
    return false;
  }
  actWhistling() {
    const hunters = this.rars.filter((v)=>v.type==='hunter') as Hunter[];
    hunters.forEach((v)=>v.player.ws.send(JSON.stringify({
      act: "WHISTLE"
    })));
  }
  actSteps() {
    for (const door of this.doors) {
      const hunters = door.rars.filter((v)=>v.type==='hunter') as Hunter[];
      hunters.forEach((v)=>v.player.ws.send(JSON.stringify({
        act: "STEPS"
      })));
    }
  }
}
abstract class Rarity {
  room: Room;
  type: string;
  constructor(room: Room, type: string) {
    room.rars.push(this);
    this.room = room;
    this.type = type;
  }
}
export class Hunter extends Rarity {
  player: Player;
  name: string;
  arrows: number;
  constructor(room: Room, player: Player) {
    super(room, 'hunter');
    this.player = player;
    this.name = this.player.login as string;
    this.arrows = 5;
    room.dung.hunters.set(this.name, this);
  }
  onShoot(rooms: number[]) {
    if (this.arrows <= 0) {
      this.player.ws.send(JSON.stringify({
        act: "OUTOFAMMO"
      }));
      return;
    }
    this.arrows--;
    let current = this.room;
    const _ = () => Math.trunc(Math.random()*3);
    for (const roomNum of rooms) {
      if (current.doors.map((r)=>r.num).includes(roomNum)) {
        current = this.room.dung.rooms.find((r)=>r.num===roomNum) as Room;
      }
      else current = current.doors[_()];
      current.doors.forEach((d)=>{d.actWhistling()});
      if (current.tryKillAnyone(this)) break;
    }
  }
  onGotoDoor(room: number | Room) {
    if (typeof(room) === 'number')
      room = this.room.dung.rooms.find((v)=>v.num===room) as Room;
    this.room.actSteps();
    this.room.rars.splice(this.room.rars.indexOf(this), 1);
    const huntersPrev = this.room.rars.filter((v)=>v.type==='hunter') as Hunter[];
    for (const h of huntersPrev) {
      h.player.ws.send(JSON.stringify({
        act: "HUNTERLEAVE"
      }));
    }
    this.room = room;
    this.room.actSteps();
    if (room.lookupRars('wumpus')) {
      this.actDie('ВАМПУС СЪЕЛ ВАС');
      return;
    }
    if (room.lookupRars('pit')) {
      this.player.ws.send(JSON.stringify({
        act: "PITHERE",
      }));
      this.actDie('ВЫ УПАЛИ В ЯМУ');
      return;
    }
    const hunters = this.room.rars.filter((v)=>v.type==='hunter') as Hunter[];
    for (const h of hunters) {
      h.player.ws.send(JSON.stringify({
        act: "HUNTERENTER"
      }));
    }
    this.room.rars.push(this);
    if (room.lookupRars('bat')) {
      this.player.ws.send(JSON.stringify({
        act: "BATHERE",
      }));
      let newRoom = 1+Math.trunc(Math.random()*(room.dung.rooms.length-1));
      setTimeout(()=>{
        this.player.ws.send(JSON.stringify({
          act: "BATTRAVELEND",
          num: newRoom
        }));
        this.onGotoDoor(newRoom);
      }, 0);
      return;
    }
    const json: any = this.room.lookup();
    json.act = "LOOKUP";
    console.log(JSON.stringify(json));
    this.player.ws.send(JSON.stringify(json));
  }
  actDie(cause: string): void {
    this.player.ws.send(JSON.stringify({
      act:'DEATH',
      cause
    }));
  }
  SilentRemove(): void {
    this.room.dung.hunters.delete(this.name);
    this.room.rars.splice(this.room.rars.indexOf(this), 1);
  }
}
class Wumpus extends Rarity {
  constructor(room: Room) {
    super(room, 'wumpus');
  }
  randomWalk() {
    const roomToGo = this.room.doors[Math.trunc(Math.random()*3)];
    this.room.rars.splice(this.room.rars.indexOf(this), 1);
    this.room = roomToGo;
    this.room.rars.push(this);
  }
  Die() {
    for (const h of this.room.dung.hunters) {
      h[1].player.ws.send(JSON.stringify({
        act: "WIN"
      }));
    }
  }
}
class Pit extends Rarity {
  constructor(room: Room) {
    super(room, 'pit');
  }
}
class Bat extends Rarity {
  constructor(room: Room) {
    super(room, 'bat');
  }
}

export class Utils {
  static genDung(uuid: string | undefined, layers: number = 1): Dungeon {
    const dung = new Dungeon(uuid);
  
    const rooms1 = Array.from({length:  5}, () => new Room(dung));
    const rooms2 = Array.from({length: 10}, () => new Room(dung));
    const rooms3 = Array.from({length:  5}, () => new Room(dung));
  
    dung.rooms = [...rooms1, ...rooms2, ...rooms3];

    let _: Function = (arr: Room[], i: number): Room => arr[(arr.length + i) % arr.length];
  
    for (let i = 0; i < rooms1.length; i++) {
      rooms1[i].doors.push(_(rooms1, i-1));
      rooms1[i].doors.push(_(rooms2, i*2));
      _(rooms2, i*2).doors.push(rooms1[i]);
      rooms1[i].doors.push(_(rooms1, i+1));
    }
    for (let i = 0; i < rooms3.length; i++) {
      rooms3[i].doors.push(_(rooms3, i-1));
      rooms3[i].doors.push(_(rooms2, 1+i*2));
      _(rooms2, 1+i*2).doors.push(rooms3[i]);
      rooms3[i].doors.push(_(rooms3, i+1));
    }
    for (let i = 0; i < rooms2.length; i++) {
      rooms2[i].doors.push(_(rooms2, i-1));
      rooms2[i].doors.push(_(rooms2, i+1));
    }

    {
      let i = 1;
      dung.rooms
      .map(v => ({v, s:Math.random()}))
      .sort((a, b) => a.s - b.s)
      .forEach(({v})=>{v.num=i++});
    }

    _ = (max: number) => Math.trunc(Math.random()*max);
    new Bat(rooms1[_(rooms1.length)]);
    new Pit(rooms1[_(rooms1.length)]);
    if (Math.random() >= 0.5) new Bat(rooms2[_(rooms2.length)]);
    else new Pit(rooms2[_(rooms2.length)]);
    
    new Wumpus(dung.rooms[0]);
    
    return dung;
  }
}