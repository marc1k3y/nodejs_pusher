import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { disableRC, enableRC, forcedPublication, setFilterKeyRC } from "./index.js";

const channels = {
  test: 332768026,
  events_vrn: "@culture_vrn",
  cars_413: "@cars_413"
}

const token = process.env.BOT_API;

const bot = new TelegramBot(token, { polling: true });

bot.on("message", (msg) => {
  if (msg.text.includes("set_filter_key")) setFilterKeyRC(msg.text.split(" ")[1]);
  switch (msg.text) {
    case "disable": return disableRC();
    case "enable": return enableRC();
    case "forced_publicatiob": return forcedPublication();
    default: return;
  }
});

export function sendServiceMessage(msg) {
  bot.sendMessage(channels.test, msg);
}

export async function postMessage(object) {
  try {
    const complexStr = object.complex.join(" • ");
    let options = {
      caption: `#${object.genre}\n<b>${object.title}</b>\n\n${complexStr}\n\n${object.place}\n\n${object.description}\n\n<a href='${object.source}'>Источник</a>`,
      parse_mode: "HTML"
    }
    if (options.caption.length > 1024) {
      options = {
        caption: `#${object.genre}\n<b>${object.title}</b>\n\n${complexStr}\n\n${object.place}\n\n${object.description.slice(0, 500) + ".."}\n\n<a href='${object.source}'>Источник</a>`,
        parse_mode: "HTML"
      }
    }
    await bot.sendPhoto(channels.events_vrn, object.image, options);
    return true;
  } catch (e) {
    return false;
  }
}