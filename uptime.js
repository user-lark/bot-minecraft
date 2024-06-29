const express = require('express');
const http = require('http');
const app = express();

app.get("/", (_, res) => res.sendFile(__dirname + "/index.html"));
app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
});

// Uptime endpoint
app.get("/uptime", (_, res) => {
  res.sendStatus(200);
});

// Ping the uptime endpoint to keep the bot awake
setInterval(() => {
  http.get(`http://localhost:${process.env.PORT || 3000}/uptime`);
}, 224000); // Ping every 224 seconds to keep alive

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.write("Copy this link and add it to your Uptime system!");
  res.end();
}).listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
