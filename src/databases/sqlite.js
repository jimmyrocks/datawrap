var Bluebird = require('bluebird');
Bluebird.longStackTraces();
var sqlite = require('sqlite3');
var runList = require('../runList');
var dbOpen = false;
var databases = {};
var connection = function (name, connection) {
  var connectionDb = (dbOpen && name && databases[name]) ? databases[name] : new sqlite.Database(connection);
  databases[name] = connectionDb;
  dbOpen = true;
  return {
    all: function(query, callback) {
      return connectionDb.all(query, callback);
    },
    close: function(force) {
      if (!name || force) {
        connectionDb.close();
      } else {
        return;
      }
    }
  };
};

module.exports = function (config) {
  return {
    runQueryList: function (sql, params) {
      return new Bluebird(function (resolve, reject) {
        var db = connection(config.name, config.connection || ':memory:');
        if (sql[0] === 'close') {
          db.close(true);
          resolve(true);
          return;
        };
        if (!Array.isArray(sql)) {
          sql = [sql];
        }

        var runQuery = function (query, params) {
          return new Bluebird(function (queryResolve, queryReject) {
            // params = params || {};
            db.all(query, function (err, rows) {
              if (err) {
                queryReject(err);
              } else {
                queryResolve(rows);
              }
            });
          });
        };

        var taskList = [];
        sql.map(function (query) {
          taskList.push({
            'name': 'Query: ' + query,
            'task': runQuery,
            'params': [query, params]
          });
        });

        runList(taskList, 'sqlite map')
          .then(function (r) {
            db.close();
            resolve(r);
          })
          .catch(function (e) {
            db.close();
            reject(e);
          });
      });
    }
  };
};
