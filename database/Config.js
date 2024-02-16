const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: String,
    required: true,
    get: function(value) {
      try {
        return JSON.parse(value);
      } catch (error) {
        return value;
      }
    },
    set: function(value) {
      return JSON.stringify(value);
    }
  }
});

const Config = mongoose.model('Config', configSchema);

module.exports = Config;
