import * as readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import {DBFuncs} from './db'
import { Dungeon } from './game/game';

let AdminCLI: readline.Interface | undefined = undefined;

export function startAdminCLI(): readline.Interface {
  if (AdminCLI === undefined)
    AdminCLI = readline.createInterface({input, output}).on('line', (line: string) => {
      const cmd = line.split(' ', 1)[0];
      if (funcs.has(cmd)) (funcs.get(cmd) as Function)(line);
      else console.error(`Command ${cmd} not found`);
    });
  return AdminCLI;
}
const funcs = new Map<string, Function>();

// PH [dungeon uuid]
funcs.set('PH', (line: string) => {
  const uuid = line.split(' ', 1)[1];
  DBFuncs.getHunters(uuid).then(console.log);
});

// PD [hunter login]
funcs.set('PD', (line: string) => {
  const login = line.split(' ', 1)[1];
  DBFuncs.getDungeon(login).then(console.log);
});
funcs.set('I', (line: string)=>{
  console.log('line: '+line);
  const owner = line.split(' ')[1];
  console.log("Length: "+Dungeon.ALL.size)
  Dungeon.ALL.forEach((v)=>{if (v.hunters.has(owner)) v.out();});
});