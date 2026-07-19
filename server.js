const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// roomId -> Set of socket ids
const rooms = new Map();

io.on("connection", (socket) => {
  let currentRoom = null;

  socket.on("join", (roomId) => {
    currentRoom = roomId;
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    const room = rooms.get(roomId);

    if (room.size >= 2) {
      socket.emit("room-full");
      return;
    }

    room.add(socket.id);
    socket.join(roomId);

    const others = [...room].filter((id) => id !== socket.id);
    socket.emit("joined", { self: socket.id });
    others.forEach((id) => io.to(id).emit("peer-joined", { peerId: socket.id }));
  });

  socket.on("signal", ({ to, data }) => {
    io.to(to).emit("signal", { from: socket.id, data });
  });

  socket.on("hangup", () => {
    if (currentRoom) socket.to(currentRoom).emit("peer-left");
  });

  socket.on("disconnect", () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(socket.id);
      socket.to(currentRoom).emit("peer-left");
      if (rooms.get(currentRoom).size === 0) rooms.delete(currentRoom);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`AIR call server running on port ${PORT}`));
