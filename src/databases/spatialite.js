var Bluebird = require('bluebird'),
  fandlebars = require('fandlebars'),
  sqlite = require('spatialite'),
  runList = require('../runList');

module.exports = function(config) {
  var db = new sqlite.Database(config.connection || ':memory:');
  return {
    runQueryList: function(sql, params) {
      return new Bluebird(function(resolve, reject) {
        if (!Array.isArray(sql)) {
          sql = [sql];
        }

        var runQuery = function(query) {
          console.log('running again!');
          return new Bluebird(function(queryResolve, queryReject) {
            db.spatialite(function(err) {
              // var rows = [];
              if (err) {
                queryReject(JSON.stringify(err, null, 2));
              } else {
                db.all(query, function(err, rows) {
                  queryResolve(rows);
                });
              }
            });
          });
        };

        var taskList = [];
        sql.map(function(query) {
          taskList.push({
            'name': 'Query: ' + query,
            'task': runQuery,
            'params': query
          });
        });

        console.log('list', taskList);
        runList(taskList, 'spatialite sql map')
          .then(function(r) {
            resolve(r);
          })
          .catch(function(e) {
            reject(e);
          });
      });
    }
  };
};
