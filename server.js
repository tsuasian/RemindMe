import {RTMClient, WebClient} from '@slack/client'
import {google} from 'googleapis'
import express from 'express'
import bodyParser from 'body-parser'
import axios from 'axios';
import models from "./models/models"
import mongoose from 'mongoose'
const path = require('path');
const fs = require('fs');
const assert = require('assert')
const User = models.User

let slackID;
let isMeeting = false;
let calenderData = []
let meetingData = []
const app = express()
const token = process.env.SLACK_TOKEN;
const rtm = new RTMClient(token);
const web = new WebClient(token);

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

//mongo
if (! fs.existsSync('./env.sh')) {
  throw new Error('env.sh file is missing');
}
if (! process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is not in the environmental variables. Try running 'source env.sh'");
}
mongoose.connection.on('connected', function() {
  console.log('Success: connected to MongoDb!');
});
mongoose.connection.on('error', function() {
  console.log('Error connecting to MongoDb. Check MONGODB_URI in env.sh');
  process.exit(1);
});
mongoose.connect(process.env.MONGODB_URI);

const oauth2Client = new google.auth.OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.REDIRECT_URL)

function createAuthUrl(slackId) {
  console.log("ENTERED CREATE AUTH URL", slackId);
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    state: slackId,
    scope: ['https://www.googleapis.com/auth/calendar']
  })
  rtm.sendMessage(`Click on the following url ${authUrl}`, conversationId, (err, res) => {
    if (res) {
      console.log("success")
      // makeCalendarAPICall(token, time, subject, date)
    } else {
      console.log("failure")
    }
  })
}

// Google API create cal event

function makeCalendarAPICall(token, startfullTimeDate, subject, date, isMeeting, endfullTimeDate, invArr) {
  const oauth2Client = new google.auth.OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.REDIRECT_URL)
  console.log("THIS IS WHAT IS CONTAINED IN TOKEN: ", token);
  let authToken=token.access_token;
  oauth2Client.setCredentials(token)
  // console.log("TIME CHECK", time);
  // console.log("DATE", date);

  oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      // store the refresh_token in my database!
      console.log(tokens.refresh_token);
    }
    console.log(tokens.access_token);
  });

  const calendar = google.calendar({version: 'v3', auth: oauth2Client});
  // console.log('THIS IS TIME FAM BAM: ', time);
  if (isMeeting) {

    // for (let i = 0; i<invArr.length; i++) {
    //   findEmail(invArr[i])
    // }
    const attendees = invArr.map((name) => {
      email: FindEmail(name);
    }) //db  query here to pull email
    calendar.events.insert({
      calendarId: 'primary', // Go to setting on your calendar to get Id
      'resource': {
        'summary': "Meeting",
        'description': subject,
        'start': {
          'dateTime': startfullTimeDate,
          'timeZone': 'America/Los_Angeles'
        },
        'end': {
          'dateTime': endfullTimeDate,
          'timeZone': 'America/Los_Angeles'
        },
        'attendees': attendees
      }
    }, (err, {data}) => {
      if (err)
        return console.log('The API returned an error: ' + err);
      console.log(data)
    })
  }
  else {
  console.log("CALENDAR TEST FAM");
  calendar.events.insert({
    calendarId: 'primary', // Go to setting on your calendar to get Id
    'resource': {
      'summary': subject,
      'description': subject,
      'start': {
        'dateTime': startfullTimeDate,
        'timeZone': 'America/Los_Angeles'
      },
      'end': {
        'dateTime': startfullTimeDate,
        'timeZone': 'America/Los_Angeles'
      },
      'attendees': [
        {
          'email': 'tchang2017@example.com'
        }
      ]
    }
  }, (err, {data}) => {
    if (err)
      return console.log('The API returned an error: ' + err);
    console.log(data)
  })
  }
  return;

  // calendar.events.list({
  //   calendarId: 'primary', // Go to setting on your calendar to get Id
  //   timeMin: (new Date()).toISOString(),
  //   maxResults: 10,
  //   singleEvents: true,
  //   orderBy: 'startTime'
  // }, (err, {data}) => {
  //   if (err)
  //     return console.log('The API returned an error: ' + err);
  //   const events = data.items;
  //   if (events.length) {
  //     console.log('Upcoming 10 events:');
  //     events.map((event, i) => {
  //       const start = event.start.dateTime || event.start.date;
  //       console.log(`${start} - ${event.summary}`);
  //     });
  //   } else {
  //     console.log('No upcoming events found.');
  //   }
  // });
}

// Google OAuth2 callback
app.get(process.env.REDIRECT_URL.replace(/https?:\/\/.+\//, '/'), (req, res) => {
  oauth2Client.getToken(req.query.code, function(err, token) {
    if (err) return console.error(err.message)
    console.log("req query state", req.query.state)
      //HERE IS WHERE YOU LOOK AT TOKEN
      // web._makeAPICall('users.profile.get', null, {
      //   user: slackID, //optional user param
      // }, function(err, info) {
      //    //err is set if there was an error
      //    console.log("Info", info)
      //    var newUser = new User({
      //      accessToken: token.access_token,
      //      refreshToken: token.refresh_token,
      //      slackID: slackID
      //    })
      //    newUser.save()
      //    .then((saved) => console.log("user token saved", saved))
      //    .catch((err) => console.log("user not saved", err))
      //    if (!err) {
      //        console.log("not err");
      //    }
      // });
    axios.get(`https://slack.com/api/users.info?token=${process.env.ACCESS_TOKEN}&user=${req.query.state}`)
    .then((res) => {
      console.log("axios response", res.data)
      // let email = res.data.profile.email
      // console.log("email", email)
      // console.log("user token", token)
      let email = String(res.data.user.profile.email)
      let oldName = String(res.data.user.profile["real_name"])
      let newName=oldName.split(" ")[0];
      var newUser = new User({
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        slackID: slackID,
        slackEmail: email,
        slackName: newName
      })
      newUser.save()
      .then((saved) => console.log("user token saved", saved))
      .catch((err) => console.log("user not saved", err))
      // console.log('token', token, 'req.query:', req.query)  req.query.state <- meta-data
    })
  //   var newUser = new User({
  //     accessToken: token.access_token,
  //     refreshToken: token.refresh_token,
  //     slackID: req.query.state,
  //     // slackEmail: email
  //   })
  //   newUser.save()
  //   .then((saved) => console.log("user token saved", saved))
  //   .catch((err) => console.log("user not saved", err))
  // })
  })
  res.send('All set!')
})

rtm.start();

let conversationId;

rtm.on('message', function(event) {
  conversationId = event.channel
  // console.log("Event", event)
;  // console.log("THIS IS EVENT " ,event);
  // console.log("THIS IS COMPARISON TEST FAM: ",event.bot_id,event.user);
  if (event.previous_message)
    console.log('@@@@', JSON.stringify(event.previous_message, null, 2))
  if (event.bot_id) {
    return;
  } else {
    slackID = event.user;
    console.log("event user", event.user)
    DialogFlow(event.text, event.user)
  }
})

// slack Webhook
app.post('/slack', (req, res) => {
  console.log("reached /slack route")
  console.log('>>>', JSON.parse(req.body.payload))
  res.end()
})

app.listen(1337)

const dialogflow = require('dialogflow');
const sessionClient = new dialogflow.SessionsClient();

//send user text to dialogflow
function DialogFlow(text, id) {
  let unicorn = id
  const sessionId = id;
  const sessionPath = sessionClient.sessionPath(process.env.DIALOGFLOW_PROJECT_ID, sessionId);

  let request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: text,
        languageCode: 'en-US'
      }
    }
  };

  sessionClient.detectIntent(request).then(responses => {
    const result = responses[0].queryResult;
    if (result.intent) {
      //THIS IS WHERE WE CAN DETECT WHAT THE INTENT IS
      console.log(`  Intent: ${result.intent.displayName}`);
      if (result.fulfillmentText) {
        console.log("IF STATEMENT 1");
        rtm.sendMessage(result.fulfillmentText, conversationId, (err, res) => {
          if (res) {
            console.log("dialog response sent", res)
          } else {
            console.log("dialog error, err")
          }
        })
      } else if (result.intent.displayName == 'reminder:add') {
        isMeeting = false;
        console.log("IF STATEMENT 2");
        console.log("fields i want to parse", result.parameters.fields)
        let time = result.parameters.fields.time.stringValue;
        let parsedTime = time.slice(11, time.length)
        let subject = result.parameters.fields.subject.stringValue;
        let date = result.parameters.fields.date.stringValue;
        console.log("THIS IS THE DATE OBJECT: ", new Date(date));
        let parsedDate = date.slice(0, 11)
        let fullTimeDate = parsedDate.concat(parsedTime)
        console.log("THIS IS FULL TIME DATE FAM: ", fullTimeDate)
        User.findOne({slackID: slackID}).then((user) => {
          if (user) {
            let token = {
              access_token: user.accessToken,
              refresh_token: user.refreshToken,
              scope: 'https://www.googleapis.com/auth/calendar',
              expiry_date: 1534290086191
            }
            calenderData.push(token, fullTimeDate, subject, date,isMeeting)
            console.log("THIS IS CHANNEL: ", conversationId);
            web.chat.postMessage({
              channel: conversationId,
              text: 'Set Reminder',
              "attachments": [
                {
                  "fields": [
                    {
                      "title": "Subject",
                      "value": subject
                    }, {
                      "title": "Date",
                      "value": date
                    }
                  ],
                  "fallback": "You are unable to choose a game",
                  "callback_id": "wopr game",
                  "color": "#3AA3E3",
                  "attachment_type": "default",
                  "actions": [
                    {
                      "name": "yes",
                      "text": "Confirm",
                      "type": "button",
                      "value": "true"
                    }, {
                      "name": "no",
                      "text": "Cancel",
                      "type": "button",
                      "value": "false"
                    }
                  ]
                }
              ]
            }).then((res) => {
              console.log("THIS IS RES", res);
            }).catch((err) => console.log("ERROR FAM: ", err));
          } else {
            console.log("User not found so create new token", unicorn);
            createAuthUrl(unicorn);
          }
        }).catch((err) => {
          console.log("user not found: this is error fam ", err)
        })
      }
      else if (result.intent.displayName == "schedule:add") {
      isMeeting = true;
      console.log("IN RESULT SCHEDULE:ADD");
      User.findOne({slackID: unicorn}).then((user) => {
        console.log("IN USER.FIND ONE")
        if (user) {
          let token = {
            access_token: user.accessToken,
            refresh_token: user.refreshToken,
            scope: 'https://www.googleapis.com/auth/calendar',
            expiry_date: 1534290086191
          }
          // console.log("THIS IS RESULT TESTING START", result.parameters.fields["time-period"].structValue.fields.startTime);
          // console.log("THIS IS RESULT TESTING END TIME", result.parameters.fields["time-period"].structValue.fields.endTime);

          let startTime = result.parameters.fields["time-period"].structValue.fields.startTime.stringValue;
          let endTime=result.parameters.fields["time-period"].structValue.fields.endTime.stringValue;
          // console.log("results invitees", result.parameters.fields.invitees.listValue.values)
          let invitees = result.parameters.fields.invitees.listValue.values
          let inviteesArr = []
          for (let i = 0; i < invitees.length; i++) {
            let name = invitees[i].stringValue
            inviteesArr.push(name)
          }
          let startparsedTime = startTime.slice(11, startTime.length);
          let endparsedTime=endTime.slice(11,endTime.length);
          let subject = result.parameters.fields.subject.stringValue;
          //THIS IS THE DATE
          let date = result.parameters.fields.date.stringValue;
          // console.log("THIS IS THE DATE OBJECT: ", new Date(date));
          let parsedDate = date.slice(0, 11)
          let startfullTimeDate = parsedDate.concat(startparsedTime);
          let endfullTimeDate=parsedDate.concat(endparsedTime);
          // console.log("STARTFULLTIMEDATE",startfullTimeDate);
          // console.log("ENDFULLTIMEDATE",endfullTimeDate);
          meetingData.push(token, startfullTimeDate, subject, date, isMeeting, endfullTimeDate, inviteesArr);
          console.log("calenderData arr ", calenderData)
          // console.log("THIS IS CHANNEL: ", conversationId);
          // console.log("THIS IS RESULTS FOR MEETING: ",result);
          web.chat.postMessage({
            channel: conversationId,
            text: 'Set Meeting',
            "attachments": [
              {
                "fields": [
                  {
                    "title": "Meeting With",
                    "value": inviteesArr.join(', ')
                  }, {
                    "title": "Date",
                    "value":startfullTimeDate
                  }
                ],
                "fallback": "You are unable to choose a game",
                "callback_id": "wopr game",
                "color": "#3AA3E3",
                "attachment_type": "default",
                "actions": [
                  {
                    "name": "yes",
                    "text": "Confirm",
                    "type": "button",
                    "value": "true"
                  }, {
                    "name": "no",
                    "text": "Cancel",
                    "type": "button",
                    "value": "false"
                  }
                ]
              }
            ]
          }).then((res) => {
            console.log("THIS IS RES", res);
          }).catch((err) => console.log("ERROR FAM: ", err));
        } else {
          console.log("unicorn", unicorn);
          createAuthUrl(unicorn);
        }
      }).catch((err) => {
        console.log("user not found: this is error fam ", err)
      })
    } else {
      console.log("No intent matched.");
    }
  }
}).catch((err) => {
    //this is the catch for the sessionclient.detect (dialogFlow)
    console.error('ERROR:', err);
  });
}

//routes
app.get('/ping', (req, res) =>{
  console.log("pong")
})

//function for getting User Emails
function FindEmail(name){
  User.findOne({slackName:name})
  .then((res) => {
    console.log(res);
  })
}



app.post('/buttonPostConfirm', (req, res) => {
  let payload = JSON.parse(req.body.payload)
  console.log("req payload", payload)
  console.log("payload actions", payload.actions)
  let conversationId = payload.channel.id
  if (payload.actions[0].name === "yes" && payload.original_message.text === "Set Reminder") {
    //somehow call create calender fx, need all data passed to it though
    console.log("calender data arr", calenderData)
    makeCalendarAPICall(calenderData[0], calenderData[1], calenderData[2], calenderData[3])
    rtm.sendMessage("Your reminder has been created in the calender!", conversationId, (err, res) => {
      if (res) {
        console.log("reminder saved post confirm", res)
      } else {
        console.log("cofirm button err", err)
      }
    })
  } else if (payload.actions[0].name === "no" && payload.original_message.text === "Set Reminder") {
    rtm.sendMessage("Reminder canceled", conversationId, (err, res) => {
      if (res) {
        console.log("reminder canceled hit res", res)
      } else {
        console.log("error canceling reminder", err)
      }
    })
  }
  if (payload.actions[0].name === "yes" && payload.original_message.text === "Set Meeting") {
    console.log("hit enter meeting")
    makeCalendarAPICall(meetingData[0], meetingData[1], meetingData[2], meetingData[3], meetingData[4], meetingData[5], meetingData[6])
    rtm.sendMessage("Your Meeting has been created in your calender", conversationId, (err, res) => {
      if (res) {
        console.log("Meeting saved")
      } else {
        console.log("Error creating meeting", err)
      }
    })
  } else if (payload.actions[0].name === "no" && payload.original_message.text === "Set Meeting") {
    rtm.sendMessage("Meeting canceled", conversationId, (err, res) => {
      if (res) {
        console.log("reminder canceled hit res", res)
      } else {
        console.log("error canceling reminder", err)
      }
    })
  }
})

function FindEmail(name){
  console.log("THIS IS THE NAME: ", name);
  User.findOne({slackName:name})
  .then((res) => {
    console.log("THIS IS RES MY FAM BAM: ",res);
  })
}
