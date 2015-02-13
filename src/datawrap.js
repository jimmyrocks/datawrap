var Bluebird = require('bluebird'),
  databases = require('./databases'),
  datawrapDefaults = require('../defaults'),
  fandlebars = require('fandlebars'),
  runList = require('./runList'),
  fs = Bluebird.promisifyAll(require('fs'));

// TODO, this should be in fandlebars
var fbobj = function(obj, tree) {
  var newObj = Array.isArray(obj) ? [] : {};
  for (var v in obj) {
    if (typeof obj[v] === 'object') {
      newObj[v] = fbobj(obj[v], tree);
    } else {
      newObj[v] = fandlebars(obj[v], tree);
    }
  }
  return newObj;
};

module.exports = function(config, defaults) {
  defaults = fbobj(defaults || datawrapDefaults, global.process);

  // Make sure the database type exists
  var database;
  if (databases[config.type]) {
    database = databases[config.type](config);
  } else {
    throw 'Database type (' + config.type + ') does not exist';
  }

  var readFile = function(filepath, options) {
    return new Bluebird(function(fulfill, reject) {
      var delimiter = options.delimiter || config.delimiter || defaults.delimiter;
      var fileOptions = options.fileOptions || config.fileOptions || defaults.fileOptions;

      fs.readFileAsync(filepath, fileOptions)
        .then(function(fileData) {
          var queries = fileData.split(delimiter);
          if (queries[queries.length - 1].length < 3) {
            queries.pop();
          }
          fulfill(queries.map(function(v) {
            // Append a semicolon if there is none
            return v + (v.substr(-1) === ';' ? '' : ';');
          }));
        })
        .catch(SyntaxError, function(e) {
          reject(e);
        });
    });
  };

  return {
    runQuery: function(query, params, options, callback) {

      callback = typeof options === 'function' ? options : callback;
      query = Array.isArray(query) ? query : [query];
      options = typeof options === 'object' ? options : {};

      var regex = new RegExp(options.fileDesignator || config.fileDesignator || defaults.fileDesignator),
        rootDirectory = (options.rootDirectory || config.rootDirectory || defaults.rootDirectory);
      rootDirectory = rootDirectory + (rootDirectory.substr(-1) === '/' ? '' : '/');

      // Determine if we need to read any files
      var filesToRead = [];
      var modQueries = query.map(function(q) {
        if (q.match(regex)) {
          return filesToRead.push({
            'name': q,
            'task': readFile,
            'params': [fandlebars(q, params).replace(regex, rootDirectory), options]
          }) - 1;
        } else {
          return q;
        }
      });
      runList(filesToRead, 'datawrap')
        .then(function(q) {
          var mm = [];
          modQueries.map(function(line) {
            if (typeof line === 'number') {
              q[line].map(function(command) {
                mm.push(command);
              });
            } else {
              mm.push(line);
            }
          });
          database.runQueryList(mm, params, options)
            .then(function(r) {
              callback(null, r);
            })
            .catch(function(e) {
              callback(e);
            });
        }).catch(function(e) {
          callback(e);
        });
    }
  };
};
