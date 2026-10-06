import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    jti: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    googleId: { type: String, sparse: true },
    emailVerified: { type: Boolean, default: false },
    otpHash: String,
    otpExpires: Date,
    resetTokenHash: String,
    resetExpires: Date,
    refreshTokens: { type: [refreshTokenSchema], default: [] },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const User = mongoose.model('User', userSchema);
