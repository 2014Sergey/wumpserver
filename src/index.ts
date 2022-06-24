//import https from 'https'
import http from 'http'
import {WebSocketServer} from 'ws';
import {startAdminCLI} from './admin';
import {closeAllConnectionOfPlayer, Player, ALL} from './player'
import {randomUUID as uuidv4} from 'crypto';
import {DBFuncs} from './db';
import {Utils, Dungeon} from './game/game'

const ERROR = (message: string) => JSON.stringify({act: "ERROR", message});
const OK = (message: string) => JSON.stringify({act: "OK", message});
const ParseJSON = (str: string): any => {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
};
const serverListener: http.RequestListener = async (req, res: any) => {
  if (req.method === 'POST') {
    res.setLengthAndEnd = (body: string) => {
      res.setHeader('content-length', Buffer.from(body).byteLength);
      res.end(body);
    };
    const body: Buffer[] = [];
    for await (const chunk of req)
      body.push(chunk as Buffer);
    const str = Buffer.concat(body).toString();
    console.log(str);
    const json: any = ParseJSON(str);
    switch (req.url) {
      case '/api/register':
        await DBFuncs.insertHunter(json.login, json.password);
      case '/api/login':
        if (await DBFuncs.isUserExists(json.login))
          if (await DBFuncs.isPasswordValid(json.login, json.password)) {
            await closeAllConnectionOfPlayer(json.login);
            const uuid = uuidv4();
            await DBFuncs.regSession(json.login, uuid);
            res.setLengthAndEnd(JSON.stringify({act: "OK", uuid}));
          }
          else res.writeHead(400).setLengthAndEnd(ERROR(`Wrong password`));
        else res.writeHead(400).setLengthAndEnd(ERROR(`Hunter ${json.login} not found`));
        break;
      case '/api/newdung':
        res.setLengthAndEnd(JSON.stringify({act:"OK", dung: Utils.genDung(json.uuid).uuid}));
        break;
      case '/api/dungs':
        const dungs: any[] = [];
        for (const d of Dungeon.ALL.values()) {
          if (d.timer !== undefined) return;
          const obj: any = {};
          obj.uuid = d.uuid;
          obj.owner = (await DBFuncs.getLoginFromSession(d.uuid)).login;
          console.log(obj.owner);
          obj.players = d.hunters.size;
          if (obj.players >= 5) return;
          dungs.push(obj);
        }
        res.setLengthAndEnd(JSON.stringify(dungs));
        break;
    }
  }
  else res.setLengthAndEnd(ERROR("Wrong method"));
};

//import {readFileSync} from 'fs'
//const options = {
//  key: readFileSync('./cert/key', 'utf8'),
//  cert: readFileSync('./cert/crt', 'utf8')
//};
//const server = https.createServer(options, serverListener);
const server = http.createServer(serverListener);

const wss = new WebSocketServer({server});
wss.on('connection', (ws) => {
  new Player(ws);
})

startAdminCLI();
server.listen(8080, ()=>console.log("Server started"));