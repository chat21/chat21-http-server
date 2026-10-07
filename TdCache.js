const redis = require('redis');

// KEYS[1] key, ARGV[1] value, ARGV[2] updatedOn of the value, ARGV[3] optional expiry in seconds
const SET_IF_NOT_OLDER_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if current then
  local ok, cached = pcall(cjson.decode, current)
  if ok and type(cached) == 'table' then
    local cached_version = tonumber(cached['updatedOn'])
    if cached_version and cached_version > tonumber(ARGV[2]) then
      return 0
    end
  end
end
if ARGV[3] then
  redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3])
else
  redis.call('SET', KEYS[1], ARGV[1])
end
return 1
`;

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
            /**
             * Connect redis client
             */
            this.client = redis.createClient(
              {
                  url: `redis://${this.redis_host}:${this.redis_port}`,
                  password: this.redis_password
              });
            this.client.on('error', err => {
                reject(err);
                if (callback) {
                    callback(err);
                }
            });
            this.client.on('ready',function() {
                resolve();
                if (callback) {
                    callback();
                }
            });
            await this.client.connect();
        });
    }

    async set(key, value, options) {
      //console.log("setting key value", key, value)
      if (!options) {
        options = {EX: 86400}
      }
      await this.client.set(
        key,
        value,
        options);
    }

    // Atomically sets a JSON value unless the cached one has a greater updatedOn.
    // Returns true if the value was written, false if a newer value was already cached.
    async setIfNotOlder(key, value, updatedOn, options) {
      if (!options) {
        options = {EX: 86400}
      }
      const args = [value, String(updatedOn)];
      if (options.EX) {
        args.push(String(options.EX));
      }
      const written = await this.client.eval(SET_IF_NOT_OLDER_SCRIPT, { keys: [key], arguments: args });
      return written === 1;
    }

    async hset(dict_key, key, value, options) {
      if (!value) {
        return;
      }
      if (!options) {
        options = {EX: 86400}
      }
      await this.client.HSET(
        dict_key,
        key,
        value,
        options);
    }
    
    async setJSON(key, value, options) {
      if (!value) {
        return;
      }
      if (!options) {
        options = {EX: 86400}
      }
      const _string = JSON.stringify(value);
      return await this.set(key, _string, options);
    }
    
    async get(key) {
      const value = await this.client.GET(key);
      return value;
    }

    async hgetall(dict_key) {
      const all = await this.client.HGETALL(dict_key);
      return all;
    }
    
    async hget(dict_key, key) {
      // console.log("hgetting dics", dict_key);
      const value = await this.client.HGET(dict_key, key);
      return value;
    }
    
    async getJSON(key, callback) {
      const value = await this.get(key);
      return JSON.parse(value);
    }
    
    async del(key) {
        await this.client.del(key);
    }
}

module.exports = { TdCache };