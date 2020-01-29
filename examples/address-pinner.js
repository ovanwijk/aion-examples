/**
 * Example on how to use AION's store api to watch and pin transactions sent to a certain address.
 * The process is as followed:
 * Use ZMQ-> Watch address -> receive transactionID's. -> poll /store/create/storage_object with transactionID's 
 * (this might take a few retries because there might not be a confirmed path possible that connects AION's lifeline
 * and the stored transaction.)
 * -> post result to /store to tell AION it should store it. -> retrieve pin-id. (async job token) ->
 * use pin-id to poll for the pinning status. -> See progress and wait for status:success ->
 * validate pinning by using the isPinned endpoint on IRI.
 * 
 */



var axios = require('axios');
var zmq = require("zeromq"),
  sock = zmq.socket("sub");

var ZMQ = "tcp://192.168.56.1:5556";
var AION = "http://192.168.56.101:8080";
var IRI = "http://192.168.56.1:14265"



sock.connect(ZMQ);



//Watch and pin the coordinator address.// EQSAUZXULTTYZCLNJNTXQTQHOMOFZERHTCGTXOLTVAHKSA9OGAZDEKECURBRIXIJWNPFCQIOVFVVXJVD9
//Of course this can be any address, so feel free to change!
var ADDRESS_TO_PIN = "EUWNHKHVFPYLY9BSCSWVZWYZKBKQZRJFJVYQTLOCHVYGLHOFAWZXJ9FM9ORYJUILNQULEIJSEKGEFACLJ";

sock.subscribe(ADDRESS_TO_PIN);
console.log("Subscriber connected to port 5556");


var work_groups = [["9TAVPGRPC9PEDKPWOWLTAZOAQKDSJRRXOLGYIKHSMBAFPQCBRIFENAFBJLPKJWWNBMECVRZQFLXFLNLS9"]];//Array of [Array of TX hashes].
var current_address_txs = [];
var timer = null;

//Polls pin-id status, is heavy spam
var poll_status = (id, status = "") => {
  axios.get(AION + '/store/' + id).then(function(response) {   
  
    var responseData = response.data;
   
    if (responseData.status != 'success') {     
      var new_status = (responseData.status + " " + responseData.current_index + "/" + responseData.pathway.size);
      if (status != new_status){
        console.log(id, new_status);
      }
      setTimeout(()=> {poll_status(id, new_status)},50);
    }else{
      console.log("Success", responseData);
      axios.post(IRI, {
        command: 'isPinned',
        hashes: responseData.data.endpoints
      }, { headers:  {
        "X-IOTA-API-Version": "1"
    }}).then(function(response) {
      console.log("Validaton, transactiones pinned:", response.data);
    }).catch(function (error) {            
      console.log("Got error", error);
    });


    }
  }).catch(function (error) {
            
    console.log("Got error", error);
  });
  
}
//Takes some work from the work group array and initates the process.
var worker = () => {
    if(work_groups.length > 0){      
      axios.post(AION + '/store/create_storage_object', 
      {
        hashes: work_groups[0]
      }).then(function (response1) {
        console.log("status ", response1.status);
        if(response1.status == 200){
          console.log("Retrieved storage object:" , response1.data);
          work_groups.shift();
          axios.post(AION + '/store', 
            response1.data.data
          ).then(function (response2) {           
            var id = response2.data.pinid;
            console.log("Got pinid, watching:", id);
            poll_status(id);
          }).catch(function (error) {            
              console.log("An error occured", error);
          });
          
        }      
        
        setTimeout(worker, 10000);
      }).catch(function (error) {
        setTimeout(worker, 10000);
        console.log("No lifeline found yet for ", work_groups[0], " in queue: " , work_groups.length);
      });;
  }else{

    setTimeout(worker, 10000);
  }
}
worker();


sock.on("message", function(topic) {
  console.log("Got message on address!", topic.toString());
  if(timer){clearTimeout(timer)}
  var message_split = topic.toString().split(' ');
  current_address_txs.push(message_split[1]); //We add the transaction ID here.
  timer = setTimeout(() => {
      work_groups.push(current_address_txs);
      current_address_txs = [];
  }, 1000);
});