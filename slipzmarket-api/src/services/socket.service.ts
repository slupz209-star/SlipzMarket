import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';

// Use a private variable to track the instance
let ioInstance: SocketIOServer | null = null;

export const SocketService = {
  // Use a getter to access the instance safely
  get io() {
    if (!ioInstance) {
      throw new Error('Socket.io is not initialized! Ensure SocketService.init(server) is called.');
    }
    return ioInstance;
  },

  init(server: HttpServer) {
    ioInstance = new SocketIOServer(server, {
      path: '/socket.io/', // Explicitly set path for Nginx proxy compatibility
      cors: {
        origin: [
          'http://localhost:3000',
          'http://localhost:5173',
          'https://slipz-market-1.onrender.com',
          'https://slipz-market-2.onrender.com',
          'https://slipzmarket.com'
        ],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'] // Ensures reliability behind proxies
    });

    // MIDDLEWARE: Validate connection
    ioInstance.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error("Unauthorized: No token provided"));
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        (socket as any).user = decoded;
        next();
      } catch (err) {
        next(new Error("Unauthorized: Invalid token"));
      }
    });

    ioInstance.on('connection', (socket) => {
      const user = (socket as any).user;
      console.log(`🔌 New client connected: ${socket.id} (User: ${user.userId})`);

      // 1. Join Global Room
      socket.join(`user_${user.userId}`);

      // 2. Admin Room
      socket.on('join_admin_room', () => {
        if (user.role === 'ADMIN') {
          socket.join('admin_room');
          console.log(`🛡️ Admin ${user.userId} joined support room`);
        }
      });

      // 3. Private Session
      socket.on('join_user_session', (sessionId: string) => {
        socket.join(`session_${sessionId}`);
      });

      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });
    });

    return ioInstance;
  },

  // Helpers now use the safe getter
  emitToUser(userId: string, eventName: string, payload: any) {
    this.io.to(`user_${userId}`).emit(eventName, payload);
  },

  notifyAdmins(eventName: string, payload: any) {
    this.io.to('admin_room').emit(eventName, payload);
  },

  notifyUser(sessionId: string, eventName: string, payload: any) {
    this.io.to(`session_${sessionId}`).emit(eventName, payload);
  },

  roomHasMembers(roomName: string): boolean {
    const room = this.io.sockets.adapter.rooms.get(roomName);
    return !!room && room.size > 0;
  }
};