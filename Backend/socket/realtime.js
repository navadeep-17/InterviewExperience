const { authenticateToken, AuthenticationError } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Message = require('../models/Message');
const Group = require('../models/Group');
const GroupMessage = require('../models/GroupMessage');

const userRoom = id => 'user:' + id;
const groupRoom = id => 'group:' + id;
const validId = id => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
const validContent = content => typeof content === 'string' && content.trim().length > 0;

class RealtimeError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function configureRealtime(io) {
  io.use(async (socket, next) => {
    try {
      socket.user = Object.freeze(await authenticateToken(socket.handshake.auth?.token));
      const groups = await Group.find({ members: socket.user._id }).select('_id');
      socket.data.groupRooms = groups.map(group => groupRoom(group._id.toString()));
    } catch (error) {
      const rejection = new Error('Unable to connect to realtime messaging');
      rejection.data = { code: error instanceof AuthenticationError ? error.code : 'SERVER_ERROR' };
      return next(rejection);
    }
    next();
  });

  io.on('connection', socket => {
    // Register listeners immediately; events wait for room setup to finish.
    const ready = (async () => {
      await socket.join([userRoom(socket.user._id), ...socket.data.groupRooms]);
      return true;
    })().catch(() => {
      socket.emit('realtime_error', { code: 'SERVER_ERROR', message: 'Unable to initialize messaging' });
      socket.disconnect(true);
      return false;
    });

    const onEvent = (event, handler) => {
      socket.on(event, async (payload, acknowledge) => {
        try {
          if (!await ready || !socket.connected) return;
          await handler(payload);
          if (typeof acknowledge === 'function') acknowledge({ ok: true });
        } catch (error) {
          const failure = {
            ok: false,
            code: error instanceof RealtimeError ? error.code : 'SERVER_ERROR',
            message: error instanceof RealtimeError ? error.message : 'Unable to process realtime event',
          };
          if (typeof acknowledge === 'function') acknowledge(failure);
          else socket.emit('realtime_error', failure);
        }
      });
    };

    onEvent('send_message', async payload => {
      if (!validId(payload?.recipientId) || !validContent(payload?.content)) {
        throw new RealtimeError('INVALID_PAYLOAD', 'A recipient and non-empty message are required');
      }
      const recipientId = payload.recipientId.toLowerCase();
      const message = await Message.create({
        senderId: socket.user._id,
        recipientId,
        content: payload.content,
      });
      // A room union delivers once per socket, including self-messages.
      io.to([userRoom(socket.user._id), userRoom(recipientId)]).emit('receive_message', message);
    });

    onEvent('send_group_message', async payload => {
      if (!validId(payload?.groupId) || !validContent(payload?.content)) {
        throw new RealtimeError('INVALID_PAYLOAD', 'A group and non-empty message are required');
      }
      const groupId = payload.groupId.toLowerCase();
      const group = await Group.findOne({ _id: groupId, members: socket.user._id }).select('_id');
      if (!group) throw new RealtimeError('FORBIDDEN', 'Current group membership is required');
      const sender = await User.findById(socket.user._id).select('name avatar');
      if (!sender) throw new RealtimeError('FORBIDDEN', 'Sender account is unavailable');
      const message = await GroupMessage.create({
        groupId,
        senderId: socket.user._id,
        content: payload.content,
      });
      io.to(groupRoom(groupId)).emit('receive_group_message', {
        ...message.toObject(),
        sender: { name: sender.name, avatar: sender.avatar },
        senderName: sender.name,
        senderAvatar: sender.avatar || '',
      });
    });

    onEvent('typing', payload => {
      if (!validId(payload?.to)) {
        throw new RealtimeError('INVALID_PAYLOAD', 'A valid typing recipient is required');
      }
      io.to(userRoom(payload.to.toLowerCase())).emit('typing', { from: socket.user._id });
    });
  });
}

module.exports = { configureRealtime };
