/**
 * Module dependencies.
 */

var async = require('async');
var _ = require('lodash');
var parser = require('./parser');

/**
 * Create a new resource cache.
 *
 * @param {Object} options
 */

function Cache(options) {
  // Convert TTL in second.
  this.ttl = Math.ceil(options.ttl / 1000);

  // Create a redis client.
  this.redis = this._createRedisClient(options.redis);
}

/**
 * Return a resource from the cache.
 *
 * @param {String} key
 * @param {Function} callback
 */

Cache.prototype.get = function getResource(key, callback) {
  // If key is not defined, returns null.
  if (! key) return callback();

  async.waterfall([
    function getData(next) {
      this.redis.get(key, next);
    }.bind(this),
    function decodeData(data, next) {
      parser.decode(data, next);
    }
  ], callback);
};

/**
 * Return a resource from the cache.
 *
 * @param {String} key
 * @param {Object} data
 * @param {Function} callback
 */

Cache.prototype.set = function setResource(key, data, callback) {
  // If key is not defined or if TTL is falsy, do nothing.
  if (! key || ! this.ttl) {
    if (callback) callback();
    return ;
  }

  async.waterfall([
    function encodeData(next) {
      parser.encode(data, next);
    },
    function setData(data, next) {
      this.redis.multi()
      .set(key, data)
      .expire(key, this.ttl)
      .exec(function (err) {
        // If there is no callback, emit the error on the redis client.
        if (err && ! callback) this.redis.emit('error', err);
        next(err);
      }.bind(this));
    }.bind(this)
  ], callback);
};

/**
 * Delete a resource from the cache.
 *
 * @param {String} name
 * @param {Number} id
 * @param {Function} callback
 */

Cache.prototype.del = function delResource(key, callback) {
  // If key is not defined, do nothing.
  if (! key) {
    if (callback) return callback();
    return ;
  }

  this.redis.del(key, callback);
};

/**
 * Create the redis client.
 *
 * @param {Object} options
 */

Cache.prototype._createRedisClient = function _createRedisClient(options) {
  if (_.isFunction(options)) return options();

  try {
    return require('redis').createClient(options.port, options.host, _.omit(options, 'port', 'host'));
  }
  catch(err) {
    throw new Error('You must add redis as dependency.');
  }
};