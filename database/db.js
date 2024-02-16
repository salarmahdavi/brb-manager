const mongoose = require('mongoose');
const User = require('./User');
const Config = require('./Config');

const db_uri = process.env.DB_URI ?? "mongodb://localhost:27017";
const db_name = process.env.DB_NAME ?? "rest-manager";

mongoose.connect(db_uri + '/' + db_name)
  .then(async () => {
    const collections = await mongoose.connection.db.listCollections().toArray();

    const usersCollectionExists = collections.some(col => col.name === 'users');
    const configCollectionExists = collections.some(col => col.name === 'configs');

     if (!usersCollectionExists) {
      await User.createCollection();

      const user = await User.create({ type: "admin", username: "admin", password: "admin", name: "admin" });
      await user.save();

      console.log("Users collection created");
    }

    if (!configCollectionExists) {
      await Config.createCollection();
      
      const brbLimit = await Config.create({ name: 'brbLimit', value: { max: 2 } });
      await brbLimit.save();

      console.log("Configs collection created");
    }

    console.info("Connected to database successfully!");
  })
  .catch(e => console.error(`[ERR] Could not coonect to database: ${e}`));
