const express = require("express");
const router = express.Router();

/* IMPORTS FOR REQUESTS/HELPER */
const moment = require("moment");
let nodeMailer = require("nodemailer");
const { body, validationResult } = require("express-validator");

// IMPORTS NEEDED BY NODE/EXPRESS
const bodyParser = require("body-parser");
const jsonParser = bodyParser.json();

/* API IMPORTS */
let privatekey = require("./../credentials/privatekey.json");
const { google } = require("googleapis");
const authenticateToken = require("./../auth/auth");

/* SETTING UP */
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

let events = [];

/* CONFIGURE JWT FOR API AUTH */
let jwtClient = new google.auth.JWT(
  privatekey.client_email,
  null,
  privatekey.private_key,
  ["https://www.googleapis.com/auth/calendar"]
);

/**
 * ! *********************************************************
 * ! API-ENDPOINT, POST, "/" --> ADDS EVENT TO GOOGLE CALENDAR
 * ! *********************************************************
 */

router.post(
  "/",
  jsonParser,
  authenticateToken,
  /**
   * TODO: ADD OTHER FIELDS AND USE VALIDATIONRESULT
   */
  [
    body("email").isEmail().normalizeEmail(),
    body("selectedRace").not().isEmpty().trim().escape(),
    body("message").not().isEmpty().trim().escape(), // ??
  ],
  (req, res) => {
    // ? SETTING UP VARIABLES FROM THE FRONTEND
    const selectedRace = req.body.selectedRace;
    /**
     * TODO: ADD CHECK FOR OTHER VARIABLES IF UNDEFINED/EMPTY: ERROR
     */
    if (selectedRace === undefined || selectedRace === "") {
      res.send("Fehler: Es wurden nicht alle Felder ausgefüllt");
    } else {
      const firma = req.body.firma;
      const dataPrivacy = req.body.dataPrivacy; // TODO: IF NOT CHECKED, SEND ERROR
      const allowNews = req.body.allowNews; // TODO: ADD E-MAIL AND CLIENT DATE TO CRM (WeClapp? API?)
      let firstName = req.body.firstName;
      let firmaOrFirstName = req.body.firstName;
      const lastName = req.body.lastName;
      const email = req.body.email;
      const tel = req.body.tel;
      const pers = req.body.pers;
      const message = req.body.message;

      if (firma !== undefined && firma !== "") {
        // !! NOT WORKING CORRECTLY, OTHER WAY?
        firmaOrFirstName = firma + " - " + firstName;
      } else {
        firmaOrFirstName = firstName;
      }

      // ? JWT AUTHORIZATION FOR CLIENT
      jwtClient.authorize(function (err, tokens) {
        if (err) {
          console.log(err);
          return;
        } else {
          // * AUTHORIZATION SUCCESSFUL, AUTHORIZE AS CLIENT AND SEND REQUEST
          const oauth2Client = new google.auth.OAuth2(
            privatekey.client_id,
            privatekey.private_key
          );
          oauth2Client.setCredentials({
            refresh_token: tokens.refresh_token,
            access_token: tokens.access_token,
          });

          /**
           * * GET DATA FROM USER INPUT "eventDate and selectedTime"
           */
          const selectedEventDate = moment(new Date(req.body.eventDate));
          const selectedEventTime = req.body.selectedTime;

          /**
           * * BUILD ONE DATE FOR CAL_API
           */
          const raceStartDate = selectedEventDate.format("YYYY-MM-DDT");
          const start = raceStartDate + selectedEventTime + ":00";

          /**
           * * ADD DESIRED TIMESLOT DUARATION (1 Hour)
           */
          const endDatePlus1 = new Date(start);
          endDatePlus1.setHours(endDatePlus1.getHours() + 1);

          /**
           * * CONFIGURE eventData FOR SENDING TO GOOGLE
           */
          var eventData = {
            calendarId: "XXXX@group.calendar.google.com",
            auth: oauth2Client,
            status: "tentative", // !! Not doing anything right now ?
            resource: {
              summary: `${firmaOrFirstName} ${lastName}: ${selectedRace} - ${pers} Fahrer`,
              //'location': 'Monza Indoor Kart GmbH, Dorstener Straße 360, 44653 Herne',
              description: `<a href="https://mail.google.com/mail/u/0/?view=cm&fs=1&to=${email}&su=Buchungsbestätigung+Monza+Indoor+Kart+GmbH&body=${
                "Hallo+" +
                firstName +
                ",%0d%0dHiermit+bestätigen+wir+dir+deine+Buchung+für+den+" +
                selectedEventDate.format("DD.MM.YYYY") +
                "%0d%0dZusammenfassung:%0d%0dRennen:+" +
                selectedRace.split(" ").join("+") +
                "%0dPersonenzahl:+" +
                pers +
                "%0d"
              }&tf=1">Bestätigen</a> / <a href="#">Absagen</a>

                            Name: ${firstName} ${lastName}
                            E-Mail: ${email}
                            Tel.: ${tel}
                            Rennen ${selectedRace}
                            ${req.body.pers} Personen
                            ${start}
                            Anmerkung: ${message}`,
              start: {
                dateTime: start,
                timeZone: "Europe/Amsterdam",
              },
              end: {
                dateTime: endDatePlus1,
                timeZone: "Europe/Amsterdam",
              },
              attendees: {
                email: "XXXX@monza.de",
                responseStatus: "accepted",
              },
              //'colorId': 4,
            },
          };

          const calendar = google.calendar({
            version: "v3",
            auth: oauth2Client,
          });
          calendar.events.insert(eventData, function (err, event) {
            if (err) {
              console.log(err);
              res.send(
                "Bei der übermittelung der Daten ist ein Fehler aufgetreten, bitte versuchen Sie es erneut."
              );
            } else {
              events.push(event);
              console.log(event.data.htmlLink);
              res.send(
                `Wir haben deine Buchung erhalten, wir bestätigen dir diese innerhalb eines Werktages.`
              );

              /**
               * ! SEND E-MAIl WITH LINK TO EVENT TO US
               */

              let transporter = nodeMailer.createTransport({
                host: "smtp.XXX.de", // TODO: Replace with Google SMTP, and whitelist in GSuite Admin
                port: 465,
                secure: true,
                auth: {
                  user: "XXX",
                  pass: "XXX",
                },
              });
              let mailOptions = {
                to: "XXX", // TODO: should be monza@monza or group
                subject: "Neue Buchungsanfrage",
                html: "Neue Anfrage:" + event.data.htmlLink,
              };
              transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                  return console.log(error);
                }
                console.log(
                  "Message %s sent: %s",
                  info.messageId,
                  info.response
                );
              });
            }
          });
        }
      });
    }
  }
);

module.exports = router;
