var runList = require('../src/runList');
var Bluebird = require('bluebird');

var bbTest = function (time, returnValue, throwError) {
  return new Bluebird(function (fulfill, reject) {
    setTimeout(function () {
      // do what you need here
      if (throwError) {
        reject(new Error(returnValue));
      } else {
        fulfill(returnValue);
      }
    }, time);
  });
};

var testList = [{
  'name': 'Test 1',
  'task': console.log,
  'params': [1, 2, 3]
}, {
  'name': 'Test 2',
  'task': console.log,
  'params': [4, 5, 6]
}, {
  'name': 'bluebird test 1',
  'task': bbTest,
  'params': [1000, 'test1000']
}, {
  'name': 'Test 22',
  'task': function (a, b, c) {
    return a + b + c;
  },
  'params': [4, 5, 6]
}, {
  'name': 'bluebird test 2',
  'task': bbTest,
  'params': [1500, 'test1500']
}, {
  'name': 'Test 22',
  'task': function (a, b, c) {
    return a * b * c;
  },
  'params': [4, 5, 6]
}, {
  'name': 'bluebird test 3',
  'task': bbTest,
  'params': [1230, 'test1230', false]
}];

runList(testList).then(function (x) {
  console.log('resolved with', x);
}).catch(function (x) {
  console.log('errored with', x);
  throw Array.isArray(x) ? x[x.length - 1] : x;
});
