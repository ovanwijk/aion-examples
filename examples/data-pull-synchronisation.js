

var axios = require('axios');
var zmq = require("zeromq"),
  sock = zmq.socket("sub");

  //var ip = "84.85.6.42";
var aion_source = "http://192.168.56.101:8081";
var iri_source = "http://192.168.56.1:14265";
var aion_target = "http://192.168.56.101:8083";
var max_steps = 20;
var min_step_size = 28800;


var transactions = ["VHBZCTWNQNCNOMGBVJMWWVSXXNKIVECZMCVVLV9UKRQNPYLFVKORNJWLYVP9ENFERTQEGLBKHQUWADJA9"];

async function pull_subgraph_path(start, end) {
  console.log("Getting path", start, end);
  return (await axios.get(aion_source + '/subgraph/getpath/' + start +'/' + end)).data;
}

async function connect_subgraph(tx) {
  console.log("Connecting", tx);
  return (await axios.get(aion_target + '/subgraph/connect/' + tx)).data;
}

function chunkArray(myArray, chunk_size){
  var results = [];
  
  while (myArray.length) {
      results.push(myArray.splice(0, chunk_size));
  }
  
  return results;
}

async function storeLifeline(data) {
  var dataA = chunkArray(data, 20);
for(var i =0; i< dataA.length; i++){
 await axios.post(aion_target + '/subgraph/insert', 
  {
    data: dataA[i],
    node: iri_source
  }).catch(a => {
    console.log(a);
  })
}
 return ''
}

async function findCommonLifelines(timestamp) {
  
    var startTs = timestamp;
    var now_seconds = Date.now()/1000;
    var step_size = Math.max(min_step_size, Math.round((now_seconds - startTs) / max_steps));
    while(startTs < now_seconds + step_size) {
      console.log("Step", new Date(startTs * 1000), startTs);
      var source_ll_promise = axios.get(aion_source + "/lifeline/ts_index/" + startTs);
      var target_ll_promise = axios.get(aion_target + "/lifeline/ts_index/" + startTs);
      var source_ll = (await source_ll_promise).data.data.reduce(function(map, obj) {
        map[obj[0]] = obj[1];
        return map;
      }, {});;
      var target_ll = (await target_ll_promise).data.data;
      //console.log(source_ll);
      for(var i = 0; i < target_ll.length;i++){
        //console.log(target_ll[i][0]);
        if(source_ll[target_ll[i][0]] != null){
          console.log("Found common lifeline:", target_ll[i][0],  new Date(startTs * 1000));
          return target_ll[i][0];
        }
      }

      startTs+=step_size;
    }
    console.log("No common lifline");
    return null;
    
}

var timer = '';

async function doWork() {
 
  var storage_object = (await axios.post(aion_source + '/store/create_storage_object', 
  {
    hashes: transactions
  })).data;
 
  console.log(storage_object);

  // axios.post(aion_source + '/store', 
  // storage_object.data
  // ).then(function (response2) {           
  //   var id = response2.data.pinid;
  //   console.log("Got pinid, watching:", id);
    
  // }).catch(function (error) {            
  //     console.log("An error occured", error);
  // });
  var lifeline = (await axios.get(aion_target + '/lifeline/' + storage_object.data.start)).data;

  if (lifeline.data == null){
    console.log("Requires lifeline synchronization");
    console.log(new Date(storage_object.data.timestamp*1000),storage_object.data.start );
    var common = await findCommonLifelines(storage_object.data.timestamp);
    var sync_data = (await pull_subgraph_path(common, storage_object.data.start)).data;
    var connecting_data = (await connect_subgraph(common)).data;
    //data.first()
    //console.log(connecting_data);
    sync_data[0].lifeline_component.between_start = connecting_data.between_start;
    sync_data[0].lifeline_component.between_end = connecting_data.between_end;
    console.log(sync_data);
    var pin_result = await storeLifeline(sync_data);
    console.log(pin_result);
  }else{
    //console.log("LL_DATA", lifeline.data);
  }

 // console.log(storage_object)
}

doWork().then(a=> {
  console.log("Done")
})

