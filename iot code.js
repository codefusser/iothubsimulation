/*
* IoT Hub Raspberry Pi NodeJS - Microsoft Sample Code - Copyright (c) 2017 - Licensed MIT
*/

//define the constants for the devices' (sensor and Raspberry Pi) using available modules
const wpi = require('wiring-pi'); //Raspberry Pi pins
const Client = require('azure-iot-device').Client; // Azure module for the iot device for intefacing
const Message = require('azure-iot-device').Message; //Azure handler for messaging
const Protocol = require('azure-iot-device-mqtt').Mqtt;  // Azure module for the iot device for communication
const BME280 = require('bme280-sensor'); //BME280 sensor interfacing module

const BME280_OPTION = {
  i2cBusNo: 1, // defaults to 1
  i2cAddress: BME280.BME280_DEFAULT_I2C_ADDRESS() // defaults to 0x77
};  // BME280 i2c communication constants; i2c is the communication protocol for PICs

//include the device id at the end of the device connection  string 
//i.e. [deviceConnectionString;DeviceId=[device name in IoT hub]
const connectionString = 'HostName=IoTHubTestlab.azure-devices.net;SharedAccessKey=vNqVDUBDXFmrUGKuOtUfxntaMoFYpXbO4HYeUKvTy0A=;DeviceId=iotdevicesimulator;';
const LEDPin = 4;

var sendingMessage = false;
var messageId = 0;
var client, sensor;
var blinkLEDTimeout = null;

// generate messages/data to send to the IoT hub for probable analysis
function getMessage(cb) {
  messageId++;
  sensor.readSensorData()
    .then(function (data) {
      cb(JSON.stringify({
        messageId: messageId,
        deviceId: 'iotdevicesimulator', //the device ID is created as the name of the device in the IoT hub when you add a device
        temperature: data.temperature_C,
        humidity: data.humidity
      }), data.temperature_C > 30);
    })
    .catch(function (err) {
      console.error('Failed to read out sensor data: ' + err);
    });
}

// send generated message to the IoT hub
function sendMessage() {
  if (!sendingMessage) { return; }

  getMessage(function (content, temperatureAlert) {
    var message = new Message(content);
    message.properties.add('temperatureAlert', temperatureAlert.toString());
    console.log('Sending message: ' + content);
    client.sendEvent(message, function (err) {
      if (err) {
        console.error('Failed to send message to Azure IoT Hub');
      } else {
        blinkLED();
        console.log('Message sent to Azure IoT Hub');
      }
    });
  });
}

// message to display at the console to determine whether message was sent successfully or not
function onStart(request, response) {
  console.log('Try to invoke method start(' + request.payload + ')');
  sendingMessage = true;

  response.send(200, 'Successully start sending message to cloud', function (err) {
    if (err) {
      console.error('[IoT hub Client] Failed sending a method response:\n' + err.message);
    }
  });
}

// function to stop sending message
function onStop(request, response) {
  console.log('Try to invoke method stop(' + request.payload + ')');
  sendingMessage = false;

  response.send(200, 'Successully stop sending message to cloud', function (err) {
    if (err) {
      console.error('[IoT hub Client] Failed sending a method response:\n' + err.message);
    }
  });
}

// callback for messages received from the hub such as shutting down the IoT device
function receiveMessageCallback(msg) {
  blinkLED();
  var message = msg.getData().toString('utf-8');
  client.complete(msg, function () {
    console.log('Receive message: ' + message);
  });
}

// determine the rate the LED should blink
function blinkLED() {
  // Light up LED for 500 ms
  if(blinkLEDTimeout) {
       clearTimeout(blinkLEDTimeout);
   }
  wpi.digitalWrite(LEDPin, 1);
  blinkLEDTimeout = setTimeout(function () {
    wpi.digitalWrite(LEDPin, 0);
  }, 500);  //adjust the LED blink rate by changing the value 500 to any other value in millisecond
}

// set up wiring
wpi.setup('wpi');
wpi.pinMode(LEDPin, wpi.OUTPUT);
sensor = new BME280(BME280_OPTION);
sensor.init()
  .then(function () {
    sendingMessage = true;
  })
  .catch(function (err) {
    console.error(err.message || err);
  });

// create a client
client = Client.fromConnectionString(connectionString, Protocol);

client.open(function (err) {
  if (err) {
    console.error('[IoT hub Client] Connect error: ' + err.message);
    return;
  }

  // set C2D and device method callback
  client.onDeviceMethod('start', onStart);
  client.onDeviceMethod('stop', onStop);
  client.on('message', receiveMessageCallback);
  setInterval(sendMessage, 2000); //adjust the rate at which messages are sent with the setInterval function by changing the 2000 to any other value in millisecond
});
