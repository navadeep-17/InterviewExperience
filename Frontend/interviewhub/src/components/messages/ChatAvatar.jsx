const ChatAvatar = ({ user, size = 32 }) => (
  user?.avatar ? (
    <img
      src={user.avatar}
      alt={user.name}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="shrink-0 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700"
      style={{ width: size, height: size }}
    >
      {user?.name?.charAt(0) || "?"}
    </div>
  )
);

export default ChatAvatar;
