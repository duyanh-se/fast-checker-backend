import { ConnectedSocket, OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:3001' } })
export class GameGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  handleConnection(@ConnectedSocket() socket: Socket) {
    const sessionId = socket.handshake.auth.sessionId;
    if (typeof sessionId === 'string') socket.join(`session:${sessionId}`);
  }
  broadcastLeaderboard(sessionId: string, leaderboard: unknown) {
    this.server.to(`session:${sessionId}`).emit('leaderboard.updated', leaderboard);
  }
  broadcastSession(sessionId: string, session: unknown) {
    this.server.to(`session:${sessionId}`).emit('session.updated', session);
  }
  broadcastPlayers(sessionId: string) {
    this.server.to(`session:${sessionId}`).emit('players.updated');
  }
}
