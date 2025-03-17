const redis = require('redis');

class TdCache {

    constructor(config) {
        this.redis_host = config.host;
        this.redis_port = config.port;
        this.redis_password = config.password;
        this.client = null;
    }

    async connect(callback) {
        // client = redis.createClient();
        return new Promise( async (resolve, reject) => {
            this.client = redis.createClient(
                {
                    host: this.redis_host,
                    port: this.redis_port,
                    password: this.redis_password
                });
            this.client.on('error', err => {
                console.error('Redis connection error', err);
                reject(err);
                if (callback) {
                    callback(err);
                }
            });
            // this.client.on('connect', function() {
            //     console.log('Redis Connected!');
            // });
            this.client.on('ready',function() {
                resolve();
                if (callback) {
                    callback();
                }
            });
        });
    }

    async set(key, value, options) {
      return new Promise( async (resolve, reject) => {
        if (options && options.EX) {
          try {
            await this.client.set(
              key,
              value,
              'EX', options.EX);
          }
          catch(error) {
            reject(error)
          }
        }
        else {
          try {
            //console.log("setting here...key", key, value)
            await this.client.set(
              key,
              value);
          }
          catch(error) {
            console.error("Error", error);
            reject(error)
          }
        }
        if (options && options.callback) {
            options.callback();
        }
        //console.log("resolving...", key);
        return resolve();
      });
    }

    async hset(dict_key, key, value, options) {
      //console.log("hsetting dict_key key value", dict_key, key, value)
      return new Promise( async (resolve, reject) => {
        if (options && options.EX) {
          //console.log("expires:", options.EX)
          try {
            await this.client.hset(
              dict_key,
              key,
              value,
              'EX', options.EX);
          }
          catch(error) {
            reject(error)
          }
        }
        else {
          try {
            //console.log("setting here...key", key, value)
            await this.client.hset(
              dict_key,
              key,
              value);
          }
          catch(error) {
            console.error("Error", error);
            reject(error)
          }
        }
        if (options && options.callback) {
            options.callback();
        }
        return resolve();
      });
    }
    
    async setJSON(key, value, options) {
      const _string = JSON.stringify(value);
      return await this.set(key, _string, options);
    }
    
    async get(key, callback) {
      console.log("getting key:", key)
      return new Promise( async (resolve, reject) => {
        this.client.get(key, (err, value) => {
          console.log("Got something with redis", key, value, err);
          if (err) {
            console.error("Error on redis get()", err);
            reject(err);
          }
          else {
            if (callback) {
              callback(value);
          }
          return resolve(value);
          }
        });
      });
    }

    async hgetall(dict_key, callback) {
      //console.log("hgetting dics", dict_key);
      return new Promise( async (resolve, reject) => {
        this.client.hgetall(dict_key, (err, value) => {
          if (err) {
            reject(err);
            if (callback) {
              callback(err, null);
            }
          }
          else {
            if (callback) {
              callback(null, value);
            }
            resolve(value);
          }
        });
      });
    }
    
    async getJSON(key, callback) {
      const value = await this.get(key);
      return JSON.parse(value);
    }
    
    async del(key, callback) {
      return new Promise( async (resolve, reject) => {
        await this.client.del(key);
        if (callback) {
            callback();
        }
        return resolve();
      })
    }
}

module.exports = { TdCache };