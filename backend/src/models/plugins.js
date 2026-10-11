/** Shared schema options: clean JSON output (id instead of _id, no __v). */
const toJSON = {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.password;
    delete ret.sessions;
    delete ret.otp;
    delete ret.passwordReset;
    delete ret.googleId;
    return ret;
  },
};

const baseOptions = { timestamps: true, toJSON, toObject: { virtuals: true } };

module.exports = { baseOptions };
