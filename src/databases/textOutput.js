module.exports = function() {
  return {
    runQueryList: function(queries, params, options, callback) {
      queries = queries.map(function(a) {
        return {
          query: a,
          params: params
        };
      });
      queries.map(function(a) {
        console.log(a);
      });
      callback(null, queries);
    }
  };
};
