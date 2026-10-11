const { User } = require('../models');

const normalizeEmail = (email) => String(email).toLowerCase().trim();
// Fields with select:false that a caller may ask for explicitly
const withFields = (query, fields = []) => (fields.length ? query.select(fields.map((f) => `+${f}`).join(' ')) : query);

/** Users are the root of ownership, so this repository is not user-scoped. */
const userRepository = {
  findById: (id, fields) => withFields(User.findById(id), fields).exec(),
  findByEmail: (email, fields) => withFields(User.findOne({ email: normalizeEmail(email) }), fields).exec(),
  findByIdWithPassword: (id) => User.findById(id).select('+password +sessions').exec(),
  findByGoogleId: (googleId) => User.findOne({ googleId }).select('+sessions').exec(),
  findByResetHash: (hash) =>
    User.findOne({ 'passwordReset.hash': hash, 'passwordReset.expiresAt': { $gt: new Date() } })
      .select('+password +passwordReset +sessions')
      .exec(),
  create: (data) => User.create(data),
  findForMonthlySummary: () => User.find({ 'notifications.monthlySummary': true }).exec(),
};

module.exports = userRepository;
