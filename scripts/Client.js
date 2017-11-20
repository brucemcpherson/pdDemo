
var Client = (function (ns) {
 
  // pick up the keys etc from the server
  var stopped = true;
  
  ns.settings = {
    name:"city-crawl",
    keys:{},
    data:null,
    waiter:20000,
    notifications:[],
    stopped:true
  };
  
  /**
   * intialize .. call once
   */
  ns.init =  function () {
    // connect to cache
    ns.settings.efx = EffexApiClient;
    ns.settings.efx.setEnv('fb');
    return ns.getConfigs ();
  };
  
  /**
   * stops the demo 
   */
  ns.stopDemo = function () {
    
    clickMania (true);
    spinCursor();
    var st = ns.settings;
    var efx = st.efx;
    
    return Promise.all (
      st.notifications.map(function (d) { 
        return efx.off (d.watchable);
      }))
    .then (function (r) {
      ns.settings.stopped = true;
      DomUtils.elem("start-watching").disabled  = false;
      DomUtils.elem("reset-demo").disabled  = false;
      resetCursor();
    })
    
  };
  
  // make a select for the known configs
  ns.makeSelect = function(select, options, defValue) {
    select.value =  "";
    select.innerHTML = "";
    var found= false;
    options.forEach(function(d) {
        if (d) {
          var option = document.createElement("option");
          option.innerHTML = d;
          option.value = d;
          select.appendChild(option);
          select.value = select.value || d;
          if (defValue && d === defValue) found = true;
        }
      });
    if (found) select.value = defValue;
    
    return select;
  };
  
  /**
   * a new config selection is made
   */
  ns.changedConfig = function () {
    ns.settings.name = DomUtils.elem ("config-selector").value;
    
    // and reset for the new one
    return ns.resetDemo (true);
  };
  /**
   * set up the list of known crawls
   */
  ns.getConfigs = function () {
    
    // assume any spinning is already done
    return Provoke.run ("Server" , "getConfigs")
    .then (function (result) {
      var select = DomUtils.elem ("config-selector");
      ns.makeSelect (select , result , select.value);
      ns.settings.name = select.value;
    })
    ['catch'](function (err) {
      App.showNotification ("Unable to get list of configs", err);
    });
  };
  /**
   * resets the demo back to the beginning
   */
  ns.resetDemo = function (useSheetData) {

    clickMania (true);
    spinCursor();
   
    // get the keys and generate a new set of data
    ns.stopDemo()
    .then (function (result) {
      return Provoke.run ('Server' , useSheetData ? 'continueDemoFromSheet' : 'resetDemo' , ns.settings.name )
    })
    .then (function (result) {
      var data = result.data;
      var keys = result.keys;
      ns.settings.waiter = result.waiter;  
      ns.settings.keys = keys;
      ns.settings.efx.setKeys ( ns.settings.keys);
      clickMania (false);
      return ns.render();
    })

    ['catch'](function (err) {
      resetCursor();
      App.showNotification ('failed to get keys for '+  ns.settings.name, err);
    });

    
  };
  
  /**
   * render an update - called when something changes
   */
  ns.render = function () {
  
    var keys = ns.settings.efx.getKeys();
    ns.settings.data = null;
    
    ns.settings.efx.read (keys.item , keys.reader ) 
    .then (function (result) {
      if (!result.data.ok) {
        App.showNotification ("Error getting item", JSON.stringify(result.data));
        return null;
      }
      else {
        ns.settings.data = result.data;
        return Report.render(result.data.value);
      }
    })
  };

    
  /**
   * starts off and monitors everything
   */
  ns.startWatching = function () {
    
    // subscribe to changes here
    var efx = ns.settings.efx;
    var keys = efx.getKeys();
    console.log ("got keys", keys);
    
    spinCursor();

    // avoid clicking mania
    clickMania (true);
    
    // read in the data from the file to get various parameters we'll need later
    efx.read (keys.item)
    .then (function(result) {
      console.log (' first read ' , result.data);
      if (!result.data.ok) throw JSON.stringify(result.data);
      
      return ns.settings.data = result.data;
    })
    .then (function (data) {

      // set up a push watch for this client, that will update the display
      var pushOn = ns.settings.efx.on("update", keys.item, keys.updater, 
        function(id,packet){
          ns.render();
        }, {type:"push"});

      // set up a url notification so the sheet can be updated, it'll need the ssid its supposed to update.
      // along with a reader key it'll have evetyting else from the push
      // it can get the name from the efx record
      var urlOn = ns.settings.efx.on("update", keys.item, keys.updater, data.value.keys['pd-control-link'], {
        type:"url",
        message:{updater:keys.updater, ssid:keys.ssid}
      });

      // resolve when done
      return Promise.all ([pushOn,urlOn]);
    })
    .then (function (r) {
      DomUtils.elem("reset-demo").disabled  = false;
      DomUtils.elem("stop-demo").disabled  = false;
      resetCursor();
      ns.settings.notifications = r;
      ns.settings.stopped = false;
      return ns.startGeneratingOrders();
      
    })
    ['catch'](function(err) {
      App.showNotification ('failed dealing with subscription for ' + ns.settings.name, err);
    });
    
  };

      
  /**
  * trigger order request at random times
  * this will call a google cloud function to ask it to come up with a place to visit.
  */
  ns.startGeneratingOrders = function () {
    
    // subscribe to changes here
    var efx = ns.settings.efx;
    
    
    // kick off the looper
    orderer();
    
    // do loads of times
    function orderer() {
      console.log('ordering stopped?',ns.settings.stopped);
      if (!ns.settings.stopped) {
        var waiter = ns.settings.waiter * (1 + Math.random());
        return  Provoke.run ("Server", "triggerOrder" , ns.settings.name)
        .then(function (result) { 
          if (result !== 200) console.log ("failed point generation with error ", result);
          return efx.handyTimer(waiter) 
        })
        .then(function () { orderer()})
        ['catch'](function(err) {
          App.showNotification ("failed to provoke point generation" , err);
        });
      }
    }
    
  };
   
  function resetCursor() {
    DomUtils.hide ('spinner',true);
  }
  function spinCursor() {
    DomUtils.hide ('spinner',false);
  }
  function clickMania (disable) {
        
    // avoid clicking mania
    DomUtils.elem("start-watching").disabled  = disable;
    DomUtils.elem("reset-demo").disabled  = disable;
    DomUtils.elem("stop-demo").disabled  = disable;
  };
  return ns;
})(Client || {});