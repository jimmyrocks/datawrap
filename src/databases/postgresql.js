var Bluebird = require('bluebird'),
  fandlebars = require('fandlebars'),
  fs = require('fs'),
  pg = require('pg'),
  runList = require('../runList');

module.exports = function(config) {
  var connect = function(callback) {
      var connectionString = fandlebars('postgres://{{username}}:{{password}}@{{address}}' + (config.port ? ':{{port}}' : '') + '/{{dbname}}', config);
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
      runQueryPromise: function(query, params) {
        return new Bluebird(function(resolve, reject) {
          var newParams = null;
          if (params && Object.prototype.toString.call(params) === '[object Object]') {
            newParams = db.readParams(query, params);
            query = newParams.query;
            params = newParams.params;
          }
          connect(function(err, client, done) {
            if (err) {
              console.error('error fetching client from pool', err);
            } else {
              client.query(query, params, function(err, result) {
                done(client);
                if (err) {
                  console.error('error running query', err, query);
                  reject(err);
                } else {
                  resolve(result);
                }
              });
            }
          });
        });
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
              if (queryText.replace(/[\s\r\n;]/gm, '').length > 0) { //TODO: Put this in a validate query function
                queries.push({
                  query: queryText.toString(),
                  params: params
                });
              }
            });
            db.runQueryListOld(queries, callback);
          }
        });
      },
      runQueryList: function(queries, params, options) {
        return new Bluebird(function(resolve, reject) {
          var newQueries = [];
          queries = queries.map(function(a) {
            if (a.replace(/[\s\r\n;]/gm, '').length > 0) { //TODO: Validate query more here?
              if (options.paramList) {
                params.map(function(p) {
                  newQueries.push({
                    query: a,
                    params: p
                  });
                });
              } else {
                newQueries.push({
                  query: a,
                  params: params
                });
              }
            }
          });
          //        db.runQueryListOld(newQueries, callback);
          var taskList = [];
          newQueries.map(function(q) {
            taskList.push({
              'name': q.query,
              'task': db.runQueryPromise,
              'params': [q.query, q.params]
            });
          });

          runList(taskList, 'postgresql.js')
            .then(resolve)
            .catch(reject);
        });
      },
      runQueryListOld: function(queryObj, callback) {
        // Runs Queries in order and waits for each to complete before starting the next query
        var results = [],
          queryIndex = -1,
          next = function() {
            queryIndex++;
            if (queryIndex < queryObj.length) {
              runSingleQuery(queryIndex);
            } else {
              done();
            }
          },
          runSingleQuery = function(i) {
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
      }
    };
  return db;
};
