import Emitter from 'events';
import WebSocket from 'ws';
import { DBFuncs } from './db';
import {Dungeon, Hunter} from './game/game'
import {randomUUID as uuidv4} from 'crypto';

export const ALL = new Array<Player>();

const ERROR = (message: string) => JSON.stringify({act: "ERROR", message});
const OK = (message: string) => JSON.stringify({act: "OK", message});
const _ = JSON.stringify;

export class Player extends Emitter {
  uuid: string;
  ws: WebSocket;
  login: string | undefined;
  rarity: Hunter | undefined;
  constructor(ws: WebSocket) {
    super();
    this.uuid = uuidv4();
    this.ws = ws;

    ALL.push(this);

    this.ws.on('message', (message) => {
      const json = JSON.parse(message.toString('utf8'));
      console.log(json);
      this.emit(json.act, json);
    });
    this.ws.on('close', () => {
      ALL.splice(ALL.indexOf(this), 1);
      this.emit('LEAVE');
    });

    this.on('GETHUNTERS', ()=>{
      const dung = this.getDung();
      const hunters: string[] = [];
      for (const h of dung.hunters.values()) {
        hunters.push(h.name);
      }
      console.log(hunters);
      ws.send(_({"act": "GETHUNTERS", hunters}));
    })

    this.on('JOIN', async (json: {session: string, dung: string}) => {
      const dung = Dungeon.ALL.get(json.dung) as Dungeon;
      const q = `SELECT login FROM sessions WHERE uuid='${json.session}'`;
      this.login = (await DBFuncs.get(q)).login;
      this.rarity = dung.addHunter(this);
      ws.send(_({"act": "OKJOIN"}));
      for (const p of dung.hunters) {
        p[1].player.ws.send(_({act:'JOIN', name: this.login}));
      }
    });

    this.on('START', (json: {session: string}) => {
      const dung = this.getDung();
      if (json.session !== dung.uuid) ws.send(ERROR("Not owner"));
      else dung.start();
    });

    this.on('LEAVE', () => {
      const dung = this.getDung();
      if (dung !== undefined)
      for (const p of dung.hunters) {
        p[1].player.ws.send(_({act:"LEAVE", name: this.login}))
      }
      this.rarity?.SilentRemove();
      this.rarity = undefined;
    });

    this.on('LOOKUP', () => {
      const json: any = this.rarity?.room.lookup();
      json.act = "LOOKUP";
      ws.send(_(json));
    });

    this.on('GOTODOOR', (json: {num: number}) => {
      this.rarity?.onGotoDoor(json.num);
    });

    this.on('SHOOT', (json: {rooms: number[]}) => {
      this.rarity?.onShoot(json.rooms.slice(0, 3));
    });
  }
  getDung() {
    return this.rarity?.room.dung as Dungeon;
  }
}

export async function closeAllConnectionOfPlayer(login: string) {
  const active = ALL.filter((p)=>p.login===login);
  for (let i = ALL.length-1; i >= 0; i--) {
    if (!active.includes(ALL[i])) continue;
    ALL[i].ws.send(ERROR("You play aleary in other device"));
    ALL[i].ws.close();
  }
  await DBFuncs.delSession(login);
}