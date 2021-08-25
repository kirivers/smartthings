const axios = require('axios');
const BEARER_TOKEN = '';


async function getLocation(){
  //Initializing the fetch for locations
  //Parameters: n/a
  //Returns: Array of location Ids
  const locationOptions = {
    url: 'https://api.smartthings.com/locations',
    method: 'GET',
    headers: {
      'User-Agent': 'request',
      'Authorization': 'Bearer ' + token
    },
  };

  //Fetching locations
  const response = await axios(locationOptions)
  return response.data.items.map(item => item.locationId);
}


async function getSettings(){
  // Initializing each of the fetches for the installed smartapps at given locations
  //Parameters: n/a
  //Returns: Array of settings for severe weather with the added parameter of the location Id for each installation

  const locations = await getLocation();
  const locationInstallationOptions = locations.map(locationId => {
    //constructing URL with particular locationId
    const locationInstallationOptions = {
      url: 'https://graph-na04-useast2.api.smartthings.com/api/smartapps/installations?locationId=' + locationId,
      method: 'GET',
      headers: {
        'User-Agent': 'request',
        'Authorization': 'Bearer ' + token
      },
    };
    //fetch for a given locationId

    const response = await axios(locationInstallationOptions)
    //creates array of true/false values signifying if Severe Weather is in fact installed
    response.data.map(app => {
      if (app.label === "Severe Weather"){
        return {...app.settings, locationId:locationId;
      };
    });
  });
};

//TWC Call
async function twcCall(settings){
  //Parameters: settings of the weather app
  //Returns: Object with latitude and longitude attributes for the given settings

  let twcCall = {
    countryCode: 'US', //Need to automate
    postalCode: settings.zipcode.value,
    language:'en-US', //Need to automate
    format:'json',
    apiKey:'' //This needs to not be made public
  };

  const twcOptions = {
    url: 'https://api.weather.com/v3/location/point?countryCode=' + twcCall.countryCode + '&postalCode=' + twcCall.postalCode + '&language=' + twcCall.language + '&format=' + twcCall.format + '&apiKey=' + twcCall.apiKey,
    method: 'GET',
    headers: {
      'User-Agent': 'request',
      'Authorization': 'Bearer ' + BEARER_TOKEN
    },
  };

  const response = await axios(twcOptions);
  return {latitude:response.location.latitude, longitude:response.location.longitude}

}

async function geoplacePost(latlong,locationId, zipcode){
  //Parameters: The latitude and longitude, the associatedlocation Id, and the zipcode (for naming)
  //Returns the ID of the new Geoplace after creating it

  //New Geoplace
  const geoplaceOptions = {
    url: 'http://geoplace.st.internal/geoplaces',
    method: 'POST',
    headers: {
      'User-Agent': 'request',
      'Authorization': 'Bearer ' + BEARER_TOKEN
    },
    data: {
      "ownerType": "LOCATION",
      "ownerId": locationId,
      "name": zipcode,
      "latitude": latlong.latitude,
      "longitude": latlong.longitude,
      }
  };
  //performing the POST
  const response = await axios(geoplaceOptions);

  const geoplaceIdOptions = {
    url: 'http://geoplace.st.internal/geoplaces?ownerType=LOCATION&ownerId=' + locationId,
    method: 'GET',
    headers: {
      'User-Agent': 'request',
      'Authorization': 'Bearer ' + BEARER_TOKEN
    },
  };
  const idResponse = await axios(geoplaceIdOptions); //need to parse Geoplace Id from the rest of data
}

//Rule creation
function createRule(){
  {
    "actions": [
      {
        "if": {
          "and":{
            "equals": {
              "left": {
                "device": {
                  "devices": [
                    "f522cb3f-e131-401d-a391-7cf32638ef6e"
                  ],
                  "component": "main",
                  "capability": "contactSensor",
                  "attribute": "contact",
                  "trigger": "Always"
                },
                "type": "device"
              },
              "right": {
                "string": "closed",
                "type": "string"
              },
              "aggregation": "Any"
            },
            "type": "equals",
            "then": [
              {
                "command": {
                  "devices": [
                    "6caf1de7-9305-43b7-96f9-afefa6e702fc"
                  ],
                  "commands": [
                    {
                      "component": "main",
                      "capability": "switch",
                      "command": "on"
                    }
                  ],
                  "sequence": {
                    "commands": "Serial",
                    "devices": "Serial"
                  }
                },
                "type": "command"
              }
            ],
            "sequence": {
              "then": "Parallel",
              "else": "Serial"
            }
          },
          "type": "and"
        },
        "type": "if"
      }
    ],
  }
}

async function migrateSevereWeather(token){
  //Migrates the severe weather smartapp
  //Parameters: user's bearer token
  //Return n/a, will post the new rule and geoplace

  //An array of settings objects for each installation
  const settings = await getSettings();
  //For each installation, determine latlong
  const latlongArray = settings.map(setting => {
    return twcCall(setting);
  });
  //Create an array of the geoplace ids for each installation
  let geoplaceIdArray = [];
  for (let i = 0; i < settings.length; i++){
    geoplaceIdArray.push(geoplacePost(latlongArray[i],settings[i].locationId,settings[i].zipcode.value));
  };
}
