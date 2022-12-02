var data = document.querySelectorAll(".infinite-scroll-component .row");

var deviceListString = "Device ID\tDevice Name\n"
for (var i = 1; i < data.length; i++) {
  deviceListString += (data[i].childNodes[1].innerText + "\t" + data[i].childNodes[0].innerText + "\n");
}

console.log(deviceListString);