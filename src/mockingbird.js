var Bluebird = require('bluebird');

module.exports = function(callback) {
  return (callback && typeof callback === 'function') ? function(f) {
    f(function(res) {
        callback(null, res);
      },
      function(err) {
        callback(err);
      }
    );
  } : Bluebird;
};
