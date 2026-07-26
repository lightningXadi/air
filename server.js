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
const MAX_ROOM_SIZE = 6;

io.on("connection", (socket) => {
  let currentRoom = null;

  socket.on("join", ({ roomId, name } = {}) => {
    currentRoom = roomId;
    socket.data.name = (name || "").trim().slice(0, 24) || "Anonymous";
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    const room = rooms.get(roomId);

    if (room.size >= MAX_ROOM_SIZE) {
      socket.emit("room-full");
      currentRoom = null;
      return;
    }

    const others = [...room]; // existing members before adding self
    room.add(socket.id);
    socket.join(roomId);

    // Tell the newcomer who's already in the room, with their names
    const existingPeers = others.map((id) => ({
      peerId: id,
      name: io.sockets.sockets.get(id)?.data.name || "Anonymous",
    }));
    socket.emit("joined", { self: socket.id, existingPeers });

    // Tell existing members someone new joined
    others.forEach((id) =>
      io.to(id).emit("peer-joined", { peerId: socket.id, name: socket.data.name })
    );
  });

  socket.on("signal", ({ to, data }) => {
    io.to(to).emit("signal", { from: socket.id, data });
  });

  socket.on("hangup", () => {
    if (currentRoom) socket.to(currentRoom).emit("peer-left", { peerId: socket.id });
  });

  socket.on("disconnect", () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(socket.id);
      socket.to(currentRoom).emit("peer-left", { peerId: socket.id });
      if (rooms.get(currentRoom).size === 0) rooms.delete(currentRoom);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`AIR call server running on port ${PORT}`));
