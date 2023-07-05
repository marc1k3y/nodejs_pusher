import express from "express";
import { scheduleJob, RecurrenceRule } from "node-schedule";
import { MongoClient, ObjectId } from "mongodb";
import { postMessage, sendServiceMessage } from "./bot.js";
import { parseEventPage, scrapEventLinks, scrapLastPageNumber, resources } from "./parser.js";

const client = new MongoClient(process.env.MONGO_API);

const app = express();

function serviceLog(msg) {
  sendServiceMessage(msg);
  console.log(msg);
}

// app variables
let period = "";
let status = false;

// remote control
export function disableRC() {
  status = false;
  serviceLog("program stop");
}

export async function enableRC() {
  status = true;
  serviceLog("program start")
}

function setTomorrowPeriod() {
  const today = new Date();
  let tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  period = tomorrow.toISOString().split("T")[0];
}

// need refactoring
async function publicationScript() {
  const scheduled = await client.db("events").collection("scheduled").find().toArray();
  const eventIndex = parseInt(Math.random() * scheduled.length);
  serviceLog(`start scraping event: ${scheduled[eventIndex]["link"].split("/").slice(3).join("/")}`)
  const event = await parseEventPage(resources.culture, scheduled[eventIndex]["link"].split("/").slice(3).join("/"));
  const postMessageResult = await postMessage(event);
  if (postMessageResult) {
    const insertToPosted = await client.db("events").collection("posted").insertOne({ link: scheduled[eventIndex]["link"] });
    if (insertToPosted.acknowledged && insertToPosted.insertedId) {
      const removeFromScheduled = await client.db("events").collection("scheduled").deleteOne({ _id: new ObjectId(scheduled[eventIndex]["_id"]) });
      if (removeFromScheduled.acknowledged) return true;
    }
  }
}

function filterEventLinks(scheduledEventsDB, postedEventsDB, eventLinks) {
  function concatFormatDbArrays() {
    let scheduled = [];
    let posted = [];
    for (let item in scheduledEventsDB) {
      scheduled.push(scheduledEventsDB[item]["link"]);
    }
    for (let item in postedEventsDB) {
      posted.push(postedEventsDB[item]["link"]);
    }
    const dbArrays = scheduled.concat(posted);

    for (let i = eventLinks.length - 1; i >= 0; i--) {
      for (let j = 0; j < dbArrays.length; j++) {
        if (eventLinks[i] && (eventLinks[i] === dbArrays[j])) {
          eventLinks.splice(i, 1);
        }
      }
    }

    return eventLinks;
  }

  function filterSortRemoveDuplicate(arr) {
    let sorted_arr = arr.slice().sort((a, b) => {
      const keyA = a.split("/")[5];
      const keyB = b.split("/")[5];

      if (keyA < keyB) return -1;
      if (keyA > keyB) return 1;
      return 0;
    });
    sorted_arr = sorted_arr.filter((item) => !item.includes("odnogo"));
    let results = [];
    for (let i = 0; i < sorted_arr.length - 1; i++) {
      if (sorted_arr[i + 1].split("/")[5] !== sorted_arr[i].split("/")[5]) {
        results.push(sorted_arr[i]);
      }
    }
    return results;
  }

  function formatArrayForDb(arr) {
    let result = [];
    for (let item in arr) {
      result.push({ link: arr[item] });
    }
    return result;
  }

  const concatedLinks = concatFormatDbArrays();
  eventLinks = filterSortRemoveDuplicate(concatedLinks);
  eventLinks = formatArrayForDb(eventLinks);

  return eventLinks;
}

// DATABASE
async function getSavedEventLinks() {
  const scheduledEventsDB = await client.db("events").collection("scheduled").find().toArray();
  const postedEventsDB = await client.db("events").collection("posted").find().toArray();
  return { scheduledEventsDB, postedEventsDB };
}

async function saveScheduledEventLinks(eventLinks) {
  const result = await client.db("events").collection("scheduled").insertMany(eventLinks);
  return result.insertedCount;
}

async function deleteAllScheduled() {
  const result = await client.db("events").collection("scheduled").deleteMany({});
  return result.deletedCount;
}

// SCHEDULER
const morningRule = new RecurrenceRule();
morningRule.hour = 7;
morningRule.minute = 30;
morningRule.tz = "Europe/Moscow";

const nightRule = new RecurrenceRule();
nightRule.hour = 20;
nightRule.minute = 30;
nightRule.tz = "Europe/Moscow";

async function morningScript() {
  setTomorrowPeriod();
  const lastPageNumber = await scrapLastPageNumber(resources.culture, period);
  const eventLinks = await scrapEventLinks(lastPageNumber, period);
  const { scheduledEventsDB, postedEventsDB } = await getSavedEventLinks();
  const filteredEventLinks = filterEventLinks(scheduledEventsDB, postedEventsDB, eventLinks);
  const result = await saveScheduledEventLinks(filteredEventLinks);
  if (result) {
    serviceLog(`[+] Morning script complete successfull, set ${period}, saved ${result} links`);
    status = true;
  }
}

async function nightScript() {
  const result = await deleteAllScheduled();
  status = false;
  serviceLog(`[+] Night script completed successful, deleted ${result} scheduled events`);
}

scheduleJob(morningRule, () => morningScript());
scheduleJob(nightRule, () => nightScript());

scheduleJob("0 */3 * * *", async () => {
  if (status) {
    const result = await publicationScript();
    if (result) serviceLog("[+] post successful sended!")
  } else {
    serviceLog("scrapper disabled :(");
  }
});


app.listen(process.env.PORT || 3000, () => {
  serviceLog("[+] server started")
  client.connect().then(() => serviceLog("[+] mongo cli connection established!"));
});