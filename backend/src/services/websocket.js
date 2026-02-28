import { Server } from 'socket.io';
import { supabase } from './supabase.js';

let io;

/**
 * Setup WebSocket server
 */
export const setupWebSocket = (httpServer) => {
  const rawOrigins = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '';
  const wsOrigins = rawOrigins
    .split(',')
    .map(o => o.trim())
    .filter(o => o && o !== '*');

  if (wsOrigins.length === 0) {
    wsOrigins.push('http://localhost:3000', 'http://localhost:19006');
  }

  io = new Server(httpServer, {
    cors: {
      origin: wsOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware for WebSocket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify token with Supabase
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return next(new Error('Invalid authentication token'));
      }

      // Attach user to socket
      socket.userId = user.id;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`WebSocket client connected: ${socket.id} (User: ${socket.userId})`);

    // Join user-specific room
    socket.join(`user:${socket.userId}`);

    // Subscribe to lock updates
    socket.on('subscribe:lock', async (lockId) => {
      try {
        // Verify user has access to this lock
        const { data: access } = await supabase
          .from('user_locks')
          .select('id')
          .eq('user_id', socket.userId)
          .eq('lock_id', lockId)
          .eq('is_active', true)
          .single();

        if (access) {
          socket.join(`lock:${lockId}`);
          socket.emit('subscribed', { lockId, message: 'Successfully subscribed to lock updates' });
          console.log(`User ${socket.userId} subscribed to lock ${lockId}`);
        } else {
          socket.emit('error', { message: 'Access denied to this lock' });
        }
      } catch (error) {
        socket.emit('error', { message: 'Subscription failed' });
      }
    });

    // Unsubscribe from lock updates
    socket.on('unsubscribe:lock', (lockId) => {
      socket.leave(`lock:${lockId}`);
      socket.emit('unsubscribed', { lockId, message: 'Successfully unsubscribed from lock updates' });
      console.log(`User ${socket.userId} unsubscribed from lock ${lockId}`);
    });

    // Get lock status
    socket.on('lock:status', async (lockId) => {
      try {
        // Verify access
        const { data: access } = await supabase
          .from('user_locks')
          .select('id')
          .eq('user_id', socket.userId)
          .eq('lock_id', lockId)
          .eq('is_active', true)
          .single();

        if (!access) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Get lock status
        const { data: lock } = await supabase
          .from('locks')
          .select('id, is_locked, is_online, battery_level')
          .eq('id', lockId)
          .single();

        if (lock) {
          socket.emit('lock:status', lock);
        }
      } catch (error) {
        socket.emit('error', { message: 'Failed to fetch lock status' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`WebSocket client disconnected: ${socket.id}`);
    });
  });

  // Setup Supabase Realtime subscriptions
  setupRealtimeSubscriptions();

  console.log('✅ WebSocket server initialized');
};

/**
 * Setup Supabase Realtime subscriptions
 */
const setupRealtimeSubscriptions = () => {
  // Subscribe to lock state changes
  supabase
    .channel('locks_changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'locks'
      },
      (payload) => {
        const lock = payload.new;
        // Broadcast to all users subscribed to this lock
        io.to(`lock:${lock.id}`).emit('lock:updated', {
          lock_id: lock.id,
          is_locked: lock.is_locked,
          is_online: lock.is_online,
          battery_level: lock.battery_level,
          timestamp: new Date().toISOString()
        });
      }
    )
    .subscribe();

  // Subscribe to activity log changes
  supabase
    .channel('activity_logs_changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_logs'
      },
      async (payload) => {
        try {
          const log = payload.new;

          // Get user details
          const { data: user } = await supabase
            .from('users')
            .select('first_name, last_name, avatar_url')
            .eq('id', log.user_id)
            .single();

          // Broadcast to all users subscribed to this lock
          io.to(`lock:${log.lock_id}`).emit('activity:new', {
            id: log.id,
            lock_id: log.lock_id,
            action: log.action,
            access_method: log.access_method,
            timestamp: log.timestamp,
            user: user || null
          });
        } catch (error) {
          console.error('[WebSocket] Realtime callback error:', error.message);
        }
      }
    )
    .subscribe();

  // Subscribe to notification changes
  supabase
    .channel('notifications_changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications'
      },
      (payload) => {
        const notification = payload.new;
        // Send to specific user
        io.to(`user:${notification.user_id}`).emit('notification:new', {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          created_at: notification.created_at
        });
      }
    )
    .subscribe();

  console.log('✅ Supabase Realtime subscriptions initialized');
};

/**
 * Emit event to specific lock subscribers
 */
export const emitToLock = (lockId, event, data) => {
  if (io) {
    io.to(`lock:${lockId}`).emit(event, data);
  }
};

/**
 * Emit event to specific user
 */
export const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

/**
 * Broadcast event to all connected clients
 */
export const broadcast = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

export default io;
