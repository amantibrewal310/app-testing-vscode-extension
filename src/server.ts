import express from "express";
import WebSocket, { WebSocketServer } from "ws";
import { spawn, ChildProcess } from "child_process";

const app = express();
const PORT = 8080;

app.use(express.json());

const wss = new WebSocketServer({ port: PORT });

let clientSocket: WebSocket | null = null;
let scrcpyProcess: ChildProcess | null = null;

wss.on("connection", (ws: WebSocket) => {
  console.log("New WebRTC connection established");

  clientSocket = ws;

  ws.on("message", (message: string) => {
    const data = JSON.parse(message);

    if (data.type === "offer") {
      console.log("Received WebRTC Offer");
      ws.send(JSON.stringify({ type: "answer", sdp: data.sdp }));
    }
  });

  ws.on("close", () => {
    console.log("WebRTC connection closed");
    clientSocket = null;
  });
});

app.post("/offer", (req, res) => {
  console.log("Received WebRTC Offer from Client");
  if (clientSocket) {
    clientSocket.send(JSON.stringify({ type: "offer", sdp: req.body.sdp }));
  }
  res.send({ status: "Offer sent to WebRTC client" });
});

app.post("/answer", (req, res) => {
  console.log("Received WebRTC Answer from Client");
  if (clientSocket) {
    clientSocket.send(JSON.stringify({ type: "answer", sdp: req.body.sdp }));
  }
  res.send({ status: "Answer sent to WebRTC client" });
});

// Start WebRTC Signaling Server
app.listen(PORT, () => {
  console.log(`WebRTC signaling server running at http://localhost:${PORT}`);
  startScrcpyStream();
});

function startScrcpyStream() {
  console.log("Starting scrcpy stream...");

  scrcpyProcess = spawn("scrcpy", [
    "--tcpip=127.0.0.1:5555",
    "--video-codec=h264",
    "--output-to=udp://127.0.0.1:5000",
    "--no-audio",
    "--no-control",
  ]);

  if (scrcpyProcess.stdout) {
    scrcpyProcess.stdout.on("data", (data) => console.log(data.toString()));
  }

  if (scrcpyProcess.stderr) {
    scrcpyProcess.stderr.on("data", (data) => console.error(data.toString()));
  }

  scrcpyProcess.on("exit", (code) => {
    console.log(`scrcpy exited with code ${code}`);
    scrcpyProcess = null;
  });
}
