/**
 * this namespace controls all aspects of handling the demo
 */

var Control = (function(ns) {
  
  
  // closure for properties management
  function makeService (service) {
    
    return {
      store:service,
      get: function (key) {
        var r = this.store.getProperty (key);
        try {
          var ob = r ? JSON.parse(r) : null;
        }
        catch (err) {
          var ob = r;
        }
        return ob;
      },
      set: function (key , ob) {
        return this.store.setProperty (key , JSON.stringify(ob));
      }
    };
  }

  // demo settings
  ns.settings = {
    ssid:"1SZGbK8eyyorO94n5RDRNcgGYTMS9Q_wyf9-mli7gBlo",
    sheets: {
      configs:"configs"
    },
    fiddlers: {
    },
    config:null,
    props: null,
    efx:null,
    geoSuffix:function makeGeoName (name) {
      return name + "-geo";
    },
    crawlsSuffix:function makeCrawlsName (name) {
      return name + "-crawls";
    }
  };
  
  /**
   * sets up the service
   */
  ns.service = function () {
    ns.settings.props = makeService (PropertiesService.getScriptProperties());
    
    // make the response look like the node client
    // dont bother return promises .. apps script is sync and im not sharing code with client
    ns.settings.efx = cEffexApiClient.EffexApiClient.setProd ()
    .setPromiseMode(false)
    .setNodeMode(true);
    
    return ns;
  };

  
  /**
   * initialize everything given a name
   * @param {string} name 
   */
  ns.init = function (name) {
  
    // short cut
    var st = ns.settings;
    
    // set up service shortcuts
    ns.service();
    
    // initialize the sheet - may already be done, but just do it again .. it may have changed
    ns.setSpreadsheet(st.ssid);
    
    // set the default name to 1st one in sheet if none supplied
    if (!name) {
      var c = st.fiddlers.configs.getData();
      if (!c.length) throw 'no config data available';
      name = c[0].name;
    }
    
    ns.settings.name = name;
    
    // set the config and pull in the data for the selected name
    ns.setConfig (name);
    
    // make the keys
    ns.makeKeys ();
    
    return ns;
    
  };
  
  // open the spreadsheet 
  ns.setSpreadsheet = function (id) {
    if (!id) {
      ns.settings.ss = SpreadsheetApp.getActiveSpreadsheet();
    }
    else {
      ns.settings.ss = SpreadsheetApp.openById(id);
    }
    
    // set this up for later.. we'll need it client side
    ns.settings.ssid = ns.settings.ss.getId();
    
    // load the parameters
    ns.settings.fiddlers.configs = new cUseful.Fiddler()
    .setValues (ns.settings.ss.getSheetByName(ns.settings.sheets.configs).getDataRange().getValues());

                
    return ns;
  };
  
      
  /**
  * set the fiddler row for this item
  * @param {string} name the name
  */
  ns.setConfig = function (name)  {

    // use the name of the profile to find the row
    var fiddler = ns.settings.fiddlers.configs;
    var matches =  fiddler.selectRows ('name', function (value) {
      return value === name;
    });
    
    if (!matches.length) {
      throw 'couldnt find parameters for config ' + name
    }
    
    // set the current config
    ns.settings.config = fiddler.getData()[matches[0]];
    
    // get its keys
    var keys = ns.getKeys (name);
    
    // get its geo
    ns.settings.fiddlers.geo = new cUseful.Fiddler()
    .setValues (ns.settings.ss.getSheetByName(ns.settings.geoSuffix(name)).getDataRange().getValues());
    
    // create it if it doesnt exist
    var sheet = ns.settings.ss.getSheetByName(name);
    if (!sheet) sheet = ns.settings.ss.insertSheet(name, 1);
    
    // get its data
    ns.settings.fiddlers.points = new cUseful.Fiddler()
    .setValues (sheet.getDataRange().getValues());
    
    // get its crawls
     ns.settings.fiddlers.crawls = new cUseful.Fiddler()
    .setValues (ns.settings.ss.getSheetByName(ns.settings.crawlsSuffix(name)).getDataRange().getValues());
    
    return ns;
    
  };
  
  /**
   * update any links that need keys
   */
  ns.makeLinks = function () {
    
    var keys = ns.settings.efx.getKeys();
    var fiddler = ns.settings.fiddlers.configs;
    
    // we already have the config row being processed set up 
    var row = ns.settings.config;
    
    // patch in the keys and update the sheet
    ["pd-control","pd-order-mapper"].forEach (function (d) {
      row[d+"-link"] = row[d] + "?updater=" + keys.updater + "&item=" + keys.item;
    });

    // write it back to the sheet
    fiddler
    .getRange(ns.settings.ss.getSheetByName(ns.settings.sheets.configs).getDataRange())
    .setValues(fiddler.createValues());
    
    return ns;

  };
  
   /**
   * clear assigned crawls
   */
  ns.clearCrawls = function () {
    
    var fiddler = ns.settings.fiddlers.crawls;

    var range = ns.settings.ss.getSheetByName(ns.settings.crawlsSuffix(ns.settings.name)).getRange(1,1); 
    
    fiddler.mapColumns (function (values,properties) {
      return properties.name === "declared-on" ? 
        values.map(function(d) { return ""; }) : values;
    })
    .getRange (range)
    .setValues (fiddler.createValues());
    
    return ns;

  };
  
  /**
   * make keys  if there aren't any already
   * @param {boolean} [forceNewKeys=false] whether to make new keys anyway
   */
  ns.makeKeys = function (forceNewKeys) {
     
    var propper = ns.settings.props;
    var name = ns.settings.config.name;
    
    // the keys
    var keys = ns.getKeys(name);
    var efx = ns.settings.efx;
    
    if (!keys || forceNewKeys ) {
      // get a boss key from props, because we need to generate one
      var boss = propper.get ("bossKey");
      if (!boss) throw 'boss key missing from property store';
      
      // generate some keys and store them
      var keys = efx.makeKeys (boss).data;
      propper.set ("efxKeys" , keys);
      efx.setKeys(ns.getKeys(name));

      
    }
    else {
      // generate any other keys needed for the demo and use efx to carry them around.
      efx.setKeys(ns.getKeys(name));
    }
    return ns;
    
  };
  

  /**
   * set keys for the given name
   */
  ns.getKeys = function (name) {
    
  // maps key
    var mapsApiKey = ns.settings.props.get("mapsApiKey");
    if (!mapsApiKey) throw 'mapsApiKey key missing from property store';
    
    // get existing keys
    var keys = ns.settings.props.get ("efxKeys"); 
    if (keys) {
      keys.item = keys.item || "item-"+name;
      keys.id = keys.item;
      keys.alias = keys.item;
      keys.mapsApiKey = mapsApiKey;
      keys.ssid = ns.settings.ssid;
    }
    return keys;
  };

  /**
   * clear up any undeclared points
   */
  ns.pointsInitialize = function (clearAll) {
    var st = ns.settings;
    var fiddler = st.fiddlers.points;
    var range = st.ss.getSheetByName(st.config.name).getRange(1,1);
    
    // filter out any undeclared, then write away
    fiddler.filterRows (function (row) {
      return !clearAll && row.assigned;
    })
    .getRange (range)
    .setValues (fiddler.createValues());
    return ns;
  }
   /**
   * initialize the efx item
   */
  ns.efxInitialize = function () {
    
    var st = ns.settings;
    
    // handle is stored here
    var efx = st.efx;
    var keys = efx.getKeys();

    // write the initial item .. reconstruct from sheet.. unallocated points are discarded
    var initial = {
      name:st.config.name, 
      points:[],
      crawls:st.fiddlers.crawls.getData().filter (function (d) { return d['declared-on'];}),
      complete:st.fiddlers.points.getData(),
      session:efx.getSession(),
      polygon: st.fiddlers.geo.getData(),
      keys:st.config,
      mapsApiKey:keys.mapsApiKey
    };
    
    // creat an alias item
    return efx.writeAlias(initial, keys.item, keys.writer, "post", {
      updaters: keys.updater,
      readers: keys.reader,
      seconds: 60*60*8
    });

    
  };


  return ns;
})({});

