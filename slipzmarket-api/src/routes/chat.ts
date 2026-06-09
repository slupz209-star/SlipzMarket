import { Router, Response } from 'express';
import { ChatEngineService } from '../services/chat.service';
import { CoreService } from '../services/core.services'; // 👈 Added CoreService
import prisma from '../db.js';
import { SocketService } from '../services/socket.service';
import { requireAuth, requireAdmin } from './middleware/auth.middleware';

const router = Router();

// ==========================================
// USER ENDPOINT: Send Message
// ==========================================
router.post('/message', requireAuth, CoreService.catchAsync(async (req: any, res: Response) => {
  const userId = req.user.userId || req.user.id;
  const workspaceId = req.user.workspaceId;
  const { text } = req.body;

  if (!text) return CoreService.error(res, 400, 'Message text is required');

  const result = await ChatEngineService.handleIncomingMessage(userId, workspaceId, text);
  
  return CoreService.success(res, 200, 'Message processed', {
    sessionId: result.session.id,
    currentStatus: result.session.status,
    botResponse: result.botResponse, 
    escalatedToHuman: result.escalated
  });
}));

// ==========================================
// ADMIN ENDPOINT: Reply to User
// ==========================================
router.post('/admin/reply', requireAuth, requireAdmin, CoreService.catchAsync(async (req: any, res: Response) => {
  const { sessionId, text } = req.body;
  const adminId = req.user.userId || req.user.id;

  if (!sessionId || !text) {
    return CoreService.error(res, 400, 'Session ID and reply text are required');
  }

  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: { user: true }
  });

  if (!session) return CoreService.error(res, 404, 'Session not found');

  // 1. Persist the message
  const message = await prisma.chatMessage.create({
    data: {
      sessionId,
      senderId: adminId,
      senderRole: 'AGENT',
      text
    }
  });

  // 2. Update session status
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { status: 'AGENT_HANDLING', updatedAt: new Date() }
  });

  const payload = {
    id: message.id,
    senderRole: 'AGENT',
    text: message.text,
    createdAt: message.createdAt
  };

  // 3. Socket Emissions
  SocketService.notifyUser(sessionId, 'agent_reply', payload);
  if (session.userId) {
    SocketService.emitToUser(session.userId, 'agent_reply', payload);
  }

  return CoreService.success(res, 200, 'Reply sent', { message });
}));

// ==========================================
// ADMIN ENDPOINT: Fetch Sessions (WITH LIMITS)
// ==========================================
router.get('/admin/sessions', requireAuth, requireAdmin, CoreService.catchAsync(async (req: any, res: Response) => {
  const limit = Number(req.query.limit) || 50; // 👈 Safety default

  const sessions = await prisma.chatSession.findMany({
    where: { status: { in: ['AWAITING_AGENT', 'AGENT_HANDLING'] } },
    include: { 
      user: { select: { email: true, firstName: true } } 
    },
    orderBy: { updatedAt: 'desc' },
    take: limit 
  });
  
  return CoreService.success(res, 200, 'Sessions retrieved', sessions);
}));

// ==========================================
// ADMIN ENDPOINT: Fetch Specific Session Messages
// ==========================================
router.get('/admin/sessions/:sessionId', requireAuth, requireAdmin, CoreService.catchAsync(async (req: any, res: Response) => {
  const { sessionId } = req.params;
  
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    take: 500 // 👈 Safety limit to prevent memory bloat on massive chats
  });
  
  return CoreService.success(res, 200, 'Messages retrieved', { messages });
}));

// ==========================================
// ADMIN ENDPOINT: Update Status
// ==========================================
router.patch('/admin/sessions/:sessionId/status', requireAuth, requireAdmin, CoreService.catchAsync(async (req: any, res: Response) => {
  const { sessionId } = req.params;
  const { status } = req.body;
  const allowedStatuses = ['CLOSED', 'AGENT_HANDLING', 'AWAITING_AGENT'];

  if (!allowedStatuses.includes(status)) {
    return CoreService.error(res, 400, 'Invalid session status');
  }

  const session = await prisma.chatSession.update({
    where: { id: sessionId },
    data: { status }
  });

  SocketService.notifyAdmins('session_updated', session);
  if (status === 'CLOSED') {
    SocketService.notifyUser(sessionId, 'session_closed', { sessionId });
  }

  return CoreService.success(res, 200, 'Status updated', { session });
}));

// ==========================================
// ADMIN ENDPOINT: Resolve Session
// ==========================================
router.patch('/admin/sessions/:sessionId/resolve', requireAuth, requireAdmin, CoreService.catchAsync(async (req: any, res: Response) => {
  const { sessionId } = req.params;
  
  const session = await prisma.chatSession.update({
    where: { id: sessionId },
    data: { status: 'CLOSED' }
  });

  SocketService.notifyAdmins('session_updated', session);
  SocketService.notifyUser(sessionId, 'session_closed', { sessionId });

  return CoreService.success(res, 200, 'Session resolved', { session });
}));

// ==========================================
// ADMIN ENDPOINT: Internal Notes
// ==========================================
router.patch('/admin/sessions/:sessionId/internal-notes', requireAuth, requireAdmin, CoreService.catchAsync(async (req: any, res: Response) => {
  const { sessionId } = req.params;
  const { internalNotes } = req.body;

  const session = await prisma.chatSession.update({
    where: { id: sessionId },
    data: { internalNotes }
  });

  return CoreService.success(res, 200, 'Notes saved', { session });
}));

// ==========================================
// USER ENDPOINT: Fetch History
// ==========================================
router.get('/history', requireAuth, CoreService.catchAsync(async (req: any, res: Response) => {
  const userId = req.user.userId || req.user.id;
  
  const session = await prisma.chatSession.findFirst({
    where: { userId, status: { not: 'CLOSED' } },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 100 } }
  });

  return CoreService.success(res, 200, 'History retrieved', {
    messages: session ? session.messages : [],
    sessionId: session?.id || null,
    status: session?.status || null
  });
}));

// ==========================================
// ADMIN ENDPOINT: Star Message
// ==========================================
router.patch('/admin/messages/:id/star', requireAuth, requireAdmin, CoreService.catchAsync(async (req: any, res: Response) => {
  const { isStarred } = req.body;
  
  await prisma.chatMessage.update({
    where: { id: req.params.id },
    data: { isStarred }
  });
  
  return CoreService.success(res, 200, 'Message star status updated');
}));

// ==========================================
// ADMIN ENDPOINT: Delete Message
// ==========================================
router.delete('/admin/messages/:id', requireAuth, requireAdmin, CoreService.catchAsync(async (req: any, res: Response) => {
  await prisma.chatMessage.delete({
    where: { id: req.params.id }
  });
  
  return CoreService.success(res, 200, 'Message deleted');
}));

export default router;