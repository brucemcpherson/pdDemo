/**
* sets up all listeners
* @constructor Home
*/

var Home = (function (ns) {
  'use strict';

  // The initialize function must be run to activate elements
  ns.init = function (reason) {

    [{elem:'start-watching',method:'startWatching',ev:"click"},
     {elem:'reset-demo',method:'resetDemo',ev:"click"},
     {elem:'stop-demo',method:'stopDemo',ev:"click"},
     {elem:'config-selector',method:'changedConfig',ev:"change"}
    ]
    .forEach (function(d) {
        DomUtils.elem(d.elem)
        .addEventListener(d.ev , function () {
          Client[d.method]();
        });   
     });

  };
  
  return ns;
  
})(Home || {});
