var fandlebars = require('fandlebars'),
  fs = require('fs'),
  pg = require('pg'),
  Q = require('q');

module.exports = function(config) {

  var connect = function(callback) {
      var connectionString = fandlebars('postgres://{{username}}:{{password}}@{{hostname}}/{{dbname}}', config.database);
      pg.connect(connectionString, callback);
    },
    db = {
      readParams: function(rawQuery, objParams) {
        // Creates a parameterized query for postgres
        var re = function(name) {
            return new RegExp('{{' + name + '}}', 'g');
          },
          returnValue = {
            query: rawQuery,
            params: [],
            tempParams: {}
          };
        if (objParams && Object.prototype.toString.call(objParams) === '[object Object]') {
          for (var paramIndex in objParams) {
            if (rawQuery.match(re(paramIndex))) {
              returnValue.tempParams[paramIndex] = '$' + (returnValue.params.push(objParams[paramIndex]));
            }
          }
          returnValue.query = fandlebars(rawQuery, returnValue.tempParams);
          delete returnValue.tempParams;
        }
        return returnValue;
      },
      runQuery: function(query, params, callback) {
        // Runs an individual SQL query
        var newParams = null;
        if (params && Object.prototype.toString.call(params) === '[object Object]') {
          newParams = db.readParams(query, params);
          query = newParams.query;
          params = newParams.params;
        }
        connect(function(err, client, done) {
          if (err) {
            return console.error('error fetching client from pool', err);
          }
          client.query(query, params, function(err, result) {
            done();
            if (err) {
              return console.error('error running query', err, query);
            }
            callback(err, result);
          });
        });
      },
      runScript: function(filename, params, callback) {
        // Runs SQL from a file
        fs.readFile(filename, 'utf8', function(err, res) {
          var queries = [];
          if (err) {
            callback(err);
          } else {
            res.split(';').map(function(queryText) {
              if (queryText.replace(/[\s\r\n]/g, '').length > 0) {
                queries.push({
                  query: queryText.toString(),
                  params: params
                });
              }
            });
            db.runQueryList(queries, callback);
          }
        });
      },
      runQueryList: function(queryObj, callback) {
        // Runs Queries in order and waits for each to complete before starting the next query
        var results = [],
          queryIndex = -1,
          next = function() {
            queryIndex++;
            if (queryIndex < queryObj.length) {
              runQuery(queryIndex);
            } else {
              done();
            }
          },
          runQuery = function(i) {
            var result = {
              'query': queryObj[i]
            };
            db.runQuery(
              queryObj[i].query ? queryObj[i].query : queryObj[i].toString(),
              queryObj[i].params ? queryObj[i].params : null,
              function(e, r) {
                result.err = e;
                result.result = r;
                results.push(result);
                next();
              });
          },
          done = function() {
            callback(null, results);
          };
        next();
      },
      runQueryListAsync: function(queries, callback) {
        // Runs all Queries at once
        var qRunQuery = function(queryObj) {
          var deferred = Q.defer();
          db.runQuery(
            queryObj.query ? queryObj.query : queryObj.toString(),
            queryObj.params ? queryObj.params : null,
            function(e, r) {
              if (e) {
                deferred.reject(e.stack ? e : new Error(e));
              } else {
                deferred.resolve(r);
              }
            });
          return deferred.promise;
        };
        Q.all(queries.map(qRunQuery))
          .catch(function(e) {
            callback(e, null);
          })
          .then(function(r) {
            callback(null, r);
          });
      }
    };
  return db;
};
