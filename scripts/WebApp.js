/**
 * called when a change is detcted using a url subscription
 */
function doPost(e) {

  var response = {
    ok: true,
    code: 201
  };

  try {
    var post = JSON.parse(e.postData.contents);
  }
  catch (err) {
    response.ok = false;
    response.error = err;
    response.code = 400;
  };

  // first initialize the services
  Control.service();

  // we can now use the efx
  var efx = Control.settings.efx;
  useTheData();


  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);

  function useTheData() {

    // set session to this webapp - we can use that to avoid processing our own updates
    efx.setSession(ScriptApp.getService().getUrl());

    // get the item we've been woken up about, and hold it for update
    var result = efx.read(post.id, post.message.updater, {
      intention: "update",
      backoff: true
    });
    var data = result.data;

    if (!data.ok) throw 'failed to get item in url notification ' + JSON.stringify(data);

    // Im being called about my own update .. ignore
    if (efx.getSession() === data.session) {
      response.code = 202;
      response.error = "ignored";
      var r = efx.release(data.id, data.reader, data.intent)
      if (!r.data.ok) console.log('failed to release intent ' + JSON.stringify(r.data));
      return null;
    }

    // open the sheet
    var ss = SpreadsheetApp.openById(post.message.ssid);

    // the sheet name should match the name in the cache, create it if itdoesnt exist
    var sheet = ss.getSheetByName(data.value.name);
    if (!sheet) ss.insertSheet(data.value.name, 1);

    // are we declaring a new crawl - when the unassigned count reaches the threshhold 
    var now = new Date().getTime();
    var fd = data.value.points.filter(function(d) {
      return !d.assigned;
    })
    .filter (function (d,i,a) {
      // this is to elminate any duplicates in the same assignment
      return !a.slice(i+1).some(function (e) { d.place_id === e.place_id });
    });
    var isDeclared = fd.length >= data.value.keys['crawl-size'];

    // the crawl page master is the sheet 
    // the points & complete master is the cache
    if (isDeclared) {

      // get its crawls
      var crawlRange = ss.getSheetByName(Control.settings.crawlsSuffix(data.value.name)).getDataRange();
      var crawlFiddler = new cUseful.Fiddler().setValues(crawlRange.getValues());

      // find an empty one
      var empty = crawlFiddler.getData().filter(function(d) {
        return !d['declared-on'];
      })[0];

      if (!empty) { 
        isDeclared = false;
        response.code = 507;
        response.ok= false;
        response.error = 'no more crawl space';
      }
      else {
        // assign to this crawl space
        empty['declared-on'] = now;
        empty.name = data.value.name;

        // fd contains a filter of items that havent yet been assigned
        for (var i = 0; i < data.value.keys['crawl-size']; i++) {
          fd[i].crawl = empty['crawl-name'];
          fd[i].assigned = empty['declared-on'];
        }

        // update the crawl tab, and the cache values
        crawlFiddler.getRange(crawlRange).setValues(crawlFiddler.createValues());

        // and we'll put that update back to the cache
        data.value.crawls = crawlFiddler.getData().filter (function (d) { return d['declared-on'];});
      }
    }
    
    if (!isDeclared) {
      // TODO need to check if the crawl content moved in some other way and write to cache for completenes
      // we can release the update 
      var r = efx.release(data.id, data.reader, data.intent)
      if (!r.data.ok) console.log('failed to release intent ' + JSON.stringify(r.data));

    }

    // do this whether or not we assigned an item to a crawl
    // now clear it and freshen using the updated cache value sas the master
    sheet.clearContents();

    // convert all the points for display
    var cleaned = data.value.points.map(function(d) {
        return {
          crawl: d.crawl || "",
          name: d.name,
          vicinity: d.vicinity,
          placeid:d.place_id,
          lat: d.lat,
          lng: d.lng,
          assigned: d.crawl ? now : "",
          "attributed-photos": (d.photos || [])
            .map(function(e) {
              var attr = e.html_attributions;
              if (!Array.isArray(attr)) attr = [attr];
              return attr.map(function(f) {
                return f.replace(/.*"([^"]*)">(.*)<.*/, '=hyperlink("$1","$2")');
              }).join(",");
            }).join(",")
        };
      });

    // move the points to complete
    data.value.complete = data.value.complete.concat(cleaned.filter(function(d,i) {
      return d.assigned;
    }));

    // and the unassigned
    var unassigned = cleaned.filter(function(d,i) {
      return !d.assigned;
    });

    // and remove the points that have been assigned in this declaration
    data.value.points = data.value.points.filter(function(d, i) {
      return !d.assigned;
    });


    // write them out
    var fiddler = new cUseful.Fiddler().setData(unassigned.concat(data.value.complete));


    // update the sheet from the fiddler we just created
    fiddler.getRange(sheet.getRange(1, 1)).setValues(fiddler.createValues());

    // update the item if necessary
    if (isDeclared) {
      var result = efx.update(data.value, data.id, post.message.updater, "post", {
        intent: data.intent
      });
      var data = result.data;
      if (!data.ok) throw 'failed to update efx ' + JSON.stringify(data);
    }

  }
}

function sim() {

  doPost({
    postData: {
      contents: JSON.stringify({
        id: "item-city-crawl",
        message: {
          updater: "uxk-gsarf1e-b19424u6413h",
          ssid: '1SZGbK8eyyorO94n5RDRNcgGYTMS9Q_wyf9-mli7gBlo'
        }
      })
    }
  });

}
