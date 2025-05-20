const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  graduationYear: String,
  department: String,
  rollNumber: String,
  currentlyStudying: String,
  phoneNumber: String,
  avatar: String,
  isVerified: { type: Boolean, default: false },
  otp: { type: String },
  otpExpiry: { type: Date },
});

// Pre-save hook to hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare entered password with the hashed password in the DB
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password); // Compare the password
};

UserSchema.methods.updatePassword = async function (newPassword) {
  this.password = newPassword; // Let pre-save hook hash it
  this.otp = undefined;
  this.otpExpiry = undefined;
  await this.save();
};

module.exports = mongoose.model("User", UserSchema);

