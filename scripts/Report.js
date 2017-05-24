
var Report = (function (ns) {
 
  ns.render = function (value) {
  console.log('render', value);
    var el = DomUtils.elem;
    if (!value) {
      App.showNotification ("render error", "no values");
    }
    else {
      el ("demo-name").innerHTML = value.name;
      el ("points-length").innerHTML = value.points.length;
      el ("manifests-length").innerHTML = value.crawls.length;
    }
    
    return Promise.resolve (value);
  };
  return ns;
})({});