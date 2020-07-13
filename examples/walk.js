

var axios = require('axios');
var zmq = require("zeromq"),
  sock = zmq.socket("sub");

  //var ip = "84.85.6.42";
var aion_source = "http://192.168.56.101:8081";
var iri_source = "http://192.168.56.1:14265";
var aion_target = "http://192.168.56.101:8083";
var max_steps = 15;
var min_step_size = 28800;


var transactions = ["VHBZCTWNQNCNOMGBVJMWWVSXXNKIVECZMCVVLV9UKRQNPYLFVKORNJWLYVP9ENFERTQEGLBKHQUWADJA9"];

async function pull_subgraph_path(start, end) {
  console.log("Getting path", start, end);
  return (await axios.get(aion_source + '/subgraph/getpath/' + start +'/' + end)).data.data;
}

async function walk(data) {
  var current = data[0].lifeline_tx;
  var total = 0;
  console.log(data);
  var counter = 0;
  while(current != data[0].lifeline_component.lifeline_end_tx){
    var a = (await axios.get(aion_source + '/lifeline/' + current)).data.data;
    //console.log(a);
    current = a.paths[0].connecting_timewarp;
    console.log(counter, current, a.paths[0].connecting_pathway.size);
    total += a.paths[0].connecting_pathway.size ;
    counter += a.paths[0].connecting_pathway.size;
  }
  console.log(total);
}



var timer = '';

async function doWork() {
  var data = await pull_subgraph_path("HIRYWBNWBCPGBCQ9LQTHXLORQQNKZ9FEZOZOLFZJRSLEO9MEQXPYNZYCSPSQNLWFSTSWHUPCUNHOCGQK9", "IJXB9CIQUMJHA9ZEAQSSDTJRUTDHYEEHQCWINPKKTNLHBRLXZFLZHPGGNELDYVKHIONQEBYGTLJWA9TF9");
  await walk(data)
 // console.log(storage_object);

  // axios.post(aion_source + '/store', 
  // storage_object.data
  // ).then(function (response2) {           
  //   var id = response2.data.pinid;
  //   console.log("Got pinid, watching:", id);
    
  // }).catch(function (error) {            
  //     console.log("An error occured", error);
  // });
 

 // console.log(storage_object)
}

doWork().then(a=> {
  console.log("Done")
})

