/**
* used to expose memebers of a namespace
* @param {string} namespace name
* @param {method} method name
*/
function exposeRun (namespace, method , argArray ) {
  var func = (namespace ? this[namespace][method] : this[method])
  if (argArray && argArray.length) {
    return func.apply(this,argArray);
  }
  else {
    return func();
  }

}

var Server = (function(ns) {


  
  // trigger a thing
  ns.triggerOrder = function (name) {
   
    // set up init structures
    Control.init(name);
    var efx = Control.settings.efx;
    var keys = efx.getKeys();
    
    // read the latest item
    var result = efx.read (keys.item)
    var data = result.data;
    if (!data.ok) throw 'failed to get item ' + JSON.stringify(data);
    // post to the cloud function
    var packet =  {
      contents: {
        item:keys.item,
        message: {
          updater:keys.updater,
          mapsApiKey:keys.mapsApiKey
        }
      }
    };
      
    var response = UrlFetchApp.fetch (data.value.keys['pd-order-generator'] , {
      payload:JSON.stringify(packet),
      contentType:"application/json",
      method:"post",
      muteHttpExceptions:true
    });

    return response.getResponseCode();
      
  };

    //--data='{"contents":{"message":{"updater":"uxk-gsarf1e-b19424u6413h","mapsApiKey":"AIzaSyDoWGxNZ2zOLzPyyssH508seSk4vd5YA9U"},"item":"item-pd-demo"}}'

  
  // get keys from the server
  ns.getKeys = function (name) {
    return Control.getKeys (name);
  };
  
  // get the configs available
  ns.getConfigs = function () {
    
    Control.init();
    
    // we can just return the contents of the configs fiddler mapped
    return Control.settings.fiddlers.configs.getData().map(function(d) {
      return d.name;
    });
  };
  
  // constinue the demo using sheet data
  ns.continueDemoFromSheet = function (name) {
  
    Control.init(name);
    var efx = Control.settings.efx;
    var keys = efx.getKeys();
   
    // update the links to start everything off
    Control.makeLinks ();
    
    // clear unassigned points
    Control.pointsInitialize ();
    
    // write the initial item
    var result = Control.efxInitialize ();
    return {keys:keys , data: result.data, waiter:Control.settings.config['suggestion-time']};


  };
  
  // reset the demo
  ns.resetDemo = function (name) {
  
    Control.init(name);
    var efx = Control.settings.efx;
    var keys = efx.getKeys();
   
    // update the links to start everything off
    Control.makeLinks ();
  
    // clear previously assigned crawls
    Control.clearCrawls();
    
    // clear unassigned points
    Control.pointsInitialize (true);
    
    // write the initial item
    var result = Control.efxInitialize ()
    return {keys:keys , data: result.data};


  };
  
  return ns;
})(Server || {});