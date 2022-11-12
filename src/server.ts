import { WebSocketServer } from 'ws';
import * as http from "http";
import * as url from "url";
import * as net from "net";
import { IWebSocket, WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc';
import * as server from 'vscode-ws-jsonrpc/server';
import * as lsp from "vscode-languageserver";
import cors from 'cors';
import fs from "fs";
import path from "path";
import express from "express";
import { Message } from 'vscode-languageserver';

const moduleDir = path.join('/', 'Users', 'alexandershilen', 'natlang', 'modules');

process.on('uncaughtException', function (err: any) {
  console.error('Uncaught Exception: ', err.toString());
  if (err.stack) {
    console.error(err.stack);
  }
});

export function launch(socket: IWebSocket) {
  const reader = new WebSocketMessageReader(socket);
  const writer = new WebSocketMessageWriter(socket);

  const socketConnection = server.createConnection(reader, writer, () => socket.dispose());
  console.log(process.env)
  const serverConnection = server.createServerProcess(
    'nat',
    'nls',
    ['--lsp', '--debug', `--cwd=${moduleDir.toString()}`],
    { env: process.env }
  );

  if (!serverConnection) return;

  server.forward(socketConnection, serverConnection, message => {
    const isReq = Message.isRequest(message)

    if (isReq) {
      if (message.method === lsp.InitializeRequest.type.method) {
        const initializeParams = message.params as lsp.InitializeParams;
        initializeParams.processId = process.pid;
      }
    }

    return message;
  });
}

// init/plugins
const app = express();
app.use(cors());
app.use(express.json());

// start the server
const httpServer = app.listen(3003);

// routes
app.get('/:filename', (req, res) => {
  const buffer = fs.readFileSync(path.join(moduleDir, req.params.filename));
  res.json(buffer.toString());
});
app.post('/:filename', (req, res) => {
  fs.writeFileSync(path.join(moduleDir, req.params.filename), req.body.content);
  res.send('Ok');
});

// create the web socket
const wss = new WebSocketServer({
  noServer: true,
  perMessageDeflate: false
});

httpServer.on('upgrade', (request: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
  const pathname = request.url ? url.parse(request.url).pathname : undefined;

  if (pathname === '/') {
    wss.handleUpgrade(request, socket, head, webSocket => {
      const socket: IWebSocket = {
        send: content => webSocket.send(content, error => {
          if (error) throw error;
        }),
        onMessage: cb => webSocket.on('message', cb),
        onError: cb => webSocket.on('error', cb),
        onClose: cb => webSocket.on('close', cb),
        dispose: () => webSocket.close()
      };
    
      // launch the HLS when the web socket is opened
      if (webSocket.readyState === webSocket.OPEN) launch(socket);
      else webSocket.on('open', () => launch(socket));
    });
  }
});
