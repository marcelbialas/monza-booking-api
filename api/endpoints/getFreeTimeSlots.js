const express = require("express");

// ? IMPORTS FOR REQUESTS/HELPER
const moment = require("moment-timezone"); // * Date formatting etc

// ? API RELATED IMPORTS
let privatekey = require("../credentials/privatekey.json");
const { google } = require("googleapis");
//const authenticateToken = require("./../auth/auth")

// ? SETTING UP
const app = express();
const router = express.Router();
app.use(express.json()); //Used to parse JSON bodies
app.use(express.urlencoded()); //Parse URL-encoded bodies

// ! CONFIGURE JWT FOR GOOGLE CAL AUTH
let jwtClient = new google.auth.JWT(
  privatekey.client_email,
  null,
  privatekey.private_key,
  ["https://www.googleapis.com/auth/calendar"]
);

/**
 * ! ***************************************************************
 * ! API-ENDPOINT, POST, "/slots" --> ADDS EVENT TO GOOGLE CALENDAR
 * ! ***************************************************************
 */

router.post("/slots", (req, res) => {
  // ? IF DATE IS VALID --> SEND REQUEST
  if (moment(req.body.date).isValid()) {
    console.log(moment(req.body.date).tz("Europe/Amsterdam"));

    // ? Configure selected Times & Business Hours
    const selectedDate = moment(req.body.date).tz("Europe/Amsterdam"); //YYYY-MM-DDTHH:MM:SSOZ
    const selectedDateWeekday = selectedDate.format("dddd"); // Weekday (Friday)

    // * FALLBACK --> RETURNS NOTHING, BETTER THAN FALSE DATA
    let timeMin = selectedDate.format("YYYY-MM-DDT06:00:00");
    let timeMax = selectedDate.format("YYYY-MM-DDT07:00:00");

    const MoToThu = ["Monday", "Tuesday", "Wednesday", "Thursday"];

    if (MoToThu.includes(selectedDateWeekday)) {
      timeMax = selectedDate.format("YYYY-MM-DDT21:00:00Z");
      timeMin = selectedDate.format("YYYY-MM-DDT16:00:00Z");
    } else if (selectedDateWeekday === "Friday") {
      timeMax = selectedDate.format("YYYY-MM-DDT23:00:00Z");
      timeMin = selectedDate.format("YYYY-MM-DDT16:00:00Z");
    } else if (selectedDateWeekday === "Saturday") {
      timeMax = selectedDate.format("YYYY-MM-DDT23:00:00Z");
      timeMin = selectedDate.format("YYYY-MM-DDT11:00:00Z");
    } else {
      timeMax = selectedDate.format("YYYY-MM-DDT22:00:00Z");
      timeMin = selectedDate.format("YYYY-MM-DDT11:00:00Z");
    }

    /**
     * TODO: ADD SPECIAL OPENING HOURS, EG; CHRISTMAS ETC
     */

    new Promise((resolve, reject) => {
      timeslotsBusy = [];

      jwtClient.authorize((err, tokens) => {
        if (err) {
          reject(err);
        } else {
          // * IF AUTHORIZATION WAS SUCCESFULLY
          const oauth2Client = new google.auth.OAuth2(
            privatekey.client_id,
            privatekey.private_key
          );
          oauth2Client.setCredentials({
            refresh_token: tokens.refresh_token,
            access_token: tokens.access_token,
          });

          getCalData = (dateStart, dateEnd) => {
            const calendar = google.calendar({
              version: "v3",
              auth: oauth2Client,
            });
            const calendarId = "monzaXXXX@group.calendar.google.com";

            calendar.freebusy.query(
              {
                auth: oauth2Client,
                resource: {
                  items: [{ id: calendarId, busy: "Active" }],
                  timeMin: dateStart,
                  timeMax: dateEnd,
                  timeZone: "Europe/Amsterdam",
                },
              },
              (err, response) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(response.data.calendars[calendarId].busy);
                  const resp = response.data.calendars[calendarId];
                  console.log(response.data.calendars[calendarId]);

                  resp.busy.forEach((item) => {
                    /*
                     * MAKE TIMESLOTS FOR BUSY TIMES
                     */
                    const mtimeMin = moment(item.start)
                      .subtract(60, "minutes")
                      .tz("Europe/Amsterdam");
                    const busyEndTime = moment(item.end).subtract(
                      30,
                      "minutes"
                    );
                    console.log(busyEndTime);

                    // ! PREVENT SERVER FROM CRASHING WITH 15 MINUTES TIMES
                    const notAllowedMinutes = ["15", "45"];
                    if (
                      !notAllowedMinutes.includes(busyEndTime.format("mm")) &&
                      !notAllowedMinutes.includes(mtimeMin.format("mm"))
                    ) {
                      var starttime = mtimeMin;
                      var endtime = busyEndTime.format("HH:mm");
                      console.log(busyEndTime);
                      var interval = "30";
                      var timeslots = [starttime];

                      getTimeSlots = (time, minutes) => {
                        var date = moment(time, "HH:mm").add(
                          minutes,
                          "minutes"
                        );
                        var tempTime = date.format("HH:mm");
                        console.log(tempTime + "tt");
                        return tempTime;
                      };

                      console.log(busyEndTime);
                      while (starttime !== endtime) {
                        starttime = getTimeSlots(starttime, interval);
                        console.log(busyEndTime);
                        timeslots.push(starttime);
                      }
                      timeslotsBusy.push(timeslots);
                    } else {
                      res.sendStatus(500);
                    }
                  });
                }
              }
            );
          };
          getCalData(timeMin, timeMax);
        }
      });
    })
      .then((value) => {
        /*
         * MAKE TIMESLOTS FOR FREE TIMES
         */
        const mtimeMin = moment(timeMin);
        const mtimeMax2 = moment(timeMax);

        var starttime = mtimeMin.format("HH:mm");
        var interval = "30";
        var endtime2 = moment(mtimeMax2).subtract(1, "hour").format("HH:mm");
        var timeslots = [starttime];

        function getTimeSlots(time, minutes) {
          var date = new Date(
            new Date("01/01/2015 " + time).getTime() + minutes * 60000
          );
          var tempTime =
            (date.getHours().toString().length === 1
              ? "0" + date.getHours()
              : date.getHours()) +
            ":" +
            (date.getMinutes().toString().length === 1
              ? "0" + date.getMinutes()
              : date.getMinutes());
          return tempTime;
        }

        while (starttime !== endtime2) {
          starttime = getTimeSlots(starttime, interval);
          timeslots.push(starttime);
        }
        /**
         * * REMOVE BUSY SLOTS FROM FREE SLOTS
         */
        function removeItemAll(arr, value) {
          var i = 0;
          while (i < arr.length) {
            if (arr[i] === value) {
              arr.splice(i, 1);
            } else {
              ++i;
            }
          }
          return arr;
        }
        // ? GET INNER ARRAY AND OUTER ARRAY
        for (i = 0; i < timeslotsBusy.length; i++) {
          for (j = 0; j < timeslotsBusy[i].length; j++) {
            removeItemAll(timeslots, timeslotsBusy[i][j]);
          }
        }
        res.send(timeslots);
        return;
      })
      .catch((err) => {
        res.sendStatus(404);
        throw err;
      });
  } else {
    res.send({ err: "Bitte gültiges Datum angeben" });
  }
});

module.exports = router;
