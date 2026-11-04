/** Encrypts small secrets before they are written to the database (AES-256-GCM). */
const crypto = require('crypto');
const env = require('../config/env');

const key = () => crypto.createHash('sha256').update(env.encryptionKey).digest();

const encrypt = (plain) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64')).join('.');
};

const decrypt = (box) => {
  const [iv, tag, data] = String(box).split('.').map((part) => Buffer.from(part, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
};

module.exports = { encrypt, decrypt };
