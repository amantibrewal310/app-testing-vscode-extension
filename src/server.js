"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var ws_1 = require("ws");
var child_process_1 = require("child_process");
var app = (0, express_1.default)();
var PORT = 8080;
app.use(express_1.default.json());
var wss = new ws_1.WebSocketServer({ port: PORT });
var clientSocket = null;
var scrcpyProcess = null;
wss.on("connection", function (ws) {
    console.log("New WebRTC connection established");
    clientSocket = ws;
    ws.on("message", function (message) {
        var data = JSON.parse(message);
        if (data.type === "offer") {
            console.log("Received WebRTC Offer");
            ws.send(JSON.stringify({ type: "answer", sdp: data.sdp }));
        }
    });
    ws.on("close", function () {
        console.log("WebRTC connection closed");
        clientSocket = null;
    });
});
app.post("/offer", function (req, res) {
    console.log("Received WebRTC Offer from Client");
    if (clientSocket) {
        clientSocket.send(JSON.stringify({ type: "offer", sdp: req.body.sdp }));
    }
    res.send({ status: "Offer sent to WebRTC client" });
});
app.post("/answer", function (req, res) {
    console.log("Received WebRTC Answer from Client");
    if (clientSocket) {
        clientSocket.send(JSON.stringify({ type: "answer", sdp: req.body.sdp }));
    }
    res.send({ status: "Answer sent to WebRTC client" });
});
// Start WebRTC Signaling Server
app.listen(PORT, function () {
    console.log("WebRTC signaling server running at http://localhost:".concat(PORT));
    startScrcpyStream();
});
function startScrcpyStream() {
    console.log("Starting scrcpy stream...");
    scrcpyProcess = (0, child_process_1.spawn)("scrcpy", [
        "--tcpip=127.0.0.1:5555",
        "--video-codec=h264",
        "--output-to=udp://127.0.0.1:5000",
        "--no-audio",
        "--no-control",
    ]);
    if (scrcpyProcess.stdout) {
        scrcpyProcess.stdout.on("data", function (data) { return console.log(data.toString()); });
    }
    if (scrcpyProcess.stderr) {
        scrcpyProcess.stderr.on("data", function (data) { return console.error(data.toString()); });
    }
    scrcpyProcess.on("exit", function (code) {
        console.log("scrcpy exited with code ".concat(code));
        scrcpyProcess = null;
    });
}
