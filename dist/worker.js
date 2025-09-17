class WorkerInstance {
  ws;
  uid;
  nickname;
  roomId;
  clients;
}

const workerInstance = new WorkerInstance();

// biome-ignore lint/suspicious/noGlobalAssign: <explanation>
onmessage = (event) => {
  if (Object.hasOwn(event.data, 'request')) {
    const { request } = event.data;

    if (request === 'connect') {
      const { host, roomId, roomPassword, nickname } = event.data;

      ws = new WebSocket(`ws://${host}/chat/${roomId}`);

      // console.log('ws', ws);

      ws.onerror = console.error;

      ws.onopen = function open() {
        ws.send(
          JSON.stringify(
            {
              request: 'connect',
              data: {
                roomPassword,
                nickname,
              },
            },
          ),
        );
      };

      ws.onmessage = function message({data: socketData}) {
        const {
          response,
          request,
          broadcast,
          data,
        } = JSON.parse(socketData);

        if (response && response === 'connected') {
          const { uid } = data;

          workerInstance.ws = ws;
          workerInstance.uid = uid;
          workerInstance.nickname = nickname;
          workerInstance.roomId = roomId;
          workerInstance.clients = data.clients;

          postMessage({
            response,
            data: {
              uid,
              roomId,
              clients: data.clients,
            },
          });

          return;
        }

        if (request && request === 'ping') {
          ws.send(
            JSON.stringify(
              {
                request: 'pong',
                data: {
                  uid: workerInstance.uid,
                },
              },
            ),
          );

          postMessage({
            request,
            data,
          });

          return;
        }

        if (broadcast && broadcast === 'message') {
          postMessage({
            broadcast,
            data: {
              ...data,
              uid: workerInstance.uid,
            },
          });

          return;
        }

        if (broadcast && broadcast === 'typing') {
          postMessage({
            broadcast,
            data: {
              ...data,
              uid: workerInstance.uid,
            },
          });

          return;
        }

        if (broadcast && broadcast === 'chatLog') {
          postMessage({
            broadcast,
            data: {
              ...data,
              uid: workerInstance.uid,
            },
          });

          return;
        }
      };

      ws.onclose = function close() {
        console.log('Disconnected.');

        postMessage({status: 'disconnected'});
      };

      return;
    }

    if (request === 'message') {
      const { data } = event.data;

      ws.send(
        JSON.stringify(
          {
            request: 'message',
            data: {
              ...data,
              uid: workerInstance.uid,
            },
          },
        ),
      );

      return;
    }

    if (request === 'typing') {
      ws.send(
        JSON.stringify(
          {
            request: 'typing',
            data: {
              uid: workerInstance.uid,
            },
          },
        ),
      );

      return;
    }
  }
};
