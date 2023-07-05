import got, { Options } from "got";
import { JSDOM } from "jsdom";

export const resources = {
  culture: {
    mainUrl: "https://www.culture.ru/",
    // parsePage: `afisha/voronezhskaya-oblast-voronezh/seanceStartDate-${period}/seanceEndDate-${period}?page=${currentPage}`,
    hrefElement: ".G8w3d",
    hrefAttribute: "href",
    markdown: [
      { "key": "image", "method": "parseAttribute", "attributeName": "src", "selector": ".KRQ9s" },
      { "key": "genre", "method": "findOne", "selector": "._8PLWA" },
      { "key": "title", "method": "findOne", "selector": ".iFp0c" },
      { "key": "complex", "method": "findAll", "selector": "._19IwE" },
      { "key": "place", "method": "findOne", "selector": ".uMrgA" },
      { "key": "description", "method": "findOne", "selector": ".xZmPc" },
      { "key": "source", "method": "fullUrl" },
    ]
  },
  gorodzovet: {
    mainUrl: "https://gorodzovet.ru/",
    // parsePage: `voronezh/day${period}`,
    hrefElement: ".event-image",
    hrefAttribute: "data-link",
    markdown: [
      { "title": "Event title:", "method": "one", "selector": ".eventTitle__text" },
      { "title": "Place:", "method": "all", "selector": ".event-object" },
      { "title": "Preview:", "method": "one", "selector": ".eventPreview__info" },
      { "title": "Description:", "method": "one", "selector": ".eventText" }
    ]
  }
}

const headers = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/112.0",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  // "Cookie": "_ym_uid=1688073206257306072; _ym_d=1688073206; session-cookie=176e0373b0379094bac9aabcb4819f5b2bc06b0cf1261f828d04e1e3dfbd23c9c7e3b54b1f26574f8c8648eb2029b090; _ym_isad=2; _ym_visorc=b",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "If-None-Match": 'W / "7e5d4-LyCqyywdQ92Cndy0E3CREfHMbkU"',
}

export async function scrapLastPageNumber(resource, period) {
  const options = new Options({
    prefixUrl: resource.mainUrl,
    headers: headers
  });
  const target = "._9LAqO";
  const parsePage = `afisha/voronezhskaya-oblast-voronezh/seanceStartDate-${period}/seanceEndDate-${period}`;

  const response = await got(parsePage, undefined, options);
  const dom = new JSDOM(response.body);
  const result = dom.window.document.querySelectorAll(target);
  let lastPageNumber = result[result.length - 1].textContent;

  return lastPageNumber;
}

export async function parseEventPage(resource, eventUrl) {
  const options = new Options({
    prefixUrl: resource.mainUrl,
    headers: headers
  });

  const response = await got(eventUrl, undefined, options);
  const dom = new JSDOM(response.body);
  const event = {};
  resource.markdown.map((item) => {
    switch (item.method) {
      case "parseAttribute":
        dom.window.document.querySelectorAll(item.selector).forEach((item1) => {
          if (item1.getAttribute("alt")) {
            event[item.key] = item1.getAttribute("src");
          }
        });
        break;
      case "findOne":
        return event[item.key] = dom.window.document.querySelector(item.selector).textContent.replace(/\s+/g, ' ').trim();
      case "findAll":
        event[item.key] = [];
        dom.window.document.querySelectorAll(item.selector).forEach((item1) => (
          event[item.key].push(item1.textContent)
        ));
        break;
      case "fullUrl":
        return event[item.key] = resource.mainUrl + eventUrl;
      default: return;
    }
  });
  return event;
}

async function parseEvents(resource, period, numberOfPage) {
  const result = [];

  const options = new Options({
    prefixUrl: resource.mainUrl,
    headers: headers
  });

  const parsePage = `afisha/voronezhskaya-oblast-voronezh/seanceStartDate-${period}/seanceEndDate-${period}?page=${numberOfPage}`;
  const response = await got(parsePage, undefined, options);
  const dom = new JSDOM(response.body);
  const events = dom.window.document.querySelectorAll(resource.hrefElement);
  events.forEach((elem) => {
    const href = elem.getAttribute(resource.hrefAttribute).slice(1);
    result.push(resource.mainUrl + href);
  });

  return result;

}

export async function scrapEventLinks(lastPageNumber, period) {
  let currentPage = 1;
  let eventLinks = [];

  while (currentPage < lastPageNumber) {
    const result = await parseEvents(resources.culture, period, currentPage);
    eventLinks = eventLinks.concat(result);
    currentPage++;
  }

  return eventLinks;
}