const express = require("express");

const moment = require("moment-timezone");

const bodyParser = require("body-parser");
const jsonParser = bodyParser.json();

let privatekey = require("../credentials/privatekey.json");
const { google } = require("googleapis");

const app = express();
const router = express.Router();
app.use(bodyParser.urlencoded({ extended: false }));

let jwtClient = new google.auth.JWT(
  privatekey.client_email,
  null,
  privatekey.private_key,
  ["https://www.googleapis.com/auth/calendar"]
);

router.post("/timeslots", jsonParser, (req, res) => {
  console.log(req.body);
  if (moment(req.body.date).isValid()) {
    const selectedDate = moment(req.body.date).tz("Europe/Amsterdam");
    const selectedDateWeekday = selectedDate.format("dddd");

    const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday"];
    if (weekdays.includes(selectedDateWeekday)) {
      var openHoursStart = moment(selectedDate).set({
        hour: "16",
        minute: "00",
      });
      var openHoursEnd = moment(selectedDate).set({ hour: "21", minute: "00" });
    } else if (selectedDateWeekday === "Friday") {
      openHoursStart = moment(selectedDate).set({ hour: "16", minute: "00" });
      openHoursEnd = moment(selectedDate).set({ hour: "23", minute: "00" });
    } else if (selectedDateWeekday === "Saturday") {
      openHoursStart = moment(selectedDate).set({ hour: "11", minute: "00" });
      openHoursEnd = moment(selectedDate).set({ hour: "23", minute: "00" });
    } else {
      openHoursStart = moment(selectedDate).set({ hour: "11", minute: "00" });
      openHoursEnd = moment(selectedDate).set({ hour: "22", minute: "00" });
    }
  }

  new Promise((resolve, reject) => {
    timeslotsBusy = [];
    timeslotsFree = [];
    console.log("test");

    jwtClient.authorize((err, tokens) => {
      if (err) {
        console.log(err);
        res.sendStatus(500);
        reject(err);
      } else {
        const oauth2Client = new google.auth.OAuth2(
          privatekey.client_id,
          privatekey.private_key
        );
        oauth2Client.setCredentials({
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token,
        });
        const calendarId = "monzaXXXXX@group.calendar.google.com";
        const date = moment(req.body.date);
        freeBusyRequest(
          openHoursStart,
          openHoursEnd,
          oauth2Client,
          calendarId,
          date
        )
          .then(() => {
            // ? Make free timeslots
            var opensAt = moment(openHoursStart).format("HH:mm");
            var closesAt = moment(openHoursEnd)
              .subtract(1, "hour")
              .format("HH:mm");

            const interval = 30;
            const freeTimeSlots = [opensAt];

            while (opensAt !== closesAt) {
              opensAt = makeTimeSlots(opensAt, interval);
              freeTimeSlots.push(opensAt);
            }
            resolve(timeslotsFree.push(freeTimeSlots));

            const timeslotsFreeFlat = [].concat(...freeTimeSlots);
            const timeslotsBusyFlat = [].concat(...timeslotsBusy);

            const output = timeslotsFreeFlat.filter(
              (item) => !timeslotsBusyFlat.includes(item)
            );
            res.send(output);
            return output;
          })
          .catch((err) => {
            console.log(err);
            res.sendStatus(500);
          });
      }
    });
  });

  async function freeBusyRequest(
    openHoursStart,
    openHoursEnd,
    oauth2Client,
    calendarId,
    selectedDate
  ) {
    const response = await getCalData(
      openHoursStart,
      openHoursEnd,
      oauth2Client
    );

    let busyTimeSlots = [];

    await response.data.calendars[calendarId].busy.forEach((time) => {
      let startTime = moment(time.start)
        .subtract("30", "minutes")
        .tz("Europe/Amsterdam");
      let endTime = moment(time.end)
        .subtract("30", "minutes")
        .tz("Europe/Amsterdam");

      const interval = "30";
      const notAllowedMinutes = ["15", "45"];

      if (
        notAllowedMinutes.includes(endTime.format("mm")) ||
        notAllowedMinutes.includes(startTime.format("mm"))
      ) {
        res.send(["error"]);
        console.log(
          `Am ausgewählten Kalendertag ${selectedDate.format(
            "DD.MM.YYYY"
          )} sind invalide Termine eingetragen`
        );
      } else {
        var st = startTime.format("HH:mm");
        var et = endTime.format("HH:mm");

        while (st !== et) {
          st = makeTimeSlots(st, interval);
          busyTimeSlots.push(st);
        }
      }
    });
    await timeslotsBusy.push(busyTimeSlots);
  }
  makeTimeSlots = (time, interval) => {
    var date = moment(time, "HH:mm").add(interval, "minutes");
    var tempTime = date.format("HH:mm");
    return tempTime;
  };

  getCalData = async (startTime, endTime, auth) => {
    const calendar = google.calendar({ version: "v3", auth: auth });
    const calendarId = "monzaXXXX@group.calendar.google.com";

    const freeBusy = await calendar.freebusy.query({
      auth: auth,
      resource: {
        items: [{ id: calendarId, budy: "Active" }],
        timeMin: startTime,
        timeMax: endTime,
        timeZone: "Europe/Amsterdam",
      },
    });
    return freeBusy;
  };
});

module.exports = router;
