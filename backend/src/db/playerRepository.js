const { connect } = require('./repository');
const bcrypt = require('bcrypt');


async function setupPlayerCollection() {
  const db = await connect();
  
  try {
    const collections = await db.listCollections({ name: 'players' }).toArray();
    
    const validator = {
      $jsonSchema: {
        bsonType: 'object',
        required: ['id', 'name', 'email', 'password', 'createdAt', 'status'],
        properties: {
          id: { bsonType: 'string', description: 'must be a string and is required' },
          name: { bsonType: 'string', description: 'must be a string and is required' },
          email: { 
            bsonType: 'string', 
            pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
            description: 'must be a valid email string and is required' 
          },
          password: { bsonType: 'string', description: 'must be a string (hashed) and is required' },
          createdAt: { bsonType: 'date', description: 'must be a date and is required' },
          status: { enum: ['active', 'inactive', 'pending'], description: 'must be active, inactive or pending' }
        }
      }
    };

    if (collections.length === 0) {
      await db.createCollection('players', { validator });
    } else {
      await db.command({ collMod: 'players', validator });
    }
    
    await db.collection('players').createIndex({ email: 1 }, { unique: true });
    console.log(' Player collection schema and indexes configured');
  } catch (err) {
    console.error(' Error setting up player collection:', err);
  }
}

async function createPlayer(playerData) {
  const db = await connect();
  const { id, name, email, password } = playerData;
  
  const result = await db.collection('players').insertOne({
    id,
    name,
    email,
    password,
    createdAt: new Date(),
    status: 'active'
  });
  
  return result;
}

async function getPlayerByEmail(email) {
  const db = await connect();
  return db.collection('players').findOne({ email });
}

module.exports = { setupPlayerCollection, createPlayer, getPlayerByEmail };
