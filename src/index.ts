import 'dotenv/config';

import fs from 'fs';
import path from 'path';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fastify from 'fastify';
import fastifyWebsocket, { SocketStream } from '@fastify/websocket';
import ShortUniqueId from 'short-unique-id';

// @ts-ignore
import {version} from '../package.json';

const CWD = process.cwd();

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const uid = new ShortUniqueId();
const uidFormat = '$t0-$r23';

const argv = yargs(hideBin(process.argv))
  .option('port', {
    describe: 'Port number to listen on',
    type: 'number',
    default: 3000,
  })
  .option('host', {
    describe: 'Host name to bind to (use \'0.0.0.0\' to expose to the network)',
    type: 'string',
    default: '127.0.0.1',
  })
  .option('store', {
    describe: 'Store chat messages in chats.json',
    type: 'boolean',
    default: false,
  })
  .option('giphy-api-key', {
    describe: 'Giphy API key (https://developers.giphy.com/docs/api/)',
    type: 'string',
    default: '',
  })
  .help()
  .alias('help', 'h')
  .argv;

const {
  port,
  host,
  store,
  giphyApiKey,
} = argv;

const STORE_CHAT = store || process.env.STORE_CHAT;

// const sanitizeErrorString = (errorString: string) => {
//   return errorString.replaceAll(
//     process.cwd(),
//     '',
//   );
// };

const server = fastify();

let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const workerJs = fs.readFileSync(path.join(__dirname, 'worker.js'), 'utf8');
const chatMessageWav = fs.readFileSync(path.join(__dirname, 'assets/sounds/chat-message.wav'));
const participantsUpdateWav = fs.readFileSync(path.join(__dirname, 'assets/sounds/participants-update.wav'));

html = html.replace(
  /["]\/assets[^"]+\.svg["]/g,
  (match) => {
    const assetPath = match.replace(/["]/g, '');

    const assetContents = fs.readFileSync(path.join(__dirname, assetPath), 'utf8');

    return assetContents;
  },
);

html = html.replace(
  /[']\/assets[^']+\.svg[']/g,
  (match) => {
    const assetPath = match.replace(/[']/g, '');

    const assetContents = fs.readFileSync(path.join(__dirname, assetPath), 'utf8');

    return `'${assetContents}'`;
  },
);

html = html.replace(
  /["]\/assets[^"]+\.css["]/g,
  (match) => {
    const assetPath = match.replace(/["]/g, '');

    const assetContents = fs.readFileSync(path.join(__dirname, assetPath), 'utf8');

    return `<style>\n${assetContents}\n\t</style>`;
  },
);

html = html.replace('GIPHY_API_KEY', giphyApiKey || process.env.GIPHY_API_KEY);

server.register(fastifyWebsocket);

class Room {
  public roomId: string;
  public password?: string;

  public clientUids: string[] = [];
  public clientNicknames: Map<string, string> = new Map();
  public clientPongs: string[] = [];
  public clientConnections: Map<string, SocketStream> = new Map();

  public pingClientConnections = async() => {
    this.clientConnections.forEach(
      (clientConnection, clientUid) => {
        // console.log('clientUid', clientUid);
        clientConnection.socket.send(
          JSON.stringify(
            {
              request: 'ping',
              data: {
                uid: clientUid,
                clients: Object.fromEntries(this.clientNicknames),
              },
            },
          ),
        );
      }
    );

    await wait(10000);

    const offlineUids = this.clientUids.filter(
      (clientUid) => {
        return !this.clientPongs.includes(clientUid);
      }
    );

    this.clientUids = [...this.clientPongs];
    this.clientPongs = [];

    offlineUids.forEach(
      (offlineUid) => {
        console.log('Closing connection for:', `${this.clientNicknames.get(offlineUid)} (${offlineUid})`);
        this.clientNicknames.delete(offlineUid);
        this.clientConnections.get(offlineUid)?.socket.close();
        this.clientConnections.delete(offlineUid);
      }
    );

    if (this.clientConnections.size === 0) {
      console.log('Closing room:', this.roomId);
      rooms.delete(this.roomId);
    }
  };

  public verifyPassword = (password: string) => {
    if (!this.password) {
      return true;
    }

    return this.password === password;
  };

  protected finalNickname = (nickname: string): string => {
    let finalNickname = nickname;

    if (Array.from(this.clientNicknames.values()).includes(nickname)){
      finalNickname = `${nickname}1`;
      finalNickname = this.finalNickname(finalNickname);
    }

    return finalNickname;
  };

  public registerNickname = (clientUid: string, nickname: string) => {
    this.clientNicknames.set(clientUid, this.finalNickname(nickname));
  };

  constructor(roomId: string, password?: string) {
    this.roomId = roomId;
    this.password = password;
  }
}

const rooms: Map<string, Room> = new Map();

const storeMessage = (room: Room, data: any) => {
  if (STORE_CHAT) {
    let chatRawData = fs.readFileSync(path.resolve(CWD, 'chats.json'), 'utf8');
    const chatData = JSON.parse(chatRawData);

    if (!chatData[room.roomId]) {
      chatData[room.roomId] = { password: room.password, chatLog: [] };
    }

    chatData[room.roomId].chatLog.push(
      {
        sender: data.uid,
        senderNickname: room.clientNicknames.get(data.uid),
        timestamp: Date.now(),
        message: data.message,
      }
    );

    chatRawData = JSON.stringify(chatData, null, 2);

    fs.writeFileSync(path.resolve(CWD, 'chats.json'), chatRawData);
  }
};

server.register(
  async (fastifyInstance) => {
    fastifyInstance.get(
      '/chat/:roomId',
      { websocket: true },
      (connection, {params}: {params: any},
    ) => {
      const { roomId } = params;

      if (!roomId) {
        return;
      }

      connection.socket.on('message', rawData => {
        const message = rawData.toString();
        const {
          request,
          data,
        } = JSON.parse(message);

        let chatRawData;

        if (!rooms.has(roomId)) {
          let roomPassword = data?.roomPassword;

          if (STORE_CHAT) {
            chatRawData = fs.readFileSync(path.resolve(CWD, 'chats.json'), 'utf8');
            const chatData = JSON.parse(chatRawData);

            if (chatData[roomId]) {
              roomPassword = chatData[roomId].password;
            }
          }

          rooms.set(roomId, new Room(roomId,roomPassword));
        }

        const room = rooms.get(roomId);

        if (request === 'connect') {
          const clientUid = data?.uid || uid.formattedUUID(uidFormat);

          if (!room.verifyPassword(data?.roomPassword)) {
            return;
          }

          if (!data?.uid){
            room.clientUids.push(clientUid);
            room.clientPongs.push(clientUid);
          }

          if (data?.nickname) {
            console.log(`${data?.nickname} (${clientUid}) connected to room: ${roomId}`);

            room.registerNickname(clientUid, data.nickname);
          }

          connection.socket.send(
            JSON.stringify(
              {
                response: 'connected',
                data: {
                  uid: clientUid,
                  clients: Object.fromEntries(room.clientNicknames),
                },
              },
            ),
          );

          setTimeout(
            () => {
              if (STORE_CHAT) {
                chatRawData = fs.readFileSync(path.resolve(CWD, 'chats.json'), 'utf8');
                const chatData = JSON.parse(chatRawData);

                if (chatData[room.roomId]) {
                  const chatLogData = chatData[room.roomId].chatLog;

                  connection.socket.send(
                    JSON.stringify(
                      {
                        broadcast: 'chatLog',
                        data: {
                          chatLog: chatLogData,
                        },
                      },
                    ),
                  );
                }
              }
            },
            1000,
          );

          room.clientConnections.set(clientUid, connection);

          return;
        } else if (request === 'pong') {
          if (data?.uid) {
            room.clientPongs.push(data.uid);
          }

          return;
        } else if (request === 'message') {
          const {uid: sender, ...restData} = data;

          storeMessage(room, data);

          room.clientConnections.forEach(
            (clientConnection, _) => {
              clientConnection.socket.send(
                JSON.stringify(
                  {
                    broadcast: 'message',
                    data: {
                      ...restData,
                      timestamp: Date.now(),
                      clients: Object.fromEntries(room.clientNicknames),
                      sender,
                      senderNickname: room.clientNicknames.get(sender),
                    },
                  },
                ),
              );
            }
          );

          return;
        }
      });
    });
  }
);

// Intercept the request and modify it as needed
server.addHook('preHandler', async (request, reply) => {
  const requestedPath = request.url;

  const {
    path: filePath,
    newFileName,
  } = request.query as any;

  console.log(`Requested path: ${requestedPath}`);

  // If requested path matches malicious regex return error
  if (`${requestedPath} ${filePath} ${newFileName}`.match(/\.\./g)) {
    console.error(
      `Malicious request detected:`,
      {
        requestedPath,
        filePath,
        newFileName,
      },
    );

    reply.status(400).send('Bad Request');
    return;
  }

  // If the requested path is just "/", return an app html with header content-type for an html file
  if (requestedPath === '/') {
    reply.type('text/html').send(html);
    return;
  }

  // If the requested path is "/worker.js", return worker js with header content-type for a js file
  if (requestedPath === '/worker.js') {
    reply.type('text/javascript').send(workerJs);
    return;
  }

  // If the requested path is a sound, return sound data with header content-type for a wav file
  if (requestedPath === '/chat-message.wav') {
    reply.type('audio/wav').send(chatMessageWav);
    return;
  }
  if (requestedPath === '/participants-update.wav') {
    reply.type('audio/wav').send(participantsUpdateWav);
    return;
  }

  if (requestedPath === '/favicon.ico') {
    reply.type('image/x-icon').send('');
    return;
  }

  // Let request through to route handlers
  return;
});

const pingRoomConnections = () => {
  rooms.forEach(
    (room, _) => {
      room.pingClientConnections();
    }
  );
};

console.log(`Starting server, version: ${version}`);

// Start the server
server.listen({port, host}, (error, address) => {
  if (error) {
    console.error(error);
    process.exit(1);
  }

  // runningAddress = address;

  console.log(`Server listening on ${address}`);

  // check if chats.json exists
  if (STORE_CHAT && !fs.existsSync(path.resolve(CWD, 'chats.json'))) {
    fs.writeFileSync(
      path.resolve(CWD, 'chats.json'),
      JSON.stringify(
        {},
        null,
        2,
      ),
    );

    console.log('⚠️ Storing chat messages in chats.json');
  }

  setInterval(
    pingRoomConnections,
    15000,
  );
});

