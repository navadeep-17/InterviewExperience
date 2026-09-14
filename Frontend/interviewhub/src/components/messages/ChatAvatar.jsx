const ChatAvatar = ({ user, size = 32 }) => (
  user?.avatar ? (
    <img
      src={user.avatar}
      alt={user.name}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full bg-blue-200 flex items-center justify-center font-bold text-blue-800"
      style={{ width: size, height: size }}
    >
      {user?.name?.charAt(0) || "?"}
    </div>
  )
);

export default ChatAvatar;
