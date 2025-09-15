import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fastify from 'fastify';
import fastifyWebsocket, { type SocketStream } from '@fastify/websocket';
import ShortUniqueId from 'short-unique-id';
import axios from 'axios';

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
  .option('secure', {
    describe: 'Use secure (https/wss) connection',
    type: 'boolean',
    default: false,
  })
  .option('store', {
    describe: 'Store chat messages in chats.json',
    type: 'boolean',
    default: false,
  })
  .option('speech-synthesis', {
    describe: 'Turn on speech synthesis',
    type: 'boolean',
    default: false,
  })
  .option('sounds', {
    describe: 'Turn on message and participants update sounds',
    type: 'boolean',
    default: false,
  })
  .option('allow-duplicate-nicknames', {
    describe: 'Allow duplicate nicknames',
    type: 'boolean',
    default: false,
  })
  .option('giphy-api-key', {
    describe: 'Giphy API key (https://developers.giphy.com/docs/api/)',
    type: 'string',
    default: '',
  })
  .option('cms-token-endpoint', {
    describe: 'CMS token endpoint',
    type: 'string',
    default: '',
  })
  .option('cms-username', {
    describe: 'CMS username',
    type: 'string',
    default: '',
  })
  .option('cms-password', {
    describe: 'CMS password',
    type: 'string',
    default: '',
  })
  .option('cms-upload-endpoint', {
    describe: 'CMS upload endpoint',
    type: 'string',
    default: '',
  })
  .help()
  .alias('help', 'h')
  .argv;

const {
  port,
  host,
  secure,
  store,
  speechSynthesis,
  sounds,
  allowDuplicateNicknames,
  giphyApiKey,
  cmsTokenEndpoint,
  cmsUsername,
  cmsPassword,
  cmsUploadEndpoint,
} = argv;

const PORT = port || process.env.PORT;
const HOST = host || process.env.HOST;
const SECURE = secure || process.env.SECURE;
const STORE_CHAT = store || process.env.STORE_CHAT;
const SPEECH_SYNTHESIS = speechSynthesis || process.env.SPEECH_SYNTHESIS;
const SOUNDS = sounds || process.env.SOUNDS;
const ALLOW_DUPLICATE_NICKNAMES = allowDuplicateNicknames || process.env.ALLOW_DUPLICATE_NICKNAMES;
const GIPHY_API_KEY = giphyApiKey || process.env.GIPHY_API_KEY;
const CMS_TOKEN_ENDPOINT = cmsTokenEndpoint || process.env.CMS_TOKEN_ENDPOINT;
const CMS_USERNAME = cmsUsername || process.env.CMS_USERNAME;
const CMS_PASSWORD = cmsPassword || process.env.CMS_PASSWORD;
const CMS_UPLOAD_ENDPOINT = cmsUploadEndpoint || process.env.CMS_UPLOAD_ENDPOINT;

// const sanitizeErrorString = (errorString: string) => {
//   return errorString.replaceAll(
//     process.cwd(),
//     '',
//   );
// };

const server = fastify();

let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let workerJs = fs.readFileSync(path.join(__dirname, 'worker.js'), 'utf8');
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

html = html.replace(
  /["]\/assets[^"]+\.js["]/g,
  (match) => {
    const assetPath = match.replace(/["]/g, '');

    const assetContents = fs.readFileSync(path.join(__dirname, assetPath), 'utf8');

    return `<script>\n${assetContents}\n\t</script>`;
  },
);

html = html.replace('GIPHY_API_KEY', GIPHY_API_KEY);

console.log('SPEECH_SYNTHESIS', SPEECH_SYNTHESIS);

if (!SPEECH_SYNTHESIS) {
  html = html.replace('!this.speakOn', 'null');
  html = html.replace('speakOn: true', 'speakOn: null');
}

if (SOUNDS) {
  html = html.replace('soundOn: false', 'soundOn: true');
}

if (SECURE) {
  workerJs = workerJs.replace('ws://', 'wss://');
}

if (CMS_TOKEN_ENDPOINT && CMS_UPLOAD_ENDPOINT) {
  html = html.replace('uploadEndpoint: \'\',', `uploadEndpoint: \'${CMS_UPLOAD_ENDPOINT}\',`);
}

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

    for (const offlineUid of offlineUids) {
      console.log('Closing connection for:', `${this.clientNicknames.get(offlineUid)} (${offlineUid})`);
      this.clientNicknames.delete(offlineUid);
      this.clientConnections.get(offlineUid)?.socket.close();
      this.clientConnections.delete(offlineUid);
    }

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

    if (
      Array.from(this.clientNicknames.values()).includes(nickname)
      && !ALLOW_DUPLICATE_NICKNAMES
    ){
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

        let chatRawData: string;

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
        }

        if (request === 'pong') {
          if (data?.uid) {
            room.clientPongs.push(data.uid);
          }

          return;
        }

        if (request === 'message') {
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

    fastifyInstance.post(
      '/api/auth',
      async (request, reply) => {
        const { roomId, roomPassword } = request.body as any;
        const room = rooms.get(roomId);

        if (!room.verifyPassword(roomPassword)) {
          return;
        }

        console.log('CMS_TOKEN_ENDPOINT', CMS_TOKEN_ENDPOINT);
        console.log('CMS_USERNAME', CMS_USERNAME);
        console.log('CMS_PASSWORD', CMS_PASSWORD);

        const response = await axios.post(CMS_TOKEN_ENDPOINT, {
          email: CMS_USERNAME,
          password: CMS_PASSWORD,
        }, {
          headers: {
            'Content-Type': 'application/json',
          },
        }).catch((error) => {
          console.error('Error getting upload bearer token:', error);
          return { data: {} };
        });

        if (!response.data.token) {
          reply.status(500).send('Internal Server Error');

          return;
        }

        const token = response.data.token;

        reply.type('application/json').send(
          JSON.stringify(
            {
              token,
            }
          )
        );
      }
    );
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
      'Malicious request detected:',
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

  // If the requested path is "/manifest.json", return manifest json with header content-type for a json file
  if (requestedPath.endsWith('/manifest.json')) {
    reply.type('application/json').send(
      JSON.stringify(
        {
          "name": "Chat",
          "short_name": "Chat",
          "start_url": `${request.protocol}://${request.hostname}${request.originalUrl.replace('manifest.json', '')}`,
          "display": "standalone",
          "orientation": "portrait",
          "theme_color": "black",
        }
      )
    );
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
server.listen({port: PORT, host: HOST}, (error, address) => {
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

