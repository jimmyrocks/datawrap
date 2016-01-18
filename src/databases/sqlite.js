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
    all: function (options) {
      return connectionDb.all.apply(connectionDb, options);
    },
    close: function (force) {
      if (!name || force) {
        connectionDb.close();
      } else {
        return;
      }
    }
  };
};

module.exports = function (config) {
  var plugin = {
    readParams: function (rawQuery, objParams) {
      // Creates a parameterized query for sqlite3
      var re = function (name) {
        return new RegExp('{{' + name + '}}', 'g');
      };
      var r = {
        newQuery: rawQuery.replace(re('.+?'), '?'),
        params: (rawQuery.match(re('.+?')) || []).map(function (field) {
          return objParams[field.replace(/^{{|}}$/g, '')];
        })
      };
      return r;
    },
    buildArray: function (query, params, callback) {
      var queryArray = [];
      var parameterizedQuery = plugin.readParams(query, params);
      queryArray.push(parameterizedQuery.newQuery);
      queryArray.push(parameterizedQuery.params);
      for (var i = 0; i < parameterizedQuery.params.length; i++) {
        queryArray.push(parameterizedQuery.params[i]);
      }
      queryArray.push(callback);
      return queryArray;
    },

    runQueryList: function (queries, params, options) {
      params = params || {};
      return new Bluebird(function (resolve, reject) {
        var db = connection(config.name, config.connection || ':memory:');
        var runQuery = function (query, params) {
          return new Bluebird(function (queryResolve, queryReject) {
            var callback = function (err, rows) {
              if (err) {
                queryReject(err);
              } else {
                queryResolve(rows);
              }
            };
            db.all(plugin.buildArray(query, params, callback));
          });
        };

        // All the option to close the database connection
        if (options.close === true) {
          db.close(true);
          resolve(true);
          return;
        }

        // The queries should always be in an array
        if (!Array.isArray(queries)) {
          queries = [queries];
        }

        var newQueries = [];
        queries = queries.map(function (q) {
          if (q.replace(/[\s\r\n;]/gm, '').length > 0) { // TODO: Validate query more here?
            if (options.paramList) {
              params.map(function (p) {
                newQueries.push({
                  query: q,
                  params: p
                });
              });
            } else {
              newQueries.push({
                query: q,
                params: params
              });
            }
          }
        });

        var taskList = [];
        newQueries.map(function (q) {
          taskList.push({
            'name': 'Query: ' + q.query,
            'task': runQuery,
            'params': [q.query, q.params]
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
  return plugin;
};
