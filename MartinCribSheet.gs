function martins() {
  
  // get a handle and use prod api
  var efx = cEffexApiClient.EffexApiClient.setProd();
  
  // check it works
  var result = efx.ping();
  if (!result.ok) throw (JSON.stringify(result));
  
  // the keys Im using are in the property service
  var keys = {"writer":"wxk-i2j1-fbctn2onabjy","reader":"rxk-qel2tr-agbo1ecdbjp2","updater":"uxk-dela1w-b2os2bfjucqj"};
  
  // for the data items i use an alias , eg
  // item-city-crawl
  var item = "item-city-crawl";
  
  // to simply read an item - if the item has expired, recreate one using the add-in
  // it'll use any data it finds in the spreadsheet
  var result = efx.read (item, keys.reader);
  if (!result.ok) throw (JSON.stringify(result));
  
  // to read an item , that you want to update later, and use exp back automatically
  var data = efx.read (item , keys.updater , {intention:"update", backoff:true});
  if (!data.ok) throw (JSON.stringify(data));
  
  // the content is in data.value
  Logger.log (data.value);
  
  // to update an item, using the intention grant
  var result = efx.update (data.value , item , keys.updater , "post" , {intent:data.intent});
  if (!result.ok) throw (JSON.stringify(result));
  
  // to write a completely new item
  var result = efx.write ( "some data" , keys.writer );
  if (!result.ok) throw (JSON.stringify(result));
  
  // read it back - using the same key
  var result = efx.read ( result.id , keys.writer);
  if (!result.ok) throw (JSON.stringify(result));
  Logger.log (result.value);
  
  // allow someone else to access an item
  var result = efx.write ( "some more data", keys.writer , "post" , {updaters:keys.updater , readers:keys.reader});
  if (!result.ok) throw (JSON.stringify(result));
  
  // now I can read it with a different key, that is not able to update it
  var result = efx.read ( result.id , keys.reader);
  if (!result.ok) throw (JSON.stringify(result));
  
  // ... more stuff later and at
  // https://github.com/brucemcpherson/effex-api-client
  // note that the js & node clients in the docs have a response 
  // result.data  which is equivalent to the apps script result
  // you can set the same behavior in the apps script client with
  efx.setNodeMode(true);
  
  // then you'd do this
  var result = efx.ping();
  if (!result.data.ok) throw JSON.stringify(result.data);
  
  
}
